-- Things each person would love. Everyone in the Together sees them; only the owner adds, edits or removes their own.
-- When the owner leaves the Together their wishes go with them.

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id(),
  owner_id uuid not null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  -- in cents, to keep money exact
  price_cents bigint check (price_cents >= 0),
  url text check (url ~ '^https?://'),
  hue public.hue not null default 'accent',
  created_at timestamptz not null default now(),
  unique (id, together_id),
  foreign key (together_id, owner_id) references public.together_members (together_id, profile_id) on delete cascade
);

create index wishes_owner_idx on public.wishes (together_id, owner_id);

alter table public.wishes enable row level security;

create policy "members read" on public.wishes for select to authenticated
  using (together_id = (select public.my_together_id()));
create policy "add own" on public.wishes for insert to authenticated
  with check (together_id = (select public.my_together_id()) and owner_id = (select auth.uid()));
-- only in your current Together, so someone who left can't change what stays behind
create policy "edit own" on public.wishes for update to authenticated
  using (together_id = (select public.my_together_id()) and owner_id = (select auth.uid()))
  with check (together_id = (select public.my_together_id()) and owner_id = (select auth.uid()));
create policy "remove own" on public.wishes for delete to authenticated
  using (together_id = (select public.my_together_id()) and owner_id = (select auth.uid()));
