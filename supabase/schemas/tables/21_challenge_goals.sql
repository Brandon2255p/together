-- A challenge's goals. A target of 1 is a tick ("Meal prep on Sunday"); more is a count ("Gym 3x a week").

create table public.challenge_goals (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  target integer not null default 1 check (target between 1 and 99),
  position integer not null default 0,
  unique (id, together_id),
  foreign key (challenge_id, together_id) references public.challenges (id, together_id) on delete cascade
);

create index challenge_goals_challenge_idx on public.challenge_goals (challenge_id, position);

alter table public.challenge_goals enable row level security;

create policy "members" on public.challenge_goals for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
