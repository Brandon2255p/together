// Database tests: loads supabase/schemas, in the order config.toml's schema_paths gives, on PGlite (real Postgres, in WASM) behind a minimal Supabase auth shim, then
// checks row-level security and the RPC functions acting as different people. No Docker needed.
//   pnpm test:db
import { PGlite } from "@electric-sql/pglite";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

const supabaseDir = join(import.meta.dirname, "..");
const config = readFileSync(join(supabaseDir, "config.toml"), "utf8");
const patterns = [...config.match(/schema_paths = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const files = patterns.flatMap((p) => globSync(p, { cwd: supabaseDir }).sort());
const migration = files.map((f) => `-- ${f}\n${readFileSync(join(supabaseDir, f), "utf8")}`).join("\n");
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  alter default privileges in schema public grant all on tables to authenticated, anon;
  create publication supabase_realtime;
`);
await db.exec(migration);
console.log(`✓ ${files.length} schema files applied`);

const U = {
  brandon: "00000000-0000-0000-0000-00000000000b",
  adele: "00000000-0000-0000-0000-00000000000a",
  eve: "00000000-0000-0000-0000-00000000000e",
  fred: "00000000-0000-0000-0000-00000000000f",
};
for (const [name, id] of Object.entries(U)) {
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${name}@example.com`]);
}

let failures = 0;
async function as(user, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[user] ?? ""}', false); set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
function check(label, cond, extra = "") {
  console.log(`${cond ? "✓" : "✗"} ${label}${extra ? ` (${extra})` : ""}`);
  if (!cond) failures++;
}
async function fails(label, user, sql, params, pattern) {
  try {
    await as(user, sql, params);
    check(label, false, "expected an error");
  } catch (e) {
    check(label, pattern.test(e.message), e.message);
  }
}
const one = async (user, sql, params) => (await as(user, sql, params)).rows[0];
const rows = async (user, sql, params) => (await as(user, sql, params)).rows;

// realtime
const published = (await db.query("select tablename from pg_publication_tables where pubname = 'supabase_realtime'")).rows.map((r) => r.tablename);
check("realtime covers goals, visits and members", ["goals", "goal_owners", "visits", "place_ratings", "event_attendees", "together_members", "profiles"].every((t) => published.includes(t)), published.join(", "));
check("realtime leaves out wish_claims (surprises stay surprises)", !published.includes("wish_claims"));

// profiles
check("profiles created from auth.users", (await db.query("select count(*)::int n from public.profiles")).rows[0].n === 4);

