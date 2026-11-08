-- What became of a challenge's periods. 'done' is written by v1_set_challenge_goal_count when every goal is done;
-- 'boosted' and 'reset' settle a missed period (the app checks a booster is there first). An ended period with no
-- row was missed.

create table public.challenge_periods (
  challenge_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  period_start date not null,
  outcome public.challenge_outcome not null,
  decided_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, period_start),
  foreign key (challenge_id, together_id) references public.challenges (id, together_id) on delete cascade
);

alter table public.challenge_periods enable row level security;

create policy "members" on public.challenge_periods for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
