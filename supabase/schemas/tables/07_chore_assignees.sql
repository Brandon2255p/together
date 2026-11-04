-- Who a chore is for: one person, or both for a shared chore.

create table public.chore_assignees (
  chore_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  profile_id uuid not null,
  primary key (chore_id, profile_id),
  foreign key (chore_id, together_id) references public.chores (id, together_id) on delete cascade,
  -- only people in the same Together
  foreign key (together_id, profile_id) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.chore_assignees enable row level security;

create policy "members" on public.chore_assignees for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
