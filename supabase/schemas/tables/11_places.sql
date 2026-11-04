-- Places you've been or want to go. Logging a visit flips status to been (triggers/mark_place_visited.sql).

create table public.places (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null default '' check (char_length(category) <= 40),
  area text not null default '' check (char_length(area) <= 60),
  maps_url text check (maps_url ~ '^https://'),
  status public.place_status not null default 'want',
  hue public.hue not null default 'accent',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, together_id)
);

create index places_together_idx on public.places (together_id, status);

alter table public.places enable row level security;

create policy "members" on public.places for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
