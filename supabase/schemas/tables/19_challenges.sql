-- Challenges: goals that repeat every day, week or month. Finishing them all scores the period and grows the streak.
-- The streak and boosters are worked out from challenge_periods (lib/challenges/streak.ts).

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  cadence public.challenge_cadence not null,
  -- the first period's first day: a Monday for weekly, the 1st for monthly
  starts_on date not null check (
    cadence = 'daily'
    or (cadence = 'weekly' and extract(isodow from starts_on) = 1)
    or (cadence = 'monthly' and extract(day from starts_on) = 1)
  ),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, together_id)
);

alter table public.challenges enable row level security;

create policy "members" on public.challenges for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
