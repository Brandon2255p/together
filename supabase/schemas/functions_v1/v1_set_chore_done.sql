-- Tick a chore. A once-off chore is marked done. A recurring one is logged and moves on to its next due date
-- after today (keeping the day of the month for monthly chores).
create or replace function public.v1_set_chore_done(p_chore_id uuid, p_done boolean)
returns public.chores
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c public.chores;
  today date;
  step interval;
  base date;
  n integer := 1;
begin
  select * into c from public.chores where id = p_chore_id for update;
  if not found then
    raise exception 'That chore was removed.' using errcode = 'P0002';
  end if;

  if p_done then
    insert into public.chore_completions (chore_id, together_id, due) values (c.id, c.together_id, c.due);
  end if;

  if p_done and c.repeat <> 'once' then
    select (now() at time zone t.time_zone)::date into today from public.togethers t where t.id = c.together_id;
    step := case c.repeat when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end;
    base := coalesce(c.due, today);
    while (base + step * n)::date <= today loop
      n := n + 1;
    end loop;
    update public.chores set due = (base + step * n)::date, done_at = null where id = c.id returning * into c;
  else
    update public.chores set done_at = case when p_done then now() end where id = c.id returning * into c;
  end if;

  return c;
end;
$$;

revoke execute on function public.v1_set_chore_done(uuid, boolean) from public, anon;
grant execute on function public.v1_set_chore_done(uuid, boolean) to authenticated;
