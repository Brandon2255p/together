-- Each person rates a place on their own, 1-5. Everyone sees both; you only set yours.

create table public.place_ratings (
  place_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  profile_id uuid not null default auth.uid(),
  rating smallint not null check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (place_id, profile_id),
  foreign key (place_id, together_id) references public.places (id, together_id) on delete cascade,
  foreign key (together_id, profile_id) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.place_ratings enable row level security;

create policy "members read" on public.place_ratings for select to authenticated
  using (together_id = (select public.my_together_id()));
create policy "rate as self" on public.place_ratings for insert to authenticated
  with check (together_id = (select public.my_together_id()) and profile_id = (select auth.uid()));
create policy "change own" on public.place_ratings for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "remove own" on public.place_ratings for delete to authenticated
  using (profile_id = (select auth.uid()));
