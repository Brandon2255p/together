// Database tests: loads supabase/schemas, in the order config.toml's schema_paths gives, on PGlite (real Postgres, in WASM) behind a minimal Supabase auth shim, then
// checks row-level security and the RPC functions acting as different people. No Docker needed.
//   pnpm test:db
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { randomUUID } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";

const supabaseDir = join(import.meta.dirname, "..");
const config = readFileSync(join(supabaseDir, "config.toml"), "utf8");
const patterns = [...config.match(/schema_paths = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const files = patterns.flatMap((p) => globSync(p, { cwd: supabaseDir }).sort());
const migration = files.map((f) => `-- ${f}\n${readFileSync(join(supabaseDir, f), "utf8")}`).join("\n");
const db = new PGlite({ extensions: { pgcrypto } });

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  alter default privileges in schema public grant all on tables to authenticated, anon;
  create publication supabase_realtime;
  -- pgcrypto lives in the extensions schema on Supabase
  create schema extensions; create extension pgcrypto schema extensions;
  -- Supabase Vault, minus the encryption: secrets the app's roles can't read, and a view only definers see
  create schema vault;
  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text not null);
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
    returns uuid language sql as $$ insert into vault.secrets (secret, name, description) values (new_secret, new_name, new_description) returning id $$;
  create view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret from vault.secrets;
  -- Supabase Storage: buckets and objects with RLS, and the foldername() helper policies use
  create schema storage;
  create table storage.buckets (id text primary key, public boolean not null default false);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text not null,
    owner uuid default auth.uid(), metadata jsonb, created_at timestamptz default now(), unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1] $$;
  grant usage on schema storage to authenticated, anon;
  grant all on storage.objects to authenticated;
  insert into storage.buckets (id) values ('files');
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

