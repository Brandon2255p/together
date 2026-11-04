-- Places you've been or want to go. Logging a visit flips status to been (triggers/mark_place_visited.sql).
--
-- Places matched on Google keep only what the Google Maps Platform terms let us store:
-- - google_place_id, indefinitely. One row per Google place per Together.
-- - lat / lng, for up to 30 days from location_fetched_at; refreshed when the place is opened.
-- Rating, hours, photos and the street address are fetched fresh when the place is shown, never stored.
-- area (suburb), city, province and country are our own labels for filtering and grouping: prefilled from Google
-- when the place is added, then the user's to edit. street is only for places added by hand.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category text not null default '' check (char_length(category) <= 40),
  area text not null default '' check (char_length(area) <= 60),
  street text not null default '' check (char_length(street) <= 80),
  city text not null default '' check (char_length(city) <= 80),
  province text not null default '' check (char_length(province) <= 80),
  country text not null default '' check (char_length(country) <= 80),
  maps_url text check (maps_url ~ '^https://'),
  google_place_id text check (google_place_id ~ '^[A-Za-z0-9_-]+$' and char_length(google_place_id) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  location_fetched_at timestamptz,
  status public.place_status not null default 'want',
  hue public.hue not null default 'accent',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, together_id),
  unique (together_id, google_place_id),
  -- coordinates come as a pair with the time they were fetched
  check ((lat is null) = (lng is null) and (lat is null) = (location_fetched_at is null))
);

create index places_together_idx on public.places (together_id, status);
create index places_area_idx on public.places (together_id, country, province, city);

alter table public.places enable row level security;

create policy "members" on public.places for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
