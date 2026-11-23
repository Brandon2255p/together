-- Folders in a Together's Files. One level only (there's no parent), so the drive stays simple. A folder can be
-- deleted only when nothing that isn't in the bin is in it (triggers/file_folders_only_empty.sql); binned files in it
-- lose their folder.

create table public.file_folders (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  hue public.hue not null default 'accent',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, together_id)
);

create unique index file_folders_name_idx on public.file_folders (together_id, lower(btrim(name)));

alter table public.file_folders enable row level security;

create policy "members" on public.file_folders for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));

create policy "add as self" on public.file_folders as restrictive for insert to authenticated
  with check (created_by = (select auth.uid()));
