-- Shared photos, videos (the Gallery) and documents (Files). The bytes are in the private Storage bucket "files",
-- encrypted in the browser with the Together's key (lib/files/crypto.ts), at <together_id>/<id>/original.bin, plus
-- thumb.bin and preview.bin for photos and videos.
--
-- Uploading: insert the row (status 'uploading'; the quota is checked here, triggers/files_quota.sql), upload the
-- objects (storage.sql only allows paths of your own uploading rows), then v1_finish_upload checks their real sizes
-- and makes the row 'ready'.
--
-- The bin: deleted_at set. Nothing is hard-deleted by members (no delete policy); the purge job removes rows and
-- objects 30 days later. See docs/plans/shared-files.md.

create table public.files (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  kind public.file_kind not null,
  -- the original file name, renamable
  name text not null check (char_length(btrim(name)) between 1 and 200),
  mime_type text not null check (char_length(mime_type) between 1 and 200),
  -- the plaintext original
  size_bytes bigint not null check (size_bytes >= 0),
  -- every encrypted object of this file, as stored: what the quota counts
  stored_bytes bigint not null check (stored_bytes > 0),
  key_version integer not null,
  -- HMAC-SHA256 of the plaintext under the Together's dedupe key: equal files, equal MACs
  content_mac text not null check (content_mac ~ '^[0-9a-f]{64}$'),
  original_path text not null,
  thumb_path text,
  preview_path text,
  width integer check (width > 0),
  height integer check (height > 0),
  duration_ms integer check (duration_ms >= 0),
  -- when a photo or video was taken (EXIF, else the file's date); for documents, when it was added
  taken_at timestamptz not null default now(),
  folder_id uuid,
  tags text[] not null default '{}',
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  status public.file_status not null default 'uploading',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,

  -- the duplicate guard; binned files count, so re-adding one offers a restore instead
  unique (together_id, content_mac),
  foreign key (together_id, key_version) references public.together_keys (together_id, version),
  foreign key (folder_id, together_id) references public.file_folders (id, together_id) on delete set null (folder_id),
  -- objects live under the file's own folder, so a row can't claim another Together's objects
  check (original_path = together_id::text || '/' || id::text || '/original.bin'),
  check (thumb_path is null or thumb_path = together_id::text || '/' || id::text || '/thumb.bin'),
  check (preview_path is null or preview_path = together_id::text || '/' || id::text || '/preview.bin'),
  -- folders and tags are for documents; the gallery has neither
  check (kind = 'document' or (folder_id is null and tags = '{}')),
  check (kind <> 'document' or (thumb_path is null and preview_path is null)),
  check (cardinality(tags) <= 10),
  check (kind = 'video' or duration_ms is null)
);

-- the gallery, newest taken first, paged by (taken_at, id)
create index files_gallery_idx on public.files (together_id, kind, taken_at desc, id desc)
  where status = 'ready' and deleted_at is null;
-- the drive and folders, newest added first
create index files_drive_idx on public.files (together_id, folder_id, created_at desc)
  where status = 'ready' and deleted_at is null and kind = 'document';
create index files_bin_idx on public.files (together_id, deleted_at) where deleted_at is not null;
create index files_tags_idx on public.files using gin (tags);

alter table public.files enable row level security;

create policy "members read" on public.files for select to authenticated
  using (together_id = (select public.my_together_id()));

-- Uploads start as yourself, uploading, and not binned. Becoming ready goes through v1_finish_upload.
create policy "members upload" on public.files for insert to authenticated
  with check (
    together_id = (select public.my_together_id())
    and uploaded_by = (select auth.uid())
    and status = 'uploading'
    and deleted_at is null
  );

-- Shared space: anyone in the Together renames, moves, tags, bins and restores. What can't change is guarded by
-- triggers/files_guard.sql.
create policy "members edit" on public.files for update to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