// calendar feeds
const feedToken = async (user, reset = false) => (await one(user, "select public.v1_calendar_feed_token($1) t", [reset])).t;
const feed = async (token) => {
  await db.exec("set role service_role");
  try {
    return (await db.query("select public.v1_calendar_feed($1) f", [token])).rows[0].f;
  } finally {
    await db.exec("reset role");
  }
};
const bToken = await feedToken("brandon");
check("feed token is 64 hex characters", /^[0-9a-f]{64}$/.test(bToken), bToken);
check("asking again gives the same link", (await feedToken("brandon")) === bToken);
const adeleToken = await feedToken("adele");
check("each person gets their own link", adeleToken !== bToken);
const bFeed = await feed(bToken);
const dinner = bFeed?.events.find((e) => e.id === ev);
check("feed has the Together's name and time zone", bFeed?.name === "B & A" && bFeed?.time_zone === "Africa/Johannesburg", JSON.stringify(bFeed && { name: bFeed.name, tz: bFeed.time_zone }));
check("feed has the plan with its time and who's going", dinner?.time === "19:30" && dinner?.day === today && dinner?.attendees.join() === "brandon,adele", JSON.stringify(dinner));
check("Eve's feed doesn't show their plans", !(await feed(await feedToken("eve"))).events.some((e) => e.id === ev));
check("an unknown token opens nothing", (await feed("0".repeat(64))) === null);
check("the feed works with just the token, signed in or not", (await rows("eve", "select public.v1_calendar_feed($1) f", [bToken]))[0].f?.name === "B & A");
await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;");
try {
  const anon = (sql, params = []) => db.query(sql, params).then((r) => r.rows);
  check("a calendar app (anon) reads the feed with the token", (await anon("select public.v1_calendar_feed($1) f", [bToken]))[0].f?.events.some((e) => e.id === ev));
  check("…and gets nothing without a real one", (await anon("select public.v1_calendar_feed($1) f", ["f".repeat(64)]))[0].f === null);
  check("anon can't read the tokens", (await anon("select * from public.calendar_feeds")).length === 0);
  let made = true;
  try { await anon("select public.v1_calendar_feed_token()"); } catch { made = false; }
  check("anon can't make a link", !made);
} finally {
  await db.exec("reset role");
}
check("nobody reads the tokens directly", (await rows("brandon", "select * from public.calendar_feeds")).length === 0);
await fails("you need a Together for a feed", "fred", "select public.v1_calendar_feed_token()", [], /not in a Together/);
const bReset = await feedToken("brandon", true);
check("resetting gives a new link…", bReset !== bToken && (await feed(bReset)) !== null);
check("…and the old one stops working", (await feed(bToken)) === null);

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
// logVisit: a visit's rating upserts the person's own rating
const upsertRating = "insert into public.place_ratings (place_id, rating, updated_at) values ($1, $2, now()) on conflict (place_id, profile_id) do update set rating = excluded.rating, updated_at = excluded.updated_at";
await as("brandon", upsertRating, [place, 3]);
await as("adele", upsertRating, [place, 4]);
const ratings = (await as("brandon", "select profile_id, rating from public.place_ratings where place_id = $1 order by rating", [place])).rows;
check("logging a visit updates your own rating, not theirs", ratings.length === 2 && ratings[0].rating === 3 && ratings[1].rating === 4);
// unlinkPlace: the id and coordinates go together
const zeitz = (await one("brandon", "select id from public.places where google_place_id = 'ChIJ3dD0bFlnzB0R'")).id;
await as("brandon", "update public.places set google_place_id = null, lat = null, lng = null, location_fetched_at = null where id = $1", [zeitz]);
check("unlinking forgets the Google place and its coordinates", (await one("adele", "select google_place_id, lat from public.places where id = $1", [zeitz])).lat === null);
// deletePlace: either member, and the visits and ratings go with it
// a note, and a plan to go that points at the place
await as("adele", "update public.places set note = 'For the ramen' where id = $1", [place]);
check("members can note why they want to go", (await one("brandon", "select note from public.places where id = $1", [place])).note === "For the ramen");
await fails("a note is at most 500 characters", "brandon", "update public.places set note = repeat('x', 501) where id = $1", [place], /check constraint/);
const plan = (await one("brandon", "insert into public.events (title, day, start_time, place_id) values ('Nobu', $1, '19:00', $2) returning id", [today, place])).id;
check("a plan can point at a place", (await one("adele", "select place_id from public.events where id = $1", [plan])).place_id === place);
const evePlace = (await one("eve", "select id from public.places limit 1")).id;
await fails("a plan can't point at another Together's place", "brandon", "insert into public.events (title, day, place_id) values ('Sneaky', $1, $2)", [today, evePlace], /foreign key|violates/);
await as("adele", "delete from public.places where id = $1", [place]);
check("deleting a place keeps its plans on the calendar, unlinked", (await one("brandon", "select place_id from public.events where id = $1", [plan]))?.place_id === null);
check("deleting a place removes its visits and ratings", (await one("brandon", "select (select count(*) from public.visits where place_id = $1)::int + (select count(*) from public.place_ratings where place_id = $1)::int n", [place])).n === 0);
check("Eve's places are untouched", (await one("eve", "select count(*)::int n from public.places")).n === 1);

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

// challenges
const localToday = "(now() at time zone 'Africa/Johannesburg')::date";
const thisMonday = `public.challenge_period_start('weekly', ${localToday})`;
check("weeks start on Monday", (await one("brandon", "select public.challenge_period_start('weekly', '2026-11-08') d")).d.toISOString().startsWith("2026-11-02"));
check("months start on the 1st", (await one("brandon", "select public.challenge_period_start('monthly', '2026-11-18') d")).d.toISOString().startsWith("2026-11-01"));
const newChallenge = (startsOn, goals = '[{"title":"Gym","target":3},{"title":"Meal prep","target":1}]') =>
  `select public.v1_create_challenge('Gym together', 'weekly', ${startsOn}, array['${U.brandon}','${U.adele}']::uuid[], '${goals}'::jsonb) id`;
