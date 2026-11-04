# Plan: members, many Togethers, and richer Places

> **Status: built.** Everything below shipped in PRs #3–#10 (merged 4 November 2026). Two places differ from this
> plan: the stored-Google-data question was settled in #3 (only the place ID and 30-day coordinates are kept), and the
> `place_address` and `many_togethers` migrations have the names the PRs gave them. This file is kept as the design
> record.

Designs are in Figma, on the **📱 Screens** page:

- [Section 04, members & your Togethers](https://www.figma.com/design/PpfaPk3jkZjwmsL4JeNzYJ/Together?node-id=27-843): screens 14–18.
- [Section 05, Places](https://www.figma.com/design/PpfaPk3jkZjwmsL4JeNzYJ/Together?node-id=30-1088): screens 19–24.

Each screen has a motion note under it.

New components are on **🧩 Foundations**:

| Component | Props | Code |
|---|---|---|
| Member Avatar | `Tone` = Accent, Partner, Success, Warning; `Initial` | extend `components/ui/avatar.tsx` |
| Member Row | `Name`, `Detail`, `Owner`, `Actions` | `components/together/member-row.tsx` |
| Together Bubble | `Tone`, `Name`, `Detail` | `components/together/bubble-scene.tsx` (Three.js) |

## Screens

| # | Screen | Route / where | Does |
|---|---|---|---|
| 14 | Together: members | `/together` (tap avatars on Home) | Name and members, with an Owner chip. Invite row. Invite code with Copy and Share. Leave. |
| 15 | Member actions sheet | sheet on 14 (owner taps •••) | Make owner. Remove from Together, with a second confirm. |
| 16 | Invite sheet | sheet on 14 | 6 code boxes, join link, Share (`navigator.share`, falls back to copy), Make a new code. |
| 17 | Your Togethers | `/togethers` (tap the pill on Home) | Every Together as a Three.js bubble, sized by recent activity. Drag spins the cluster; tap zooms in and switches. Also has Join with a code and Start a new one. |
| 18 | Home: switcher pill | `/home` header | A pill showing the current Together opens 17. A dot means another Together has new activity. |
| 19 | Places by area | `/places` | Filter chips under the tabs; the list is grouped by City · Province · Country. The card shows the street. |
| 20 | Filter & sort sheet | sheet on 19 | Country, then province, then city, each counted from this Together's places. Sort by Top rated, Recently visited, Nearest, or A to Z. |
| 21a | Add place: search Google | `/places/new` | One search box with Google Places Autocomplete. The matched text is highlighted, and "Google Maps" attribution sits under the results. Pasting a Maps link finds the same place. "Can't find it? Add it by hand" leads to 21c. |
| 21b | Add place: picked | `/places/new?place=…` | Preview of the chosen place: Google photo with credit, name, full address, Google rating, price level and open now. Kind is preselected from Google's type. Then status and Add place. |
| 21c | Add place: by hand | `/places/new/manual` | Fallback for places Google doesn't have: name, kind, street, city, province and country. No Google ID. |
| 22 | Edit place | `/places/[id]/edit` (••• on detail) | For a Google place, the address is a locked card with Change place (search again) and Unlink (becomes a by-hand place). By-hand places keep the editable fields. Delete. |
| 23 | Place detail: address | `/places/[id]` | Google photo hero with its credit, Google rating chip, and address with today's hours. Tapping the address opens Google's `googleMapsUri`. Floating "Log a visit" button. |
| 24 | Log a visit sheet | sheet on 23 | When (Today, Yesterday, or a date), what, a note, your own rating. Saving marks the place Been. |

## Data changes (schema → `just create-migration`)

### Many Togethers per person

The schema today assumes one Together per person: `together_members.unique (profile_id)`, two people per Together
(`unique (together_id, tone)`), and `my_together_id()` reads the single membership. To change that:

1. **Membership.**
   - Drop `unique (profile_id)` and `unique (together_id, tone)`.
   - Add `role public.member_role not null default 'member'`, with a new enum `member_role` of `owner` and `member`.
     The creator is `owner`.
2. **Tones.**
   - Extend `member_tone` to `accent`, `partner`, `success`, `warning`.
   - Assign tones in join order, repeating after four. The Figma Member Avatar has all four.
3. **Current Together.**
   - Add `profiles.current_together_id uuid references togethers on delete set null`.
   - `my_together_id()` returns it, but only while the person is still a member of it. Every existing policy keeps
     working unchanged, because they all go through `my_together_id()`.
4. **Invite codes.**
   - Add `togethers.invite_expires_at timestamptz`, 48 hours after the code is made.
   - Joining with an expired code fails with "That code has expired".
5. **Profiles policy.** Members can read the profiles of people in **any** Together they share with them, not just the
   current one. The switcher (17) needs this for its avatars.

New and changed functions (versioned, `functions_v1` / `functions_v2`):

| Function | Change |
|---|---|
| `v2_join_together(code)` | Adds a membership even when you're already in other Togethers, then switches to the new one. Keep `v1` until the app no longer calls it. |
| `v2_create_together(name)` | Creates a Together with you as `owner` and makes it current. |
| `v1_switch_together(id)` | Sets `current_together_id` (must be a member). |
| `v1_list_my_togethers()` | id, name, member count, your tone, and `last_activity_at`. Bubble size comes from `last_activity_at`. |
| `v1_new_invite_code()` | Owner only. A fresh code with a new expiry; the old code stops working. |
| `v1_remove_member(profile_id)` | Owner only. You can't remove yourself this way. |
| `v1_set_member_role(profile_id, role)` | Owner only. Never leaves a Together with no owner. |
| `v1_leave_together()` | Replaces the `leave` delete policy. The last owner must hand over ownership or be the last member; the last member leaving deletes the Together. Switches you to another Together, or null (onboarding). |

### Places (Google Places API, New)

Places come from Google first; adding one by hand is the fallback.

**Calls**

All calls run on the server, from server actions. The key never reaches the browser.

| When | Call | Fields (field mask) | Billing |
|---|---|---|---|
| Typing in 21a | `places:autocomplete` | suggestions only | Free when the session ends in a Details call |
| Pasted Maps link | `places:searchText` with the link's name or coordinates | `places.id` | Text Search (IDs Only) |
| Picking a result (21b), then saving | `places/{id}` | `id, displayName, formattedAddress, addressComponents, location, primaryType, rating, userRatingCount, priceLevel, currentOpeningHours.openNow, photos, googleMapsUri` | Place Details; closes the session token |
| Opening 23 | `places/{id}` | rating, hours, photos, `googleMapsUri` | Place Details |
| Photo | `{photo.name}/media?skipHttpRedirect=true&maxWidthPx=800` | returns a key-free `photoUri` | Place Photo |

- Each add flow uses a single session token, from the first keystroke to the Details call.
- Autocomplete is biased to the device location when allowed, otherwise to the city most of this Together's places
  are in.
- Google's `primaryType` maps to our kind: `restaurant` → Restaurant, `cafe`/`coffee_shop` → Café,
  `bar` → Bar, `bakery` → Bakery, `hiking_area`/`park` → Hike, anything else → Other. The mapping lives in
  `lib/places/google-types.ts`, with tests.
- From `addressComponents`:
  - `country` is the country.
  - `administrative_area_level_1` is the province or state.
  - `locality` is the city, falling back to `postal_town`.
  - `sublocality` or `neighborhood` is the area.
  - `route` and `street_number` make up the street.

**Google's caching rules shape the schema.** Under the Maps Platform terms we may keep a place ID indefinitely, and
latitude/longitude for up to 30 days. Other Places content (name, address, rating, hours, photos) is meant to be
fetched fresh, not stored. So:

- Store `google_place_id` permanently.
- Store `lat` / `lng` with `location_fetched_at`, refreshed when older than 30 days. "Nearest first" sorting uses them.
- The place's **name** and **kind** are ours, since the user can rename and re-kind a place. The **address** fields
  (`street`, `area`, `city`, `province`, `country`) are what the filter and grouping in 19–20 need.
  - **Before shipping, check the current Places API policy** on whether storing them counts as caching.
  - If it does, keep only `country`, `province` and `city` as user-confirmed labels, and fetch the full address,
    rating, hours and photo on view (23) with a short in-memory cache.
- Rating, price, hours and photo are never stored. They're fetched for 21b and 23, and shown with Google's
  attribution: "Google Maps" text, and each photo's `authorAttributions`.

**Schema**

1. Add these to `places`:
   - `google_place_id text unique per together` (null for by-hand places).
   - `street`, `city`, `province`, `country`: text, default `''`, up to 80 characters.
   - `lat double precision`, `lng double precision`, `location_fetched_at timestamptz`.
   - `area` stays as the suburb or neighbourhood.
   - An index on `(together_id, country, province, city)`.
   - Uniqueness: one row per `(together_id, google_place_id)`. Adding the same Google place twice opens the existing
     one.
2. `maps_url` is replaced by `google_place_id`: the detail screen gets `googleMapsUri` fresh. By-hand places open a
   Maps search for their address.

**Env**

- `GOOGLE_MAPS_API_KEY` is server-only. It never gets a `NEXT_PUBLIC_` prefix, and it goes in Coolify and the README's
  env table.
- Restrict the key to the Places API (New) and to the server's IP.
- The stub backend returns canned autocomplete and details for "Kloof", "Nobu" and so on, so the flow works offline
  and in CI.

**Other Places changes**

1. **Visit ratings.** `visits.rating` is per visit and per person (`created_by`). Logging a visit with a rating also
   upserts that person's row in `place_ratings`.
2. **Retire the Maps link parser.** The Maps short-link parser in `lib/places` (PR #1) is no longer how places get
   added. A pasted link goes to `places:searchText` to find its place ID instead. Keep the parser only to pull the
   name or coordinates out of the link for that search.

## App changes (MVVM)

- **Models** (`lib/models`):
  - `MemberTone` gets four values. `Member` gets `role`.
  - New `TogetherSummary` (`id`, `name`, `memberCount`, `tone`, `lastActivityAt`).
  - `Together` gets `inviteExpiresAt`.
  - `Place` gets `googlePlaceId`, `street`, `city`, `province`, `country` and `location`.
  - `NewPlace` is either `{ googlePlaceId, kind, status }` or the by-hand form.
  - New `PlaceSuggestion` (`placeId`, `name`, `secondary`, `matches`) and `GooglePlaceDetails` (address parts, rating,
    price, open now, photo URI and credit, `googleMapsUri`). Details are never stored, only shown.
  - New `PlaceFilter` (`country`, `province`, `city`, `sort`).
- **`ServerBackendService` additions** (stub and Supabase):
  - Togethers: `listMyTogethers`, `switchTogether`, `newInviteCode`, `removeMember`, `setMemberRole`, `leaveTogether`.
  - Places: `autocompletePlaces({ input, sessionToken })`, `getGooglePlace({ placeId, sessionToken })`,
    `findPlaceFromLink({ url })`, `updatePlace`, `unlinkPlace`, `deletePlace`, `logVisit`.
  - The Google calls live in `lib/google/places.ts` (fetch plus field masks), used by the real backend. The stub has
    canned data.
- **Pure helpers, with tests:**
  - `lib/places/address.ts`: grouping, the cascading filter options with counts, and sorting (including by distance).
  - `lib/places/google-types.ts`: Google type to kind, and `addressComponents` to our address fields.
  - `lib/together/bubbles.ts`: bubble size and layout from activity, and a stable tone per Together.
- **Routes:**
  - `app/(app)/together` (14–16) and `app/(app)/togethers` (17).
  - `app/(app)/places/new` (21a–b, search and preview in one view-model, which owns the session token).
  - `app/(app)/places/new/manual` (21c) and `app/(app)/places/[id]/edit` (22).
  - Sheets 20 and 24 live in the places view-models.
- **3D bubbles:**
  - `components/together/bubble-scene.tsx` reuses the Three.js setup in `components/ui/orb-scene.tsx`.
  - Spheres use the existing tone gradient. Drag rotates the cluster group; a raycast picks the bubble that was tapped.
  - On a tap, the camera tweens to the bubble, then the view-model calls `switchTogether` and does a `router.refresh()`.
  - Respect `prefers-reduced-motion`: show a static grid of the same bubbles instead.
- **Design system:** add Member Avatar tones, Member Row and the bubble scene to `/design-system`.

## Order of work

1. Schema: membership roles and tones, `current_together_id`, functions, then `pnpm test:db` with new checks in
   `supabase/tests/schema.test.mjs`, then `just create-migration many_togethers`.
2. Backend interface, stub seed (a second and third Together for Brandon), Supabase implementation.
3. Screens 14–16 (members, invite), then 18 and 17 (switcher pill, then the bubbles).
4. Schema: `google_place_id`, address and location columns, then `just create-migration google_places`.
   Separately, add `GOOGLE_MAPS_API_KEY` to the env docs and Coolify.
5. `lib/google/places.ts` and the stub, then screens 21a–b (search and preview), 21c (by hand), 23 (detail), 22
   (edit), 24 (log a visit), then 19–20 (filter and sort).

Steps 1–3 and 4–5 touch separate tables and screens, so the two halves can be built in parallel.

## Open questions

- Should Places, Lists and the Calendar ever show items from all Togethers at once (an "Everything" bubble), or only the
  current one? The plan assumes the current one only.
- Can members (not just owners) make a new invite code? The plan says owners only.
- Storing address parts (city, province, country) for filtering: confirm this is allowed under the current Places API
  terms, or fall back to user-confirmed labels (see the caching rules above).
- "Nearest first" asks for the device location. Is that prompt worth it in the first version?
