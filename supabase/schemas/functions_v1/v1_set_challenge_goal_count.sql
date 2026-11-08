-- Set a goal's progress in the current period (in the Together's time zone), between 0 and its target. The period
-- is marked done while every goal of the challenge is done, and unmarked if one is undone.
create or replace function public.v1_set_challenge_goal_count(p_goal_id uuid, p_count integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  g public.challenge_goals;
  c public.challenges;
  today date;
  period date;
begin
  select * into g from public.challenge_goals where id = p_goal_id;
  if not found then
    raise exception 'That goal was removed.' using errcode = 'P0002';
  end if;
  -- one change to a challenge at a time, so two people ticking at once still mark the period done
  select * into c from public.challenges where id = g.challenge_id for update;
  select (now() at time zone t.time_zone)::date into today from public.togethers t where t.id = c.together_id;
  if c.starts_on > today then
    raise exception 'This challenge hasn''t started yet.';
  end if;
  period := public.challenge_period_start(c.cadence, today);

  insert into public.challenge_progress (goal_id, together_id, period_start, count)
  values (g.id, g.together_id, period, least(greatest(p_count, 0), g.target))
  on conflict (goal_id, period_start) do update
    set count = excluded.count, updated_by = auth.uid(), updated_at = now();

  if exists (
    select 1 from public.challenge_goals cg
    left join public.challenge_progress p on p.goal_id = cg.id and p.period_start = period
    where cg.challenge_id = c.id and coalesce(p.count, 0) < cg.target
  ) then
    delete from public.challenge_periods where challenge_id = c.id and period_start = period and outcome = 'done';
  else
    insert into public.challenge_periods (challenge_id, together_id, period_start, outcome)
    values (c.id, c.together_id, period, 'done')
    on conflict (challenge_id, period_start) do nothing;
  end if;
end;
$$;

revoke execute on function public.v1_set_challenge_goal_count(uuid, integer) from public, anon;
grant execute on function public.v1_set_challenge_goal_count(uuid, integer) to authenticated;
