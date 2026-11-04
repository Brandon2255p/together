-- Join with an invite code, even when you're already in other Togethers, and switch to it. Spaces, dashes and case
-- don't matter. Someone who left and comes back gets their old tone back, and everything they added.
create or replace function public.v2_join_together(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t public.togethers;
  existing public.together_members;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select * into t from public.togethers
  where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'))
  for update;

  if t.id is null then
    raise exception 'That code didn''t work. Check it with whoever sent it and try again.' using errcode = 'P0002';
  end if;

  select * into existing from public.together_members where together_id = t.id and profile_id = me;

  if existing.profile_id is not null and existing.left_at is null then
    -- already in: just open it
    perform public.set_current_together(t.id);
    return t.id;
  end if;
  if t.invite_expires_at < now() then
    raise exception 'That code has expired. Ask for a new one.' using errcode = 'P0001';
  end if;

  if existing.profile_id is not null then
    update public.together_members set left_at = null, role = 'member', joined_at = now()
    where together_id = t.id and profile_id = me;
  else
    insert into public.together_members (together_id, profile_id, tone)
    values (t.id, me, public.next_member_tone(t.id));
  end if;

  perform public.set_current_together(t.id);
  return t.id;
end;
$$;

revoke execute on function public.v2_join_together(text) from public, anon;
grant execute on function public.v2_join_together(text) to authenticated;
