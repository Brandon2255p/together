-- Whose goal it is. One owner is a personal goal; both is a shared goal.

create table public.goal_owners (
  goal_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  profile_id uuid not null,
  primary key (goal_id, profile_id),
  foreign key (goal_id, together_id) references public.goals (id, together_id) on delete cascade,
  foreign key (together_id, profile_id) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.goal_owners enable row level security;

create policy "members" on public.goal_owners for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
