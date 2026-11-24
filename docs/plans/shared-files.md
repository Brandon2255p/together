# Plan: shared Gallery and Files (photos, videos and documents)

> **Status: steps 1 (Home shortcuts), 2 (schema, keys, quota, Storage, `lib/files/crypto.ts`) and 3 (Files: drive,
> folders, tags, details sheet, encrypted upload with duplicate skip and the space check) are built; the rest is
> designed, not built.** Until step 5, the Files search box filters the loaded documents in the browser. The Bin button
> on screens 36 and 39 comes with the Bin screen (step 6). The screens are in `design/Together.figcraft` (open it in FigCraft), on the
> **📱 Screens** page: the new Home is **05 Home**, and the rest are under **08 — Files: photos, videos & documents**
> (36–45).

One place where a Together keeps what it shares:

- **Gallery:** photos and videos, ordered by when each was taken.
- **Files:** documents in a simple drive, with one level of folders and tags such as ID, Passport, Car and House.
- **Search** by words, and by year or month.
- **Bin:** deleted items wait there for 30 days and can be restored.
- **Duplicates:** exact copies are noticed and skipped.
- **Who and when:** every item records who added it and when.
- **Quota:** each Together gets 50 GB, and its Together screen shows the usage.
- **Encryption:** each Together has its own key. Files are encrypted before they're stored.

## Design

### Navigation: Home shortcuts, no new tab

The tab bar stays at five (Home, Lists, Calendar, Places, Wishlist). Home is reorganised, top to bottom:

1. **Up next:** the next plan.
2. **At a glance:** counts of things to buy and places to try.
3. **Due today:** chores.
4. **Shortcuts:** a row of four big icon cards: **Calendar**, **Challenges**, **Gallery** and **Files**.

Home now scrolls. Gallery and Files are pushed screens with "‹ Home" and no tab bar, the same pattern as the Together
screen. The Calendar card duplicates its tab, because a shortcut row with one tab destination still reads well and
keeps the four together. Challenges had no tab before, so this card is its main way in.

New on **🧩 Foundations**:

| Component | Props | Code |
|---|---|---|
| File Row | `Name`, `Meta`, `Type` (PDF, JPG, IMG, VID…), `Tags` (boolean) | `components/files/file-row.tsx` |
| icon/folder, image, file, trash, upload, download, restore, play, tag, files | none | `components/ui/icons.tsx` |

The Home shortcut card is built inline on screen 05 (Icon circle in a soft hue, then a label). It becomes
`components/home/shortcut-card.tsx`.

### Screens

| # | Screen | Route / where | Does |
|---|---|---|---|
| 05 | Home (changed) | `/` | Up next, At a glance, Due today, then the four shortcut cards. |
| 36 | Gallery | `/gallery` | "‹ Home", title, then Bin and Upload buttons. One search box for photos and videos. Chips: All, Photos, Videos, Any time. A 3-column grid is grouped by month taken ("November 2026 · 9 photos · 1 video"), newest first. Videos show their length. |
| 37 | Photo viewer | overlay on 36 (`?item=<id>`) | Full screen, dark. Shows the date taken and its place in the month ("3 of 10"). Swipe moves between items. Details: who added it and when, when it was taken, file name and size. Actions: Download, Share and **Move to bin**. |
| 38 | Upload done, duplicates skipped | sheet on 36 or 39 | "12 photos added · 2 skipped". For each skipped file it says who already added it and when ("Adele added it · 3 Nov"). If the copy is in the bin, it offers **Restore it**. |
| 39 | Files (drive) | `/files` | "‹ Home", title, then Bin and Upload. Search box. Tag chips (All, ID, Passport, Car, House…). A 2×2 grid of folders with file counts and **+ New folder**. Then **Recent** as File Rows (name, who · when · size, tags). |
| 40 | Folder | `/files/folders/[id]` | "‹ Files", the folder name, ••• (rename, or delete when empty) and Upload, which adds into this folder. "Search in Car". Files newest first. No sub-folders. |
| 41 | Document details | sheet on 39/40/42 (tap a row) | Type, size and folder. Name. A card with the folder (tap to move), who added it and when, and the tags, with **+ Tag**. Actions: Download, Move and **Move to bin**, then **Open**. |
| 42 | Search results | `/files?q=passport&year=2026` (or `/gallery?q=…`) | Results start in the screen's own kind. Chips: All, Photos, Docs (widen to everything), and the active date ("2026 ✕"). Documents show as rows and photos as tiles. |
| 43 | When? | sheet on 36/39/42 (tap Any time or the date chip) | Year chips (Any, plus each year that has items), then an optional 4×3 month grid. Months with nothing in them are greyed. **Show N results**. Nothing finer than a month. |
| 44 | Bin | `/files/bin` (trash button on 36 and 39) | One bin for photos, videos and documents. A note says items stay 30 days and anyone in the Together can restore them. Each row shows who deleted it, when and the days left, with a Restore button. **Empty bin** (confirm) deletes everything in the bin now. |
| 45 | Together: storage & privacy | `/together` (the existing Together screen, scrolled) | **Storage:** "31.6 GB of 50 GB", a bar split into Photos, Videos, Files and Bin, a row per part with count and size, then "18.4 GB left. Everyone in the Together shares this space." **Privacy:** "Encrypted with your Together's own key". |

