-- Places you've been or want to go. Logging a visit flips status to been (triggers/mark_place_visited.sql).
-- The google_* columns come from the Google Places API when the place was saved from a Maps link (null otherwise):
-- the place id, its Google rating, and the resource name of its first photo (served through /api/places/<id>/photo).

create table public.places (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null default '' check (char_length(category) <= 40),
  area text not null default '' check (char_length(area) <= 60),
  maps_url text check (maps_url ~ '^https://'),
  google_place_id text check (char_length(google_place_id) between 1 and 300),
  google_rating numeric(2, 1) check (google_rating between 1 and 5),
  google_photo text check (google_photo ~ '^places/[^/]+/photos/[^/]+$'),
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
