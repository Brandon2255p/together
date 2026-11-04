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

// many Togethers (v2 functions and friends)
const owner = async (t) => (await db.query("select profile_id from public.together_members where together_id = $1 and role = 'owner' and left_at is null", [t])).rows.map((r) => r.profile_id);
check("the creator is the owner", (await owner(tB)).join() === U.brandon);
const tF = (await one("brandon", "select public.v2_create_together('Family') id")).id;
check("v2 create works while in another Together", !!tF);
check("…and makes it current", (await one("brandon", "select public.my_together_id() id")).id === tF);
check("Brandon now sees only Family's lists", (await rows("brandon", "select * from public.chores")).length === 0);
const fCode = (await one("brandon", "select invite_code from public.togethers")).invite_code;
check("Adele joins a second Together with v2", (await one("adele", "select public.v2_join_together($1) id", [fCode])).id === tF);
check("…and it becomes her current one", (await one("adele", "select public.my_together_id() id")).id === tF);
check("tones go in join order", (await one("adele", "select tone from public.together_members where profile_id = auth.uid()")).tone === "partner");
await as("eve", "select public.v2_join_together($1)", [fCode]);
await as("fred", "select public.v2_join_together($1)", [fCode]);
const tones = (await db.query("select tone from public.together_members where together_id = $1 order by joined_at", [tF])).rows.map((r) => r.tone);
check("four people get four tones", tones.join() === "accent,partner,success,warning", tones.join());
check("joining again just opens it", (await one("fred", "select public.v2_join_together($1) id", [fCode])).id === tF);
const mine = await rows("adele", "select * from public.v1_list_my_togethers()");
check("Adele lists both her Togethers", mine.length === 2 && mine.filter((t) => t.is_current).length === 1, JSON.stringify(mine.map((t) => t.name)));
const fam = mine.find((t) => t.id === tF);
check("…with member counts and names", fam.member_count === 4 && fam.members.length === 4 && fam.role === "member");
check("Adele sees Eve's profile through Family", (await rows("adele", "select * from public.profiles where id = $1", [U.eve])).length === 1);
await fails("can't switch into a Together you're not in", "fred", "select public.v1_switch_together($1)", [tB], /not in that Together/);
await as("adele", "select public.v1_switch_together($1)", [tB]);
check("switching changes what you see", (await rows("adele", "select * from public.chores")).length === 4);
await as("brandon", "insert into public.chores (title) values ('Family braai')");
const news = (await rows("adele", "select * from public.v1_list_my_togethers()")).find((t) => t.id === tF);
check("someone else's activity elsewhere shows as news", news.has_news === true && news.last_activity_at !== null);
await as("adele", "select public.v1_switch_together($1)", [tF]);
check("…until you open it", (await rows("adele", "select * from public.v1_list_my_togethers()")).every((t) => !t.has_news));

const preview = await one("fred", "select * from public.v1_invite_preview($1)", [fCode.toLowerCase()]);
check("an invite code previews its Together", preview.name === "Family" && preview.members.length === 4 && preview.already_member === true && preview.expired === false);
check("a wrong code previews nothing", (await rows("fred", "select * from public.v1_invite_preview('ZZZZZZ')")).length === 0);

