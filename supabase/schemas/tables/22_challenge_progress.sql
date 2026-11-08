-- How far each goal got in each period. Written by functions_v1/v1_set_challenge_goal_count.sql.

create table public.challenge_progress (
  goal_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  -- the period's first day
  period_start date not null,
  count integer not null default 0 check (count between 0 and 99),
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (goal_id, period_start),
  foreign key (goal_id, together_id) references public.challenge_goals (id, together_id) on delete cascade
);

alter table public.challenge_progress enable row level security;

create policy "members" on public.challenge_progress for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
