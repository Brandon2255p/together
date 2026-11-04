-- Leave your current Together. What you added stays (see together_members.left_at). The last owner has to make
-- someone else the owner first, unless nobody else is left; the last person out deletes the Together and everything
-- in it. You land in another of your Togethers: the returned id, or null when there are none (onboarding).
create or replace function public.v1_leave_together()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t_id uuid := public.my_together_id();
  my_role public.member_role;
  next_id uuid;
begin
  if t_id is null then
    raise exception 'You''re not in a Together yet.' using errcode = 'P0002';
  end if;

  perform 1 from public.together_members where together_id = t_id for update;
  perform public.ensure_owner(t_id);
  select role into my_role from public.together_members where together_id = t_id and profile_id = me;

  if not exists (
    select 1 from public.together_members where together_id = t_id and left_at is null and profile_id <> me
  ) then
    delete from public.togethers where id = t_id;
  elsif my_role = 'owner' and not exists (
    select 1 from public.together_members
    where together_id = t_id and left_at is null and profile_id <> me and role = 'owner'
  ) then
    raise exception 'Make someone else the owner before you leave.' using errcode = 'P0001';
  else
    update public.together_members set left_at = now(), role = 'member', last_seen_at = now()
    where together_id = t_id and profile_id = me;
  end if;

  select m.together_id into next_id from public.together_members m
  where m.profile_id = me and m.left_at is null
  order by m.last_seen_at desc
  limit 1;

  update public.profiles set current_together_id = next_id where id = me;
  return next_id;
end;
$$;

revoke execute on function public.v1_leave_together() from public, anon;
grant execute on function public.v1_leave_together() to authenticated;