When an upload won't fit, the upload sheet says so before anything is sent: "Not enough space: these need 1.2 GB and
0.8 GB is left. Empty the bin or remove something first." At 90% used, Gallery and Files show a small banner linking to
screen 45.

## Data model

The files go in `supabase/schemas/tables/`. The tables follow the existing pattern: `together_id` defaults to
`my_together_id()`, and RLS lets members read and write their current Together's rows.

### `togethers`: the quota

```sql
-- in 02_togethers.sql
storage_quota_bytes bigint not null default 53687091200 check (storage_quota_bytes > 0), -- 50 GB
```

Members may rename their Together (`members rename` policy), so the quota needs its own protection. A
`before update` trigger rejects any change to `storage_quota_bytes` unless the caller is `service_role`. Raising one
Together's quota is then a manual SQL update, which is fine until there are paid plans.

### `25_together_keys.sql`: one key per Together, versioned

```sql
create table public.together_keys (
  together_id uuid not null references public.togethers on delete cascade,
  version int not null check (version > 0),
  vault_secret_id uuid not null,          -- the 32-byte key lives in Supabase Vault, not in this table
  created_at timestamptz not null default now(),
  retired_at timestamptz,                 -- set when a newer version takes over (rotation, later)
  primary key (together_id, version)
);
create unique index together_keys_active_idx on public.together_keys (together_id) where retired_at is null;
```

- **Creating keys:** the first `v1_files_keys()` call for a Together generates 32 random bytes
  (`extensions.gen_random_bytes`), stores them with `vault.create_secret` and inserts version 1, under an advisory lock
  so two members opening the app at once make one key. Existing Togethers get theirs the same way, so the migration
  needs no backfill.
- **Access:** RLS is on and there are no policies, so nobody reads the table directly. Members get their keys through
  `v1_files_keys()` below.
- **Why Vault:** the key is encrypted inside the database, and Vault's root key is managed by Supabase outside it. A
  leaked dump or backup of the tables doesn't reveal file keys. It also adds no new secret to Vercel.

### `26_file_folders.sql`

```sql
create table public.file_folders (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  hue public.hue not null default 'accent',
  created_by uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (id, together_id)
);
create unique index file_folders_name_idx on public.file_folders (together_id, lower(name));
```

Folders have no `parent_id`, so they can only be one level deep. A folder can be deleted only when it's empty (a
foreign key without cascade enforces this), so deleting a folder never deletes files.

### `27_files.sql`