// togethers
const tB = (await one("brandon", "select public.v1_create_together('Brandon & Adele') id")).id;
const code = (await one("brandon", "select invite_code from public.togethers")).invite_code;
check("invite code format", /^[A-HJ-NP-Z2-9]{6}$/.test(code), code);
await one("eve", "select public.v1_create_together('Eve') id");
const messyCode = `${code.slice(0, 3).toLowerCase()}-${code.slice(3)}`;
check("join with messy code", (await one("adele", "select public.v1_join_together($1) id", [messyCode])).id === tB);
check("joiner gets partner tone", (await one("adele", "select tone from public.together_members where profile_id = auth.uid()")).tone === "partner");
await fails("can't join a second Together", "eve", "select public.v1_join_together($1)", [code], /already in a Together/);
await fails("third person can't join", "fred", "select public.v1_join_together($1)", [code], /two people/);
await fails("bad code", "fred", "select public.v1_join_together('ZZZZZZ')", [], /didn't work/);
check("Adele sees Brandon's profile", (await rows("adele", "select name from public.profiles")).length === 2);
check("Eve sees only herself", (await rows("eve", "select name from public.profiles")).length === 1);
check("Eve can't see Brandon's Together", (await rows("eve", "select * from public.togethers where id = $1", [tB])).length === 0);
await as("eve", "update public.togethers set name = 'hacked' where id = $1", [tB]);
check("Eve can't rename it", (await db.query("select name from public.togethers where id = $1", [tB])).rows[0].name === "Brandon & Adele");
await as("adele", "update public.togethers set name = 'B & A'");
check("Adele can rename it", (await db.query("select name from public.togethers where id = $1", [tB])).rows[0].name === "B & A");

// shopping
await as("brandon", "insert into public.shopping_items (name) values ('Milk')");
await as("adele", "insert into public.shopping_items (name, quantity) values ('milk ', 2)");
check("Adele sees both items", (await rows("adele", "select * from public.shopping_items")).length === 2);
check("Eve sees none", (await rows("eve", "select * from public.shopping_items")).length === 0);
await fails("Eve can't add to their list", "eve", "insert into public.shopping_items (together_id, name) values ($1, 'x')", [tB], /row-level security/);
await fails("can't add as someone else", "brandon", "insert into public.shopping_items (name, added_by) values ('x', $1)", [U.adele], /row-level security/);
const hist = await one("brandon", "select name, times_added from public.item_history");
check("history merges Milk and milk", hist.times_added === 2 && hist.name === "milk", JSON.stringify(hist));
await as("brandon", "update public.shopping_items set done_at = now()");
await as("brandon", "delete from public.shopping_items where done_at is not null");
const cat = await rows("brandon", "select * from public.v1_item_catalog()");
check("catalog survives clearing the basket", cat.length === 1 && cat[0].times_added === 2, JSON.stringify(cat));
check("catalog is empty without a Together", (await rows("fred", "select * from public.v1_item_catalog()")).length === 0);

// chores
const weekly = (await one("brandon", "insert into public.chores (title, due, repeat) values ('Bins', '2026-10-20', 'weekly') returning id")).id;
await as("brandon", "insert into public.chore_assignees (chore_id, profile_id) values ($1, $2), ($1, $3)", [weekly, U.brandon, U.adele]);
await fails("can't assign someone outside the Together", "brandon", "insert into public.chore_assignees (chore_id, profile_id) values ($1, $2)", [weekly, U.eve], /foreign key/);
const today = (await db.query("select (now() at time zone 'Africa/Johannesburg')::date::text d")).rows[0].d;
const rolled = await one("adele", "select * from public.v1_set_chore_done($1, true)", [weekly]);
let next = new Date("2026-10-20T00:00:00Z");
while (next.toISOString().slice(0, 10) <= today) next = new Date(next.getTime() + 7 * 864e5);
check("weekly chore rolls to the next date after today", rolled.due.toISOString().slice(0, 10) === next.toISOString().slice(0, 10) && rolled.done_at === null, `${rolled.due.toISOString?.() ?? rolled.due} vs ${today}`);
const monthly = (await one("brandon", "insert into public.chores (title, due, repeat) values ('Rent', '2026-01-31', 'monthly') returning id")).id;
const m = await one("brandon", "select due::text due from public.v1_set_chore_done($1, true)", [monthly]);
check("monthly keeps the day of the month", m.due.endsWith("-30") || m.due.endsWith("-31"), m.due);
const undated = (await one("brandon", "insert into public.chores (title, repeat) values ('Water plants', 'daily') returning id")).id;
const u = await one("brandon", "select due::text due from public.v1_set_chore_done($1, true)", [undated]);
check("undated recurring chore counts from today", u.due > today, u.due);
const once = (await one("brandon", "insert into public.chores (title) values ('Keys') returning id")).id;
const o = await one("brandon", "select * from public.v1_set_chore_done($1, true)", [once]);
check("once-off chore is marked done", o.done_at !== null);
check("completions are logged", (await one("adele", "select count(*)::int n from public.chore_completions")).n === 4);
await fails("Eve can't tick their chores", "eve", "select public.v1_set_chore_done($1, true)", [once], /removed/);

// calendar
const ev = (await one("brandon", "insert into public.events (title, day, start_time) values ('Dinner', $1, '19:30') returning id", [today])).id;
await as("brandon", "insert into public.event_attendees (event_id, profile_id) values ($1, $2), ($1, $3)", [ev, U.brandon, U.adele]);
check("Adele sees the event with 2 attendees", (await one("adele", "select count(*)::int n from public.event_attendees where event_id = $1", [ev])).n === 2);

// places
const place = (await one("brandon", "insert into public.places (name, category, area) values ('Nobu', 'Japanese', 'Sea Point') returning id")).id;
await as("brandon", "insert into public.place_ratings (place_id, rating) values ($1, 5)", [place]);
await fails("can't rate for someone else", "brandon", "insert into public.place_ratings (place_id, profile_id, rating) values ($1, $2, 4)", [place, U.adele], /row-level security/);
await fails("rating is 1-5", "adele", "insert into public.place_ratings (place_id, rating) values ($1, 6)", [place], /check constraint/);
await as("adele", "insert into public.visits (place_id, day, title, rating) values ($1, $2, 'Anniversary', 5)", [place, today]);
check("logging a visit marks it been", (await one("brandon", "select status from public.places where id = $1", [place])).status === "been");
await as("brandon", "insert into public.places (name, google_place_id, city, country, lat, lng, location_fetched_at) values ('Zeitz MOCAA', 'ChIJ3dD0bFlnzB0R', 'Cape Town', 'South Africa', -33.9, 18.4, now())");
await fails("one row per Google place per Together", "adele", "insert into public.places (name, google_place_id) values ('Zeitz again', 'ChIJ3dD0bFlnzB0R')", [], /duplicate key/);
check("another Together can save the same Google place", (await one("eve", "insert into public.places (name, google_place_id) values ('Zeitz', 'ChIJ3dD0bFlnzB0R') returning id")).id !== undefined);
await fails("coordinates come with the time they were fetched", "brandon", "insert into public.places (name, lat, lng) values ('x', -33.9, 18.4)", [], /check constraint/);
await fails("a Google place id is just an id", "brandon", "insert into public.places (name, google_place_id) values ('x', 'https://evil.example')", [], /check constraint/);

// wishlist
const wish = (await one("adele", "insert into public.wishes (name, price_cents) values ('Ceramic vase', 85000) returning id")).id;
const bWish = (await one("brandon", "insert into public.wishes (name) values ('Headphones') returning id")).id;
await fails("can't add a wish for someone else", "brandon", "insert into public.wishes (name, owner_id) values ('x', $1)", [U.adele], /row-level security/);
await as("brandon", "update public.wishes set name = 'mine now' where id = $1", [wish]);
check("can't edit someone else's wish", (await one("adele", "select name from public.wishes where id = $1", [wish])).name === "Ceramic vase");
await as("brandon", "insert into public.wish_claims (wish_id) values ($1)", [wish]);
check("Brandon sees his claim", (await rows("brandon", "select * from public.wish_claims")).length === 1);
check("Adele can't see the claim on her wish", (await rows("adele", "select * from public.wish_claims")).length === 0);
await fails("can't claim your own wish", "brandon", "insert into public.wish_claims (wish_id) values ($1)", [bWish], /row-level security/);
await fails("Adele can't claim her own either", "adele", "insert into public.wish_claims (wish_id) values ($1)", [wish], /row-level security/);
await as("adele", "delete from public.wish_claims where wish_id = $1", [wish]);
check("Adele can't remove Brandon's claim", (await rows("brandon", "select * from public.wish_claims")).length === 1);
check("Eve sees no wishes", (await rows("eve", "select * from public.wishes")).length === 0);

// goals
const goal = (await one("brandon", "insert into public.goals (title, saved_cents, target_cents) values ('Paternoster', 420000, 800000) returning id")).id;
await as("brandon", "insert into public.goal_owners (goal_id, profile_id) values ($1, $2), ($1, $3)", [goal, U.brandon, U.adele]);
check("shared goal has two owners", (await one("adele", "select count(*)::int n from public.goal_owners")).n === 2);

// leaving
await as("adele", "delete from public.together_members where profile_id = auth.uid()");
check("Adele can leave; her wish goes with her", (await rows("brandon", "select * from public.wishes")).length === 1);
check("…and her chore assignment", (await one("brandon", "select count(*)::int n from public.chore_assignees")).n === 1);
check("Brandon's list is untouched", (await rows("brandon", "select * from public.chores")).length === 4);

// anon
await db.exec("set role anon");
try { await db.query("select public.v1_create_together('x')"); check("anon can't call v1_create_together", false); }
catch (e) { check("anon can't call v1_create_together", /permission denied/.test(e.message), e.message); }
finally { await db.exec("reset role"); }

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
