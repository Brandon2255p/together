-- Join with an invite code. Spaces, dashes and case don't matter.
create or replace function public.v1_join_together(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t_id uuid;
  free_tone public.member_tone;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select id into t_id from public.togethers
  where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'))
  for update;

  if t_id is null then
    raise exception 'That code didn''t work. Check it with your person and try again.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.together_members where profile_id = me and together_id = t_id) then
    return t_id;
  end if;
  if exists (select 1 from public.together_members where profile_id = me) then
    raise exception 'You''re already in a Together.' using errcode = '23505';
  end if;

  select tone into free_tone from unnest(enum_range(null::public.member_tone)) as tone
  where tone not in (select m.tone from public.together_members m where m.together_id = t_id)
  limit 1;

  if free_tone is null then
    raise exception 'That Together already has two people.' using errcode = '23514';
  end if;

  insert into public.together_members (together_id, profile_id, tone) values (t_id, me, free_tone);
  return t_id;
end;
$$;

revoke execute on function public.v1_join_together(text) from public, anon;
grant execute on function public.v1_join_together(text) to authenticated;
