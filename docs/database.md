# Database

Together runs on Supabase Postgres. The schema is **declarative**: `supabase/schemas` describes the database as it
should be, and migrations are generated from it. [`supabase/tests/schema.test.mjs`](../supabase/tests/schema.test.mjs)
checks it. Run the tests with `pnpm test:db`; they use PGlite, so no Docker is needed.

## Layout

```
supabase/schemas/
├── types/enums.sql            enums shared by the tables
├── tables/NN_<table>.sql      one table each: columns, indexes, RLS and its policies, in dependency order
├── internal/                  helpers other SQL calls; the app never does, so they aren't versioned
├── functions_v1/v1_<name>.sql the RPCs the app calls, one per file, named with their version
├── triggers/<name>.sql        trigger function + the trigger
└── realtime.sql               tables published to Supabase Realtime
```

`schema_paths` in `supabase/config.toml` sets the load order: types, tables, internal, functions, triggers, realtime.

### Changing the schema

1. Edit the files in `supabase/schemas`.
2. Run `just create-migration <name>`. It runs `supabase db schema declarative sync --no-apply`, which diffs the
   schemas against the existing migrations and writes `supabase/migrations/<timestamp>_<name>.sql`. Your local database
   isn't touched.
3. Read the generated file. Run `pnpm test:db`.

**Never write or edit a migration by hand.** If the generated SQL is wrong, fix the schema files and generate again.

### Versioning functions

App-facing functions carry their version in both the folder and the name: `functions_v1/v1_join_together.sql`
defines `public.v1_join_together`. This is the same convention as inboxforge.

To change a function's arguments or what it returns:

1. Add `functions_v2/v2_<name>.sql`, and move the app to `v2_`.
2. Leave `v1_` in place until no deployed client calls it any more.

Old and new frontends can then run against the same database during a deploy. A fix that keeps the signature
and behaviour the same can edit the existing version in place.

## Shape

Everything shared hangs off a **together**. A person can be in many; one is their current one. Every shared table
carries `together_id`.

```mermaid
erDiagram
  auth_users ||--|| profiles : "trigger creates"
  profiles ||--o{ together_members : "is in"
  togethers ||--|{ together_members : "has"

  togethers ||--o{ shopping_items : ""
  togethers ||--o{ item_history : "autocomplete"
  togethers ||--o{ chores : ""
  chores ||--o{ chore_assignees : ""
  chores ||--o{ chore_completions : "log"
  togethers ||--o{ events : ""
  events ||--o{ event_attendees : ""
  togethers ||--o{ places : ""
  places ||--o{ place_ratings : "one per person"
  places ||--o{ visits : ""
  together_members ||--o{ wishes : "owns"
  wishes ||--o| wish_claims : "hidden from owner"
  togethers ||--o{ goals : ""
  goals ||--|{ goal_owners : "1 = personal, 2 = shared"

  together_members ||--o{ chore_assignees : ""
  together_members ||--o{ event_attendees : ""
  together_members ||--o{ place_ratings : ""
  together_members ||--o{ goal_owners : ""
```

| Table | Holds | Maps to |
|---|---|---|
| `profiles` | Name, and the current Together (`current_together_id`), one per auth user | `Member` (`initial` is derived) |
| `togethers` | Name, invite code and when it expires, time zone | `Together`, `TogetherSummary` |
| `together_members` | Who's in it (or was: `left_at`), their role and colour, when they last looked | `Together.members`, `Together.formerMembers`, `Member.tone`, `Member.role` |
| `shopping_items` | The list; `done_at` set = in the basket | `ShoppingItem` |
| `item_history` | Every name ever added, with counts | `CatalogEntry` via `v1_item_catalog()` |
| `chores`, `chore_assignees` | Chores and who they're for | `Chore` |
| `chore_completions` | Who ticked what, when | (history; not in the UI yet) |
| `events`, `event_attendees` | Calendar | `CalendarEvent` |
| `places`, `place_ratings`, `visits` | Places, each person's rating, visit log | `Place`, `Visit` |
| `wishes`, `wish_claims` | Wishes and who's secretly buying them | `WishItem` |
| `goals`, `goal_owners` | Savings goals | `Goal` |

Money is stored in cents (`price_cents`, `saved_cents`, `target_cents`). The models use whole rands, so the
Supabase service divides by 100.

## Decisions

**Many Togethers per person.** Membership has a `role` (`owner` / `member`; the creator is the owner) and a `tone`
(`accent`, `partner`, `success`, `warning`, given in join order and repeating after four). `profiles.current_together_id`
says which Together the app shows. `my_together_id()` reads it while you're still a member there, and otherwise falls
back to the Together you joined first. Every policy goes through `my_together_id()`, so switching changes everything you
see. The switcher lists the rest through `v1_list_my_togethers()`.

