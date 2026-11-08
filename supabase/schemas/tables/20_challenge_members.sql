-- Who's in a challenge. Any of them can tick its goals.

create table public.challenge_members (
  challenge_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  profile_id uuid not null,
  primary key (challenge_id, profile_id),
  foreign key (challenge_id, together_id) references public.challenges (id, together_id) on delete cascade,
  foreign key (together_id, profile_id) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.challenge_members enable row level security;

create policy "members" on public.challenge_members for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