// owners
await fails("members can't make a new invite code", "adele", "select * from public.v1_new_invite_code()", [], /Only an owner/);
const fresh = await one("brandon", "select * from public.v1_new_invite_code()");
check("owners can, and the old code stops working", fresh.invite_code !== fCode);
await fails("old code fails", "fred", "select public.v2_join_together($1)", [fCode], /didn't work/);
await db.query("update public.togethers set invite_expires_at = now() - interval '1 minute' where id = $1", [tF]);
const gone = "00000000-0000-0000-0000-000000000099";
await db.query(`insert into auth.users (id, email) values ($1, 'gus@example.com')`, [gone]);
U.gus = gone;
await fails("expired code", "gus", "select public.v2_join_together($1)", [fresh.invite_code], /expired/);
await as("brandon", "select * from public.v1_new_invite_code()");
await fails("members can't remove anyone", "adele", "select public.v1_remove_member($1)", [U.eve], /Only an owner/);
await fails("owners can't remove themselves", "brandon", "select public.v1_remove_member($1)", [U.brandon], /leave/);
await fails("members can't promote", "adele", "select public.v1_set_member_role($1, 'owner')", [U.adele], /Only an owner/);
await fails("the only owner can't step down", "brandon", "select public.v1_set_member_role($1, 'member')", [U.brandon], /needs an owner/);
await as("brandon", "select public.v1_set_member_role($1, 'owner')", [U.adele]);
check("owners can make someone an owner", (await owner(tF)).length === 2);
await as("eve", "insert into public.wishes (name) values ('Eve''s book')");
await as("brandon", "select public.v1_remove_member($1)", [U.eve]);
check("removed members' wishes stay", (await rows("brandon", "select * from public.wishes where owner_id = $1", [U.eve])).length === 1);
check("…and their name still shows", (await rows("brandon", "select * from public.profiles where id = $1", [U.eve])).length === 1);
check("removed members lose access", (await rows("eve", "select * from public.togethers where id = $1", [tF])).length === 0);
check("…and fall back to their own Together", (await one("eve", "select public.my_together_id() id")).id !== tF);
await as("eve", "update public.wishes set name = 'x'");
check("…and can't edit what they left behind", (await rows("brandon", "select name from public.wishes where name = 'x'")).length === 0);
await fails("can't remove someone twice", "brandon", "select public.v1_remove_member($1)", [U.eve], /not in this Together/);

// leaving
await as("adele", "select public.v1_switch_together($1)", [tB]);
await as("adele", "delete from public.together_members where profile_id = auth.uid()");
check("deleting a membership directly does nothing", (await db.query("select count(*)::int n from public.together_members where profile_id = $1", [U.adele])).rows[0].n === 2);
const landed = (await one("adele", "select public.v1_leave_together() id")).id;
check("leaving lands you in another Together", landed === tF);
await as("brandon", "select public.v1_switch_together($1)", [tB]);
check("what Adele added stays: her wish", (await rows("brandon", "select * from public.wishes where owner_id = $1", [U.adele])).length === 1);
check("…and her chore assignment", (await one("brandon", "select count(*)::int n from public.chore_assignees")).n === 2);
check("Brandon's list is untouched", (await rows("brandon", "select * from public.chores")).length === 4);
check("her name still shows", (await rows("brandon", "select * from public.profiles where id = $1", [U.adele])).length === 1);
const back = (await one("brandon", "select invite_code from public.togethers")).invite_code;
check("rejoining brings her back with her tone", (await one("adele", "select public.v2_join_together($1) id", [back])).id === tB
  && (await one("adele", "select tone from public.together_members where profile_id = auth.uid()")).tone === "partner");
await as("brandon", "select public.v1_switch_together($1)", [tF]);
await as("adele", "select public.v1_switch_together($1)", [tF]);
await as("adele", "select public.v1_set_member_role($1, 'member')", [U.adele]);
await fails("the only owner has to hand over first", "brandon", "select public.v1_leave_together()", [], /owner before you leave/);
await as("fred", "select public.v1_leave_together()");
await as("adele", "select public.v1_leave_together()");
check("the last owner can leave when nobody else is left", (await one("brandon", "select public.v1_leave_together() id")).id === tB);
check("…and the Together is deleted", (await db.query("select count(*)::int n from public.togethers where id = $1", [tF])).rows[0].n === 0);
check("Fred has no Together left", (await one("fred", "select public.my_together_id() id")).id === null);

// anon
await db.exec("set role anon");
try { await db.query("select public.v1_create_together('x')"); check("anon can't call v1_create_together", false); }
catch (e) { check("anon can't call v1_create_together", /permission denied/.test(e.message), e.message); }
finally { await db.exec("reset role"); }

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