| Column | Notes |
|---|---|
| `id uuid` | also the Storage folder name |
| `together_id uuid` | |
| `kind file_kind` | new enum: `photo`, `video`, `document`. Images uploaded in Files are documents, so a licence-disc photo stays in the drive and out of the gallery. |
| `name text` | the original file name, renamable (1–200 chars) |
| `mime_type text`, `size_bytes bigint` | the plaintext original |
| `stored_bytes bigint` | encrypted original + thumb + preview, as stored; **this is what the quota counts** |
| `key_version int` | which of the Together's keys encrypted it; `(together_id, key_version)` references `together_keys` |
| `content_mac text` | 64 hex characters: HMAC-SHA256 of the plaintext under the Together's dedupe key (see Duplicates) |
| `original_path text`, `thumb_path text null`, `preview_path text null` | Storage object paths |
| `width int`, `height int`, `duration_ms int` | photo and video only |
| `taken_at timestamptz not null` | see "Taken date" below; defaults to `now()` |
| `folder_id uuid null` | documents only (a check enforces it); `(folder_id, together_id)` references `file_folders (id, together_id)` |
| `tags text[] not null default '{}'` | documents only. Lowercased and trimmed by a trigger, at most 10. |
| `uploaded_by uuid` | references `profiles` with `on delete set null`, **not** `together_members`: when someone leaves, what they added stays with the Together |
| `status file_status` | `uploading` or `ready`; only `ready` rows show anywhere |
| `created_at timestamptz` | when it was uploaded |
| `deleted_at timestamptz null`, `deleted_by uuid null` | the bin |

Indexes:

- `unique (together_id, content_mac)` is the duplicate guard. It includes binned rows, so re-uploading something
  that's in the bin offers a restore instead of making a second copy.
- `(together_id, kind, taken_at desc, id) where status = 'ready' and deleted_at is null` serves the gallery's keyset
  pages.
- `(together_id, folder_id, created_at desc) where status = 'ready' and deleted_at is null` serves the drive.
- A GIN index on `tags`. Names are matched with `like` within one Together, which is small enough not to need a
  trigram index.

Quota check: a `before insert` trigger locks the Together's row (`select … for update`). It sums `stored_bytes` over
all its files (uploading, ready and binned) and raises `storage_full` if the new row doesn't fit. The lock serialises
two people uploading at once, so together they can't overshoot.

RLS: members read their current Together's rows. Insert requires `uploaded_by = auth.uid()` and
`status = 'uploading'`. Members can update (rename, move, tag, bin and restore) any row; it's shared space, like the
shopping list. `stored_bytes`, `content_mac`, `key_version` and the paths can't be changed after insert (trigger). **No
delete policy:** only the purge job removes rows.

Suggested tags live in code (`lib/files/tags.ts`): ID, Passport, Car, House, Insurance, Medical, Bank, Tax, Travel,
Warranty, Pets. People can also type their own, and chips show the tags this Together actually uses.

### Functions (`functions_v1/`)

| Function | Does |
|---|---|
| `v1_files_keys()` | Security definer. For the caller's current Together, returns every key version that isn't destroyed, as `{version, key_base64, active}`, read from `vault.decrypted_secrets`. Non-members get nothing. |
| `v1_storage_usage()` | `{quota_bytes, used_bytes, photos: {count, bytes}, videos: {…}, documents: {…}, bin: {…}}` for screen 45 and the upload check. |
| `v1_finish_upload(p_id uuid)` | The uploader only. Reads the real object sizes from `storage.objects.metadata`. If any object is missing, or the total is more than the declared `stored_bytes`, the upload is rejected and stays `uploading` for the purge. Otherwise it sets `status = 'ready'`. |
| `v1_find_duplicates(p_macs text[])` | For each MAC already in this Together, returns `{content_mac, file_id, name, uploaded_by_name, created_at, in_bin}`. |
| `v1_search_files(p_query text, p_kind file_kind, p_year int, p_month int, p_limit int, p_before …)` | Matches words against name, tags, folder name and the uploader's name. Year and month come from `taken_at` in the Together's time zone (as the calendar feed does). Month without year is rejected. |
| `v1_file_months(p_kind file_kind)` | Counts per year and month, for the When sheet (greyed months) and the gallery's month headers. |
| `v1_empty_bin()` | Marks this Together's bin items for immediate purge (sets `deleted_at` 30 days back). The job does the Storage clean-up. |

The gallery, the drive and the folder lists are plain RLS selects through PostgREST, so they need no functions.

## Encryption

**Goal:** what's in the `files` bucket is unreadable without the Together's key, and each Together's key is its own.

**Where it happens:** in the browser, with WebCrypto, before upload and after download. Storage, signed URLs and
Vercel only ever see ciphertext. This also keeps big files out of the server, as before.

- **Keys:** the view-model calls `filesKeys()` once per session (server action → `v1_files_keys()`). It imports the
  keys as non-extractable `CryptoKey`s and keeps them in memory only, never in `localStorage`.