**Leaving keeps what you added.** Leaving or being removed sets `together_members.left_at` instead of deleting the
row. So wishes, claims, assignments and ratings keep a valid foreign key and still show the person's name. Rejoining
clears `left_at`. There are no write policies on `together_members`: every change goes through the functions below.
A Together with members but no owner (made before roles existed) treats its first member as the owner:
`ensure_owner()` promotes them the first time an owner-only function or `v1_leave_together` runs, and the app shows them
as owner until then.

**Integrity across Togethers.** Child tables repeat `together_id` and use composite foreign keys:

- `(chore_id, together_id) → chores`
- `(together_id, profile_id) → together_members`

So the database itself rejects assigning a chore to someone outside the Together, without relying on a policy.

**Row-level security.** Every table has RLS on. The base rule is
`together_id = (select my_together_id())`. `my_together_id()` is `security definer`, which avoids policies recursing
into `together_members`. The `(select …)` wrapper makes Postgres evaluate it once per query instead of once per row.
Stricter rules sit on top:

- Shopping items can only be added as yourself (a restrictive policy).
- Ratings: you set only your own.
- Wishes: only the owner adds, edits or removes them, and only in their current Together (so someone who left can't
  change what stays behind).
- **Wish claims are a separate table, so RLS can hide them from the wish's owner.** Gifts stay a surprise at the
  database level, not just in the UI. Its primary key is `wish_id`, which allows one claim per wish.

**Writes that need more than RLS go through functions** (`supabase.rpc`):

| Function | Does |
|---|---|
| `v2_create_together(name)` | Makes a Together with a fresh 6-character code (no 0/O/1/I) that works for 48 hours. You're its `owner` (`accent`), and it becomes current. |
| `v2_join_together(code)` | Normalises the code (case, spaces, dashes), refuses expired codes, adds you with the next tone (or brings you back), and makes it current |
| `v1_create_together`, `v1_join_together` | The one-Together versions. Kept until no deployed app calls them. |
| `v1_switch_together(id)` | Makes another of your Togethers current |
| `v1_list_my_togethers()` | Your Togethers, with members, your tone and role, `last_activity_at` (the newest thing anyone added or did) and `has_news` (someone else did something after your `last_seen_at` there) |
| `v1_invite_preview(code)` | What a join link opens, before joining: name, members, expired, already in |
| `v1_new_invite_code()` | Owners: a fresh code good for 48 hours; the old one stops working |
| `v1_remove_member(id)` | Owners: marks someone as left. Not yourself. |
| `v1_set_member_role(id, role)` | Owners: make someone an owner or a member again; a Together always keeps an owner |
| `v1_leave_together()` | Marks you as left. The last owner has to hand over first; the last person out deletes the Together. Returns the Together you land in, or null. |
| `v2_chore_reminders()` | Server job only: devices to remind, with chores due in every Together the person is still in (v1 also reminded people who had left) |
| `v1_set_chore_done(id, done)` | Once-off: sets `done_at`. Recurring: logs the completion and moves `due` to the next date after today in the Together's time zone. Monthly keeps the day of the month (31 Jan → 28 Feb → 31 Mar). |
| `v1_item_catalog()` | Your history plus "popular" names. A name counts as popular only when at least 3 Togethers have added it, so one couple's list never leaks. |

`togethers` has no insert policy, so you can only create or join one through these functions.

**Places from Google.** Google's terms only let us store a place's id for good, and its coordinates for 30 days. So a
place saved from a Maps link keeps `google_place_id` (one row per Google place per Together), `lat`/`lng` with
`location_fetched_at` (refreshed when the place is opened and the coordinates are over 30 days old), and our own
`area`/`city`/`province`/`country` labels, prefilled from Google for filtering and grouping. The street, rating, hours
and photo are fetched fresh when the place is shown (`lib/google/places.ts`). `street` is only filled for places
added by hand.

**Triggers.**

- A profile is created for every new auth user. The name comes from sign-up metadata, or the part of the email before the `@`.
- Adding a shopping item bumps `item_history`.
- Logging a visit flips the place to `been`.

**Local ports.** Together's local Supabase stack uses ports 54420–54429, so it can run alongside inboxforge's
(543xx).

**Realtime.** The shared tables are added to `supabase_realtime`, so each person sees the other's changes live.
`wish_claims` is left out on purpose. Realtime applies RLS anyway, but claims don't need to be live.

## Applying it

```bash
just db-link <your-project-ref>
```

```bash
just db-push
```

Then:

1. In the Supabase dashboard, open Auth → Email templates and make the template send `{{ .Token }}`, so users get a
   6-digit code instead of a magic link.
2. Set `USE_STUB_DATABASE=false` and `NEXT_PUBLIC_USE_STUB_DATABASE=false`.
3. Generate types with `just gen-types`. This needs the local stack (`just db-start`).
4. Implement `lib/backend/services/real/server.ts` against these tables.
