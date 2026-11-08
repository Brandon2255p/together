-- The first day of the period a day falls in: the day, its Monday, or the 1st. Mirrors periodStartOf in
-- lib/challenges/streak.ts.
create or replace function public.challenge_period_start(p_cadence public.challenge_cadence, p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_cadence
    when 'daily' then p_day
    when 'weekly' then p_day - (extract(isodow from p_day)::integer - 1)
    else date_trunc('month', p_day)::date
  end;
$$;
