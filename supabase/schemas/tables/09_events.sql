-- The shared calendar.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  day date not null,
  -- null for all day
  start_time time,
  location text check (char_length(location) <= 120),
  -- a plan to go to one of the Together's places; its foreign key is in 11_places.sql, after the table it points at
  place_id uuid,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, together_id)
);

create index events_together_day_idx on public.events (together_id, day);
create index events_place_idx on public.events (place_id, day) where place_id is not null;

alter table public.events enable row level security;

create policy "members" on public.events for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
