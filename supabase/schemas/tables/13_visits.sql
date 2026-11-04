-- A visit to a place: when, a title, a note and an optional rating.

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  day date not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  note text check (char_length(note) <= 500),
  rating smallint check (rating between 1 and 5),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (place_id, together_id) references public.places (id, together_id) on delete cascade
);

create index visits_place_idx on public.visits (place_id, day desc);

alter table public.visits enable row level security;

create policy "members" on public.visits for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
