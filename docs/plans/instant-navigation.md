# Instant navigation: audit and plan

**Problem.** Tapping a link to a screen that loads data on the server leaves the old screen frozen until the new one
has loaded. Nothing shows the tap landed, so people tap again, and the second tap starts the navigation over.

**Why it happens (Next 16).** Every screen in `app/(app)` is dynamic (`await connection()`). For a dynamic route,
`<Link>` prefetches only up to the nearest `loading.tsx`. **Without a `loading.tsx` there's no prefetch at all, so the
client waits for the server to render the whole page before it changes anything.** With one, the skeleton is
prefetched and the screen changes the moment you tap. (See `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`,
"Dynamic routes without loading.tsx".)

Three other things make it worse:

- The stub backend answers in 120 ms (`LATENCY_MS` in `lib/backend/services/stub/server.ts`), so in dev this is hard to
  notice. Against Supabase each page makes 2–3 round trips one after another.
- No link shows that it's pending (`useLinkStatus` isn't used anywhere), not even in the tab bar.
- View-models that save something and then `router.push` wait for the save, then wait again for a destination that
  has no skeleton. Some of them stop showing "pending" before the navigation starts.

---

## 1. Catalog

### A. Screens with no loading boundary: the tap blocks until the server is done

| Screen | Reached from | What it loads before anything changes |
|---|---|---|
| `/challenges` | Home flame pill (Link), the back button on a challenge (Link), **deleting a challenge** (`router.push` after `await deleteChallenge`) | `requireTogether` + `getChallenges` |
| `/challenges/[id]` | challenge cards (Link), **starting a challenge** (`router.push` after `await addChallenge`) | `requireTogether`, **then** `getChallenge` (one after the other) |
| `/gallery` | Home shortcut (Link) | `requireTogether` + `getGallery(null, 60)` + `galleryMonths` |
| `/files` | Home shortcut (Link), "‹ Files" in a folder (Link), **deleting a folder** (`router.replace` + `refresh` after `await deleteFolder`) | `requireTogether`, **then** `getDocuments` |
| `/files/folders/[id]` | folder rows (Link) | `requireTogether`, **then** `getDocuments` (every document, to check the folder exists) |
| `/profile` | Home avatar button (Link) | `requireTogether` |
| `/onboarding/invite` | starting a Together in onboarding (`router.push`) | `getTogether` |
| `/join/[code]` | invite links (usually a full page load, so less visible) | `getInvitePreview` + `getTogether` |

### B. Screens that show the wrong skeleton (they inherit a parent's `loading.tsx`)

`loading.tsx` also covers every route below it, so these flash a different screen's skeleton, then jump.

| Screen | Inherits | What it loads |
|---|---|---|
| `/places/new` | `places/loading.tsx`: the Places list | `requireTogether`, then `getPlaces` + **`previewGooglePlace`** (a Google call) when `?place=` is set, + `getPlace` when `?replace=` |
| `/places/new/manual` | `places/loading.tsx`: the Places list | `requireTogether` only |
| `/places/[id]/edit` | `places/[id]/loading.tsx`: the place detail | `requireTogether`, then **`getPlaceWithGoogle`** (a Google call) |

### C. Save, then navigate: two waits back to back

| Where | What happens | Problem |
|---|---|---|
| `challenges/view-model.ts` `submit` | `await addChallenge` → `setPending(false)` → close sheet → `router.push("/challenges/[id]")` | Pending ends before the navigation, and the destination has no skeleton: the list sits there with no feedback, and tapping the new card restarts the navigation |
| `challenges/[id]/view-model.ts` `onDelete` | `await deleteChallenge` → `router.push("/challenges")` | **No pending state at all**, so a second tap sends a second delete. The destination has no skeleton |
| `files/view-model.ts` `deleteThisFolder` | `await deleteFolder` → `router.replace("/files")` + `router.refresh()` | `/files` has no skeleton. The `refresh()` right after `replace` can render the page twice |
| `togethers/view-model.ts` `goHome`, `create` | `router.push(...)` + `router.refresh()` | The overlay covers the wait, but `refresh()` straight after `push` may do the server render twice |
| `join/[code]/view-model.ts` | `router.replace("/home")` + `router.refresh()` | Same double render |
| `places/new/view-model.ts` (manual link) | `router.push("/places/new/manual?…")` | Shows the Places list skeleton (B) |

Saves that go to a screen that *has* a skeleton (`/places/[id]` after adding or editing a place, `/places` after
deleting one) are fine.

### D. Screens that have a skeleton but are still slow (server round trips one after another)

Each page awaits `requireTogether()` before (or alongside, then after) its real reads, so it takes at least two trips
to the database:

| Page | Waterfall |
|---|---|
| `home` | `requireTogether` → 6 reads in parallel |
| `lists`, `calendar`, `places/[id]` | `requireTogether` (+params) → reads in parallel |
| `places` | `requireTogether` → `getPlaces` |
| `together` | `requireTogether` → `storageUsage` |
| `togethers` | `requireTogether` → `listMyTogethers` |
| `wishlist` | `requireTogether` → wishes + goals (needs the partner's id, so one wait is real) |
| `files`, `files/folders/[id]`, `challenges/[id]`, `places/[id]/edit` | same, and no skeleton (A/B) |

### Fine as they are

`/sign-in`, `/verify`, `/onboarding/together`, `/design-system` (no server data). `/home`, `/lists`, `/calendar`,
`/places`, `/places/[id]`, `/wishlist`, `/together`, `/togethers` have their own skeleton, so they change on tap
(they're still slowed by D).

---

## 2. Plan to fix it

In order of impact. Steps 1 and 2 fix the "tap and nothing happens"; 3 and 4 make the wait itself shorter.

### Step 1: a skeleton for every screen that loads data

Add a `loading.tsx` beside each page in A and B, shaped like that screen (the real title, then placeholders), using
`ScreenSkeleton` / `Skeleton` from `components/ui/skeleton.tsx`. New skeleton components go in `components/<feature>/`
like `place-detail-skeleton.tsx`.

| Route | Skeleton |
|---|---|
| `challenges` | `ScreenSkeleton title="Challenges" rows={3}` with card-sized rows |
| `challenges/[id]` | new `ChallengeSkeleton`: back button, title, progress ring, goal rows |
| `gallery` | new `GallerySkeleton`: "‹ Home", title, photo grid |
| `files`, `files/folders/[id]` | new `DocumentsSkeleton`: back link, title, folder/file rows |
| `profile` | `ScreenSkeleton title="You"` + a few rows |
| `places/new`, `places/new/manual` | new `PlaceFormSkeleton`: close button, search field / form fields |
| `places/[id]/edit` | `PlaceFormSkeleton` |
| `onboarding/invite`, `join/[code]` | simple centred skeleton |

Also add **`app/(app)/loading.tsx`** with a neutral `ScreenSkeleton` as a safety net, so a screen added later without
its own skeleton still changes on tap instead of freezing.

### Step 2: show every tap straight away

- **Links:** add a `useLinkStatus` pending state to the design system: a small `LinkPending` indicator, or a
  `data-pending` style on cards and tab-bar items (dim plus a hairline progress after ~100 ms, so fast navigations
  don't flicker). Use it in the tab bar, the Home shortcut cards and pills, the challenge cards, the folder rows, and
  the place rows. Show it in `/design-system`.
- **Save then navigate:** in view-models, wrap the navigation in `startTransition` and keep the control pending
  until the transition finishes:
  ```ts
  const [navigating, startNavigation] = useTransition();
  // ...after the save succeeds:
  startNavigation(() => router.push(href));
  // expose pending || navigating to the screen
  ```
  Apply to challenge create (don't `setPending(false)` on success) and challenge delete (add a pending state and
  ignore taps while it's set: this also stops the double delete). Do the same in files `deleteThisFolder`.
- **Drop `router.refresh()` straight after `push`/`replace`** to a dynamic route (`togethers`, `join`, `files`).
  The navigation already renders the destination fresh. Check each case by hand: `togethers` may need it to drop
  other routes' cached data after switching Together. If so, refresh first, or leave a comment saying why.

### Step 3: cut the server waterfalls

- Start every read **at the same time as `requireTogether()`**, then await the Together first so the onboarding
  redirect still wins:
  ```ts
  const togetherP = requireTogether();
  const choresP = getChores(); // ...
  const together = await togetherP;
  const [chores, ...] = await Promise.all([choresP, ...]);
  ```
  (Catch the reads' promises so an early redirect doesn't leave an unhandled rejection.) Wishlist still needs one
  wait for the partner's id.
- Wrap `getTogether` (and any read several server calls make in one request) in React `cache()`, so a request
  resolves membership once. Check whether `serverBackend` already looks up the Together inside each read; if so,
  that's another hidden round trip per read.
- `/files/folders/[id]` loads every document to check one folder exists. Add a single-folder read, or let the
  screen show "not found" from the data it already has.

### Step 4: stream the slow, optional parts

Google calls (`previewGooglePlace`, `getPlaceWithGoogle`) and extras (`storageUsage`, Home's `togethers` and
`challenges`) shouldn't hold back the whole screen. Move each into its own async Server Component inside
`<Suspense>` with a small placeholder, so the screen renders and that part fills in.

---

## 3. Plan to never let it happen again

1. **A test that fails without a skeleton.** Add `app/routes.test.ts` (vitest, already in `pnpm test` / `pnpm ci`).
   It walks `app/**/page.tsx` and fails when a page that awaits data (`async function` plus `await`) has no
   `loading.tsx` **in its own folder**. An inherited one doesn't count, because it's the wrong skeleton. Pages with
   no data go on an explicit allowlist with a reason. This needs no lint change.
2. **Make slowness visible in dev.** Let `STUB_LATENCY_MS` override the stub's 120 ms (default it to ~600 in
   `.env.example`), so a missing skeleton or a waterfall is obvious on `pnpm dev`, not only in production.
3. **Write it down in `AGENTS.md`** under "Where IO happens":
   - Every `page.tsx` that loads data has its own `loading.tsx` shaped like the screen.
   - Start a page's reads in parallel. Never `await requireTogether()` on its own line before them.
   - After a save, navigate inside `startTransition` and keep the control pending until it finishes. No
     `router.refresh()` straight after `push`/`replace` without a comment.
   - Links that go to another screen show a pending state (the design-system indicator).
4. **Optional lint rule (needs your OK, since it's an `eslint.config.mjs` change).** A `no-restricted-syntax` rule
   in `app/**/view-model.ts` that flags `router.push`/`router.replace` outside a `startTransition` callback.
5. **Review checklist:** when a PR adds a route, the PR shows its skeleton, a screenshot of `loading.tsx` on a
   throttled connection.