- **Per-file key:** HKDF-SHA256(Together key, salt = file id, info = `"together/file/v1"`) gives each file its own
  AES-256-GCM key. Nonces then never repeat across files, and a single file key reveals nothing about the others.
- **Chunked format** (`lib/files/crypto.ts`), so a 1 GB video never sits in memory twice and can later stream:
  - A 24-byte header: magic `TGF1`, format version, key version, chunk size (4 MiB), and a random 8-byte nonce
    prefix.
  - Then each chunk as AES-GCM ciphertext and tag. The nonce is the header's prefix plus the chunk index. The AAD is
    the file id, the chunk index, and a "last chunk" flag, so chunks can't be reordered, swapped between files or
    truncated.
  - Overhead is 16 bytes per 4 MiB, which is negligible for the quota.
- **Thumbs and previews** are encrypted the same way. The gallery decrypts them into `blob:` URLs (small and fast) and
  revokes them when the tiles scroll away.
- **Viewing:** photos and documents are decrypted to a Blob. Videos are decrypted to a Blob too, which caps them at the
  per-file limit (1 GB) for now. Range-request streaming through a service worker can come later; the chunk format
  already allows it.
- **Downloads** decrypt in the browser and save with the original name.

**What it protects against:** a leaked or misconfigured bucket, leaked signed URLs, and copies of the Storage objects
or database tables. **What it doesn't:** this isn't end-to-end encryption. A member's signed-in browser can fetch the
key, and so could someone with full control of the Supabase project (Vault decrypts for privileged roles). End-to-end,
with the key wrapped per member device, would be a later, much bigger step.

**Not encrypted:** file names, tags, folder names, dates and sizes stay plaintext in Postgres (which Supabase encrypts at
rest), because search and the gallery need them. Thumbnails are re-rendered from pixels, so they carry no EXIF or GPS.
Originals keep theirs, inside the encryption.

**Rotation (later, not built now):**

1. Insert key version N+1 and retire N.
2. New uploads use N+1.
3. A re-encryption pass (a member's browser, or a server worker, in batches) downloads, decrypts with N, re-encrypts
   with N+1, recomputes `content_mac`, uploads and swaps the paths.
4. When no file uses N, its Vault secret is deleted.

The `key_version` column, the versioned `together_keys` table and `v1_files_keys()` returning every version are there
so that this needs no schema reshuffle.

## Storage

- **Private bucket `files`** in `supabase/config.toml` (`[storage.buckets.files]`, `public = false`,
  `file_size_limit = "1GiB"`).
- **Paths:** `<together_id>/<file_id>/original.bin`, `thumb.bin` (≈400 px WebP, for grid tiles) and `preview.bin`
  (≈1600 px WebP, for the viewer), all encrypted. The extension is `.bin` because the content is ciphertext; the real
  type is in `mime_type`. For videos, the thumb is the poster frame.
- **Storage RLS** on `storage.objects`:
  - **Read:** a member may read when `(storage.foldername(name))[1]` is their current `together_id`.
  - **Insert:** only into a path whose `files` row exists, is `uploading` and was inserted by the caller. Nobody can
    park bytes outside the quota.
  - **Update or delete:** nobody; the purge job uses the secret key.
- **Uploads**, for each file:
  1. The browser hashes (MAC), checks duplicates and encrypts.
  2. A server action inserts the row (`uploading`, with `stored_bytes` = ciphertext sizes; the quota trigger runs
     here) and returns signed upload URLs.
  3. The browser uploads the three objects straight to Storage, so Vercel's request body limit never applies. Objects
     over 6 MB use resumable (TUS) uploads.
  4. It calls `finishUpload`, which runs `v1_finish_upload`.

  Rows still `uploading` after a day are removed by the purge job, which frees their quota.
- **Reads** use signed URLs (`createSignedUrls`, batched per page, valid for an hour). The gallery loads only thumbs; the
  viewer loads the preview; the original is fetched only by Download.

## Quota and usage

- **Limit:** 50 GB per Together (`togethers.storage_quota_bytes`). It's shared by all members, and every upload by
  anyone counts against it.
- **What counts:** `stored_bytes` of every row, including the bin and uploads in progress. Emptying the bin frees space
  at the next purge, and the usage screen says so.
- **Checks:**
  - **Early, for a clear message:** the upload sheet adds up the selection (after duplicates are dropped) and compares
    it with `v1_storage_usage()`. If it doesn't fit, it says how much is needed and how much is left, and sends nothing.
  - **Enforced:** the insert trigger, and then `v1_finish_upload`'s size check.
- **Cost note:** Supabase Pro includes 100 GB of Storage, then charges per GB. Two full Togethers fill the included
  amount, so watch total usage across Togethers before inviting many.

## Duplicates (exact file)

1. The browser computes HMAC-SHA256 of each selected file with the Together's dedupe key (HKDF of the Together key,
   info `"together/dedupe/v1"`). It runs in chunks with `hash-wasm`, so a large video isn't held in memory.
   - A keyed MAC is used instead of a plain SHA-256 so that someone with database access can't check whether a known
     file (say, a public photo) is in a Together.
   - Equal files still give equal MACs within a Together, which is all deduplication needs.