await fails("a weekly challenge starts on a Monday", "brandon", newChallenge(`${thisMonday} + 2`), [], /check constraint/);
await fails("a challenge needs a goal", "brandon", newChallenge(thisMonday, "[]"), [], /at least one goal/);
const challenge = (await one("brandon", newChallenge(thisMonday))).id;
check("Adele sees the challenge, its goals and who's in", (await rows("adele", "select * from public.challenge_goals where challenge_id = $1", [challenge])).length === 2
  && (await rows("adele", "select * from public.challenge_members where challenge_id = $1", [challenge])).length === 2);
check("Eve doesn't", (await rows("eve", "select * from public.challenges")).length === 0);
const [gym, prep] = (await rows("brandon", "select id from public.challenge_goals where challenge_id = $1 order by position", [challenge])).map((r) => r.id);
await as("brandon", "select public.v1_set_challenge_goal_count($1, 7)", [gym]);
check("a count stops at its target", (await one("adele", "select count from public.challenge_progress where goal_id = $1", [gym])).count === 3);
check("the week isn't done with a goal left", (await rows("adele", "select * from public.challenge_periods where challenge_id = $1", [challenge])).length === 0);
await as("adele", "select public.v1_set_challenge_goal_count($1, 1)", [prep]);
const marked = await rows("brandon", "select outcome, period_start = " + thisMonday + " this_week from public.challenge_periods where challenge_id = $1", [challenge]);
check("finishing the last goal marks this week done", marked.length === 1 && marked[0].outcome === "done" && marked[0].this_week, JSON.stringify(marked));
await as("brandon", "select public.v1_set_challenge_goal_count($1, 2)", [gym]);
check("undoing a goal unmarks it", (await rows("brandon", "select * from public.challenge_periods where challenge_id = $1", [challenge])).length === 0);
const later = (await one("brandon", newChallenge(`${thisMonday} + 7`))).id;
const laterGoal = (await one("brandon", "select id from public.challenge_goals where challenge_id = $1 limit 1", [later])).id;
await fails("goals can't be ticked before the challenge starts", "brandon", "select public.v1_set_challenge_goal_count($1, 1)", [laterGoal], /hasn't started/);
await as("adele", `insert into public.challenge_periods (challenge_id, period_start, outcome) values ($1, ${thisMonday} - 7, 'boosted')`, [challenge]);
check("a booster can cover last week", (await one("brandon", "select outcome from public.challenge_periods where challenge_id = $1", [challenge])).outcome === "boosted");
await fails("Eve can't touch their challenge", "eve", "select public.v1_set_challenge_goal_count($1, 1)", [gym], /removed/);

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
check("leaving stops your calendar feed", (await feed(adeleToken)) === null);
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

// Togethers from before roles: the first member counts as owner
const tOld = (await one("adele", "select public.v2_create_together('Old one') id")).id;
const oldCode = (await one("adele", "select invite_code from public.togethers")).invite_code;
await as("eve", "select public.v2_join_together($1)", [oldCode]);
await db.query("update public.together_members set role = 'member' where together_id = $1", [tOld]);
await fails("a later member still can't act as owner", "eve", "select * from public.v1_new_invite_code()", [], /Only an owner/);
check("the first member becomes owner when nobody is", (await rows("adele", "select * from public.v1_new_invite_code()")).length === 1 && (await owner(tOld)).join() === U.adele);

// anon
await db.exec("set role anon");
try { await db.query("select public.v1_create_together('x')"); check("anon can't call v1_create_together", false); }
catch (e) { check("anon can't call v1_create_together", /permission denied/.test(e.message), e.message); }
finally { await db.exec("reset role"); }


// push reminders
const sub = (n) => [`https://push.example.com/${n}`, "p256dh-key", "auth-secret"];
await as("brandon", "select public.v1_save_push_subscription($1, $2, $3)", sub("phone"));
check("you see your own push subscription", (await rows("brandon", "select * from public.push_subscriptions")).length === 1);
check("others don't see it", (await rows("adele", "select * from public.push_subscriptions")).length === 0);
await fails("can't add a subscription for someone else", "adele", "insert into public.push_subscriptions (endpoint, profile_id, p256dh, auth) values ('https://push.example.com/x', $1, 'k', 'a')", [U.brandon], /row-level security|permission denied/);
await as("adele", "select public.v1_save_push_subscription($1, $2, $3)", sub("phone"));
check(
  "a device that changes hands moves to its new owner",
  (await rows("brandon", "select * from public.push_subscriptions")).length === 0 && (await rows("adele", "select * from public.push_subscriptions")).length === 1,
);
await fails("signed-in people can't read everyone's reminders", "adele", "select * from public.v2_chore_reminders()", [], /permission denied/);
await as("brandon", "select public.v1_save_push_subscription($1, $2, $3)", sub("laptop"));
const { id: overdue } = await one("brandon", "insert into public.chores (title, due) values ('Water the plants', current_date - 1) returning id");
await as("brandon", "insert into public.chore_assignees (chore_id, profile_id) values ($1, auth.uid())", [overdue]);
await db.exec("set role service_role");
const reminders = (await db.query("select * from public.v2_chore_reminders()")).rows;
await db.exec("reset role");
check("reminders list overdue chores for the assignee's devices", reminders.find((r) => r.endpoint.endsWith("/laptop"))?.titles.includes("Water the plants"), JSON.stringify(reminders));
check("no reminder for chores you're not on", !reminders.some((r) => r.endpoint.endsWith("/phone") && r.titles.includes("Water the plants")));

// reminders follow people across Togethers, but not into ones they've left
const { id: adeleChore } = await one("brandon", "insert into public.chores (title, due) values ('Fix the gate', current_date - 1) returning id");
await as("brandon", "insert into public.chore_assignees (chore_id, profile_id) values ($1, $2)", [adeleChore, U.adele]);
const adeleTitles = async () => {
  await db.exec("set role service_role");
  const r = (await db.query("select * from public.v2_chore_reminders()")).rows;
  await db.exec("reset role");
  return r.find((x) => x.endpoint.endsWith("/phone"))?.titles ?? [];
};
await as("adele", "select public.v1_switch_together($1)", [(await one("brandon", "select public.my_together_id() id")).id]);
check("reminders cover a Together you're in", (await adeleTitles()).includes("Fix the gate"));
await as("adele", "select public.v1_leave_together()");
check("…but not one you've left", !(await adeleTitles()).includes("Fix the gate"));

// files: keys, uploads, quota, duplicates, bin, folders, search
Object.assign(U, {
  gina: "00000000-0000-0000-0000-000000000001",
  hal: "00000000-0000-0000-0000-000000000002",
  ivy: "00000000-0000-0000-0000-000000000003",
});
for (const name of ["gina", "hal", "ivy"]) await db.query(`insert into auth.users (id, email) values ($1, $2)`, [U[name], `${name}@example.com`]);
const tG = (await one("gina", "select public.v2_create_together('Gina & Hal') id")).id;
await as("hal", "select public.v2_join_together($1)", [(await one("gina", "select invite_code from public.togethers")).invite_code]);
const tI = (await one("ivy", "select public.v2_create_together('Ivy') id")).id;

const keysOf = (user) => rows(user, "select * from public.v1_files_keys()");
const gKeys = await keysOf("gina");
check("the first ask makes key version 1: 32 random bytes", gKeys.length === 1 && gKeys[0].version === 1 && gKeys[0].active && Buffer.from(gKeys[0].key, "base64").length === 32, JSON.stringify(gKeys));
check("everyone in the Together gets the same key", (await keysOf("hal"))[0].key === gKeys[0].key && (await keysOf("gina")).length === 1);
check("each Together has its own key", (await keysOf("ivy"))[0].key !== gKeys[0].key);
check("the key is kept in Vault", (await db.query("select count(*)::int n from vault.secrets where secret = $1", [gKeys[0].key])).rows[0].n === 1);
await fails("no keys without a Together", "fred", "select * from public.v1_files_keys()", [], /not in a Together/);
check("members can't read together_keys directly", (await rows("gina", "select * from public.together_keys")).length === 0);
await fails("members can't read Vault", "gina", "select * from vault.decrypted_secrets", [], /permission denied/);

const mac = (n) => n.toString(16).padStart(64, "0");
const paths = (t, id, kind) => [`${t}/${id}/original.bin`, kind === "document" ? null : `${t}/${id}/thumb.bin`, kind === "document" ? null : `${t}/${id}/preview.bin`];
async function startUpload(user, { kind = "photo", n, stored = 1000, name = `file-${n}`, takenAt = "2026-11-03T10:00:00Z", folder = null, tags = [], together = tG }) {
  const id = randomUUID();
  const [o, th, pr] = paths(together, id, kind);
  await as(user,
    `insert into public.files (id, kind, name, mime_type, size_bytes, stored_bytes, key_version, content_mac, original_path, thumb_path, preview_path, taken_at, folder_id, tags)
     values ($1, $2, $3, 'application/octet-stream', $4, $4, 1, $5, $6, $7, $8, $9, $10, $11)`,
    [id, kind, name, stored, mac(n), o, th, pr, takenAt, folder, tags]);
  return { id, paths: [o, th, pr].filter(Boolean) };
}
const putObject = (user, path, size) => as(user, "insert into storage.objects (bucket_id, name, metadata) values ('files', $1, $2)", [path, { size }]);
async function upload(user, opts) {
  const f = await startUpload(user, opts);
  const each = Math.floor((opts.stored ?? 1000) / f.paths.length);
  for (const p of f.paths) await putObject(user, p, each);
  await as(user, "select public.v1_finish_upload($1)", [f.id]);
  return f.id;
}

// uploading
const sunset = await startUpload("gina", { n: 1, stored: 900, name: "Sunset.heic" });
await fails("can't finish before the objects are uploaded", "gina", "select public.v1_finish_upload($1)", [sunset.id], /missing/);
await fails("someone else can't add objects to your upload", "hal", "insert into storage.objects (bucket_id, name, metadata) values ('files', $1, '{}')", [sunset.paths[0]], /row-level security/);
await fails("objects outside an upload are refused", "gina", "insert into storage.objects (bucket_id, name, metadata) values ('files', $1, '{}')", [`${tG}/${randomUUID()}/original.bin`], /row-level security/);
for (const p of sunset.paths) await putObject("gina", p, 300);
await fails("Hal can't finish Gina's upload", "hal", "select public.v1_finish_upload($1)", [sunset.id], /isn't waiting/);
const done = await one("gina", "select status, stored_bytes::int from public.v1_finish_upload($1)", [sunset.id]);
check("finishing makes it ready with the real size", done.status === "ready" && done.stored_bytes === 900, JSON.stringify(done));
const big = await startUpload("gina", { n: 2, stored: 300, kind: "document" });
await putObject("gina", big.paths[0], 5000);
await fails("objects bigger than declared are rejected", "gina", "select public.v1_finish_upload($1)", [big.id], /doesn't match/);
check("Hal reads the Together's objects", (await rows("hal", "select name from storage.objects where name like $1", [`${tG}/%`])).length >= 3);
check("Ivy can't read them", (await rows("ivy", "select name from storage.objects")).length === 0);
check("Ivy can't see the files", (await rows("ivy", "select * from public.files")).length === 0);
await fails("can't upload straight to ready", "gina", "insert into public.files (kind, name, mime_type, size_bytes, stored_bytes, key_version, content_mac, original_path, status) values ('document', 'x', 'x', 1, 1, 1, $1, 'x', 'ready')", [mac(3)], /row-level security/);
const otherId = randomUUID();
await fails("paths have to be the file's own", "gina", "insert into public.files (id, kind, name, mime_type, size_bytes, stored_bytes, key_version, content_mac, original_path) values ($1, 'document', 'x', 'x', 1, 1, 1, $2, $3)", [otherId, mac(4), `${tI}/${otherId}/original.bin`], /check constraint/);
await fails("photos don't take tags", "gina", "insert into public.files (id, kind, name, mime_type, size_bytes, stored_bytes, key_version, content_mac, original_path, tags) values ($1, 'photo', 'x', 'x', 1, 1, 1, $2, $3, '{car}')", [otherId, mac(5), `${tG}/${otherId}/original.bin`], /check constraint/);
await as("gina", "update storage.objects set metadata = '{}' where name = $1", [sunset.paths[0]]);
await as("gina", "delete from storage.objects where name = $1", [sunset.paths[0]]);
check("objects can't be changed or deleted by members", (await db.query("select metadata from storage.objects where name = $1", [sunset.paths[0]])).rows[0]?.metadata?.size === 300);

// finishing an upload kept in S3 (v2): the server has checked the objects, so only who and what state are checked here
const s3 = await startUpload("ivy", { n: 50, stored: 700, name: "Beach.jpg", together: tI });
await fails("someone else can't finish your S3 upload", "hal", "select public.v2_finish_upload($1)", [s3.id], /isn't waiting/);
const s3done = await one("ivy", "select status, stored_bytes::int from public.v2_finish_upload($1)", [s3.id]);
check("v2 makes it ready and keeps the declared size", s3done.status === "ready" && s3done.stored_bytes === 700, JSON.stringify(s3done));
await fails("a ready file can't be finished again", "ivy", "select public.v2_finish_upload($1)", [s3.id], /isn't waiting/);
try {
  await db.exec("reset role; set role anon;");
  await db.query("select public.v2_finish_upload($1)", [s3.id]);
  check("anon can't finish uploads", false, "expected an error");
} catch (e) {
  check("anon can't finish uploads", /permission denied/.test(e.message), e.message);
} finally {
  await db.exec("reset role");
}

// uploads that don't finish leave nothing behind (each row made here is gone again, so the usage numbers below hold)
const pathsOf = (r) => r.map((x) => Object.values(x)[0]).sort();
const age = (id, interval) => db.query(`update public.files set created_at = now() - interval '${interval}' where id = $1`, [id]);
const exists = async (id) => (await db.query("select 1 from public.files where id = $1", [id])).rows.length === 1;
const broken = await startUpload("gina", { n: 60 });
check("someone else can't abort your upload", (await rows("hal", "select * from public.v1_abort_upload($1)", [broken.id])).length === 0 && (await exists(broken.id)));
const aborted = pathsOf(await rows("gina", "select * from public.v1_abort_upload($1)", [broken.id]));
check("aborting drops the row and hands back its objects", !(await exists(broken.id)) && JSON.stringify(aborted) === JSON.stringify([...broken.paths].sort()), JSON.stringify(aborted));
check("aborting twice does nothing", (await rows("gina", "select * from public.v1_abort_upload($1)", [broken.id])).length === 0);
check("a finished file can't be aborted", (await rows("ivy", "select * from public.v1_abort_upload($1)", [s3.id])).length === 0 && (await exists(s3.id)));

const stuck = await startUpload("gina", { n: 61 });
check("someone else's fresh upload stays in the way (it may still be sending)", (await rows("hal", "select * from public.v1_release_stuck_upload($1)", [mac(61)])).length === 0 && (await exists(stuck.id)));
await age(stuck.id, "30 minutes");
const released = pathsOf(await rows("hal", "select * from public.v1_release_stuck_upload($1)", [mac(61)]));
check("…but once its URLs have died, anyone adding the file clears it", !(await exists(stuck.id)) && released.length === 3, JSON.stringify(released));
const ownStuck = await startUpload("gina", { n: 62 });
check("your own unfinished upload clears straight away", (await rows("gina", "select * from public.v1_release_stuck_upload($1)", [mac(62)])).length === 3 && !(await exists(ownStuck.id)));
check("a finished copy is never cleared", (await rows("ivy", "select * from public.v1_release_stuck_upload($1)", [mac(50)])).length === 0 && (await exists(s3.id)));
await age(sunset.id, "2 days");
check("…however old", (await rows("hal", "select * from public.v1_release_stuck_upload($1)", [mac(1)])).length === 0 && (await exists(sunset.id)));
check("Ivy can't clear Gina's Together's uploads", (await rows("ivy", "select * from public.v1_release_stuck_upload($1)", [mac(2)])).length === 0);

const abandoned = await startUpload("gina", { n: 63 });
const sending = await startUpload("gina", { n: 64 });
await age(abandoned.id, "2 hours");
await fails("members can't run the sweep", "gina", "select * from public.v1_sweep_stale_uploads()", [], /permission denied/);
await db.exec("set role service_role");
let swept;
try {
  swept = pathsOf((await db.query("select * from public.v1_sweep_stale_uploads()")).rows);
} finally {
  await db.exec("reset role");
}
check("the sweep deletes uploads left an hour on, with their objects", !(await exists(abandoned.id)) && JSON.stringify(swept) === JSON.stringify([...abandoned.paths].sort()), JSON.stringify(swept));
check("…and leaves uploads still going, and finished files", (await exists(sending.id)) && (await exists(sunset.id)));
await as("gina", "select * from public.v1_abort_upload($1)", [sending.id]);

// duplicates
await fails("the same file twice is refused", "hal", "insert into public.files (id, kind, name, mime_type, size_bytes, stored_bytes, key_version, content_mac, original_path) values ($1, 'photo', 'x', 'x', 1, 1, 1, $2, $3)", [otherId, mac(1), `${tG}/${otherId}/original.bin`], /duplicate key/);
const dup = await rows("hal", "select * from public.v1_find_duplicates($1)", [[mac(1), mac(99)]]);
check("duplicates say who added them", dup.length === 1 && dup[0].uploaded_by_name === "gina" && dup[0].in_bin === false, JSON.stringify(dup));
check("Ivy's Together doesn't see Gina's duplicates", (await rows("ivy", "select * from public.v1_find_duplicates($1)", [[mac(1)]])).length === 0);
await upload("ivy", { n: 1, together: tI, stored: 10 });
check("…and can add the same file to her own", (await rows("ivy", "select * from public.v1_find_duplicates($1)", [[mac(1)]])).length === 1);

// quota
await fails("members can't raise the quota", "gina", "update public.togethers set storage_quota_bytes = 1e12 where id = $1", [tG], /can't be changed/);
await as("hal", "update public.togethers set name = 'G & H' where id = $1", [tG]);
check("…but can still rename", (await db.query("select name from public.togethers where id = $1", [tG])).rows[0].name === "G & H");
check("the quota is 50 GB", Number((await one("gina", "select public.v1_storage_usage() u")).u.quota_bytes) === 50 * 1024 ** 3);
await db.query("update public.togethers set storage_quota_bytes = 3000 where id = $1", [tG]);
await fails("an upload that doesn't fit is refused", "hal", "insert into public.files (id, kind, name, mime_type, size_bytes, stored_bytes, key_version, content_mac, original_path) values ($1, 'video', 'x', 'x', 1, 2000, 1, $2, $3)", [otherId, mac(6), `${tG}/${otherId}/original.bin`], /Not enough space/);
const vid = await upload("hal", { n: 7, kind: "video", stored: 600, name: "Beach.mov", takenAt: "2025-12-31T23:30:00Z" });

// editing, the bin and folders
await fails("what was uploaded can't change", "hal", "update public.files set stored_bytes = 1 where id = $1", [sunset.id], /Only the name/);
await fails("members can't mark a file ready", "gina", "update public.files set status = 'ready' where id = $1", [big.id], /Only the name/);
const { id: car } = await one("gina", "insert into public.file_folders (name, hue) values ('Car', 'partner') returning id");
await fails("folder names are unique", "hal", "insert into public.file_folders (name) values (' car ')", [], /duplicate key/);
const disc = await upload("gina", { n: 8, kind: "document", stored: 200, name: "Licence disc 2026.pdf", folder: car, tags: [" Car", "car", "LICENCE", ""], takenAt: "2026-03-10T08:00:00Z" });
check("tags are trimmed, lowercased and de-duplicated", (await one("hal", "select tags from public.files where id = $1", [disc])).tags.join() === "car,licence");
await as("hal", "update public.files set name = 'Licence disc.pdf', tags = '{car,Disc}' where id = $1", [disc]);
check("members rename and tag", (await one("gina", "select name, tags from public.files where id = $1", [disc])).tags.join() === "car,disc");
await fails("a folder with files can't be deleted", "hal", "delete from public.file_folders where id = $1", [car], /Move or bin/);
await as("hal", "update public.files set deleted_at = '2000-01-01' where id = $1", [disc]);
const binned = await one("gina", "select deleted_at, deleted_by from public.files where id = $1", [disc]);
check("the bin records who and now, not what the app sent", binned.deleted_by === U.hal && Date.now() - binned.deleted_at.getTime() < 60_000, JSON.stringify(binned));
await as("gina", "delete from public.file_folders where id = $1", [car]);
check("…once its files are binned, a folder can go, and they lose it", (await one("gina", "select folder_id from public.files where id = $1", [disc])).folder_id === null);
await as("gina", "delete from public.files where id = $1", [disc]);
check("members can't hard-delete", (await db.query("select count(*)::int n from public.files where id = $1", [disc])).rows[0].n === 1);
const dupBin = await rows("gina", "select in_bin from public.v1_find_duplicates($1)", [[mac(8)]]);
check("a duplicate in the bin says so", dupBin[0]?.in_bin === true);

const usage = (await one("gina", "select public.v1_storage_usage() u")).u;
check(
  "usage splits photos, videos, documents and bin, and counts unfinished uploads",
  usage.photos.count === 1 && usage.photos.bytes === 900 && usage.videos.count === 1 && usage.bin.count === 1 && usage.bin.bytes === 200 && usage.documents.count === 0 && usage.used_bytes === 900 + 300 + 600 + 200,
  JSON.stringify(usage),
);
await as("gina", "update public.files set deleted_at = null where id = $1", [disc]);
check("restoring clears the bin", (await one("hal", "select deleted_at, deleted_by from public.files where id = $1", [disc])).deleted_by === null);

// search
const search = async (user, q, kinds = null, year = null, month = null) =>
  (await rows(user, "select name from public.v1_search_files($1, $2, $3, $4)", [q, kinds && `{${kinds.join()}}`, year, month])).map((r) => r.name);
check("search matches names", (await search("gina", "sunset")).join() === "Sunset.heic");
check("…tags", (await search("gina", "disc")).join() === "Licence disc.pdf");
check("…who added it", (await search("gina", "hal")).join() === "Beach.mov");
check("…every word has to match", (await search("gina", "licence beach")).length === 0);
check("a wildcard is just a character", (await search("gina", "%")).length === 0);
check("kinds narrow it", (await search("gina", null, ["photo", "video"])).sort().join() === "Beach.mov,Sunset.heic");
check("years use the Together's time zone (31 Dec 23:30 UTC is 2026 in Joburg)", (await search("gina", null, null, 2026, 1)).join() === "Beach.mov");
check("months narrow a year", (await search("gina", null, null, 2026, 3)).join() === "Licence disc.pdf");
await fails("a month needs a year", "gina", "select * from public.v1_search_files(null, null, null, 3)", [], /year before a month/);
check("unfinished uploads stay out of search", !(await search("gina", null)).includes(`file-2`));
const months = await rows("gina", "select * from public.v1_file_months(null)");
check("months count what's there", months.length === 3 && months[0].year === 2026 && months[0].month === 11, JSON.stringify(months));
check("Ivy's search doesn't reach Gina's files", (await search("ivy", "sunset")).length === 0);

// emptying the bin
await as("gina", "update public.files set deleted_at = now() where id = $1", [vid]);
check("emptying the bin counts what was in it", (await one("hal", "select public.v1_empty_bin() n")).n === 1);
check("…and marks it for the purge", (await db.query("select deleted_at < now() - interval '29 days' old from public.files where id = $1", [vid])).rows[0].old === true);
check("realtime covers files and folders", (await db.query("select count(*)::int n from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('files', 'file_folders')")).rows[0].n === 2);

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