2. One `v1_find_duplicates` call covers the whole selection. Matches are dropped before upload, and screen 38 lists them
   with who added each one. A match in the bin offers **Restore it**.
3. Duplicates inside one selection are collapsed in the browser.
4. Two people uploading the same file at once are caught by the `(together_id, content_mac)` unique index. The loser
   gets a "skipped" result, not an error.

Only byte-for-byte copies count. A re-saved or resized copy of a photo is a different file. Near-duplicate detection
(perceptual hashes) is out of scope.

## Thumbnails and the taken date

These are generated **in the browser, before encryption and upload**. The device already has the file decoded, and the
server never sees plaintext, so it couldn't make them anyway.

| Kind | Thumb / preview | Taken date | Also |
|---|---|---|---|
| Photo | `createImageBitmap` → `OffscreenCanvas` → WebP, honouring EXIF orientation | EXIF `DateTimeOriginal` with its offset (via `exifr`); otherwise the file's `lastModified`; otherwise the upload time | width and height |
| HEIC (iPhone) | Safari decodes it. Elsewhere it's decoded with lazily loaded `heic2any`. If that fails, it's uploaded without a thumb and the grid shows a placeholder tile. | EXIF via `exifr` (reads HEIC) | |
| Video | `<video>` seeked to ~1 s, drawn to canvas for the poster | MP4/MOV `creation_time` (via `mp4box` or `exifr`); otherwise `lastModified` | `duration_ms` |
| Document | none; the row shows a type tile (PDF, JPG, DOCX…) | upload time | a PDF first-page preview could come later |

Supabase Image Transformations can't help here, because the stored objects are encrypted.

## The bin

- **Move to bin** sets `deleted_at = now()` and `deleted_by = auth.uid()`. The objects stay in Storage and still count
  towards the quota. The item disappears from the gallery, the drive and search.
- **Restore** clears both columns. A binned document whose folder no longer exists comes back with no folder.
- **Days left** is shown as `30 − days since deleted_at` (helper in `lib/files/bin.ts`, tested).
- **Purge job** `app/api/cron/purge-bin`, daily in `vercel.json`, through `JobsBackendService.purgeBin()` with the
  secret key:
  1. Select rows binned more than 30 days ago, and stale `uploading` rows.
  2. Remove their Storage objects in batches of 100.
  3. Delete the rows.

  It's idempotent: a row is deleted only after its objects are gone.
- **Empty bin** (with confirm) calls `v1_empty_bin()`, so the next purge picks the items up.

## Search

- Each screen's box searches names, tags, folder names and who added an item. Gallery starts with photos and videos,
  and Files with documents; the All chip widens the search to everything.
- Year and month are the only date refinements; the When sheet has no day picker. The date chip shows "2026" or
  "Nov 2026" with ✕ to clear.
- Matching uses `like` on lowercased text, within one Together (at most a few thousand items), so neither a trigram
  index nor full-text ranking is worth it yet. File contents aren't searchable, since they're encrypted.

## Code (MVVM)

| Layer | New |
|---|---|
| `lib/models/files.ts` | `FileKind`, `SharedFile`, `FileFolder`, `DuplicateMatch`, `MonthGroup`, `FileSearch`, `StorageUsage`, `FilesKey` |
| `lib/files/` (pure, tested) | `group-by-month.ts`, `bin.ts` (days left), `tags.ts` (suggested and normalise), `search-params.ts` (`q`, `kind`, `year`, `month` to and from the URL), `type-label.ts` (mime to PDF, JPG…), `usage.ts` (bar segments, "18.4 GB left", fits/doesn't fit), `crypto.ts` (HKDF, chunked AES-GCM encrypt/decrypt, header, dedupe MAC; WebCrypto exists in Node, so Vitest covers round trips, tampering, truncation and reordering) |
| `lib/files/client/` (browser only) | `thumbnails.ts`, `taken-at.ts`, `keyring.ts` (imports keys and holds them in memory). They touch Canvas, File and Blob APIs, so the view-models call them; components don't. |
| `ServerBackendService` | `filesKeys`, `storageUsage`, `gallery`, `documents`, `folder`, `searchFiles`, `fileMonths`, `findDuplicates`, `startUpload`, `finishUpload`, `renameFile`, `moveFile`, `setFileTags`, `moveToBin`, `restoreFile`, `listBin`, `emptyBin`, `createFolder`, `renameFolder`, `deleteFolder`, `signedFileUrls` |
| `JobsBackendService` | `purgeBin()` |
| Stub backend | A fixed key per seed Together, and seed folders, documents and photos (encrypted at seed time, so the decrypt path is exercised). Upload stores ciphertext in memory, duplicates are matched by MAC, and the quota is enforced, so every screen works with `USE_STUB_DATABASE=true`. |
| `lib/actions/files.ts` | one server action per backend method |
| Routes | `app/gallery/` (viewer via `?item=`), `app/files/`, `app/files/folders/[id]/`, `app/files/bin/`, each with `page.tsx`, `view.tsx` and `view-model.ts`. Search via `?q=&year=&month=` on Gallery and Files. |
| `components/files/` | `gallery-grid`, `month-header`, `photo-viewer`, `upload-sheet`, `drive`, `folder-card`, `file-row`, `document-sheet`, `when-sheet`, `bin-list` |
| `components/home/` | `shortcut-card`, and the Home screen reordered (Up next, At a glance, Due today, Shortcuts) |
| `components/together/` | `storage-card` (bar and rows) and `privacy-card` on the Together screen |

Tests:

- `supabase/tests/schema.test.mjs`:
  - RLS: other Togethers can't see files or keys.
  - Every Together gets a key, including existing ones after the migration.
  - `v1_files_keys()` returns nothing to non-members.
  - The quota trigger rejects an insert over 50 GB, and two concurrent inserts can't both squeeze in.
  - Members can't change `storage_quota_bytes`.
  - Storage insert is refused without a matching `uploading` row.
  - The duplicate index works, and the bin hides items.
  - `v1_search_files` filters by year and month, in the Together's time zone.
  - Members can't hard-delete.
- Vitest covers the `lib/files` helpers, the crypto above all.

## Build order

Each step is its own PR and works on the stub backend first.

1. **Home shortcuts:** reorder Home and add the four cards. Gallery and Files open placeholder screens. Small, and it
   ships the new navigation on its own.
2. **Schema, keys, quota and Storage:**
   - quota column, `together_keys` with Vault, tables, enums and triggers;
   - bucket and policies, functions and DB tests;
   - `lib/files/crypto.ts` with its tests;
   - the generated migration.
3. **Files (documents):** drive, folders, tags, details sheet, and encrypted upload with duplicate skip and the space
   check (screens 39, 40, 41, 38).
4. **Gallery:** browser thumbnails and taken dates, decrypted grid by month, viewer (36, 37).
5. **Search:** boxes, kind chips, When sheet (42, 43).
6. **Bin and usage:** move to bin, restore, Empty bin, purge cron (44), and the storage card on the Together screen
   (45).

## Open questions

- **Video size.** The per-file limit is set at 1 GB, because videos are decrypted to a Blob for playback. Should that
  limit be raised later, which needs streaming decryption through a service worker?
- **Original quality.** Keep originals as uploaded (current plan), or re-encode large videos? Re-encoding needs a
  server worker that could decrypt, which goes against keeping the server out of the plaintext.
- **Sharing out.** Share in the viewer uses `navigator.share` with the decrypted file. Public links can't work while
  files are encrypted with a key only members can fetch, so they aren't planned.
