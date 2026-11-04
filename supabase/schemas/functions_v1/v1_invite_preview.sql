-- What an invite code opens, for the join page (/join/CODE): the Together's name and who's in it, whether the code
-- has expired, and whether you're already in. No row when the code doesn't match anything.
create or replace function public.v1_invite_preview(p_code text)
returns table (id uuid, name text, members jsonb, expired boolean, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.name,
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'tone', m.tone) order by m.joined_at), '[]')
      from public.together_members m join public.profiles p on p.id = m.profile_id
      where m.together_id = t.id and m.left_at is null
    ),
    t.invite_expires_at < now(),
    exists (
      select 1 from public.together_members m
      where m.together_id = t.id and m.profile_id = (select auth.uid()) and m.left_at is null
    )
  from public.togethers t
  where (select auth.uid()) is not null
    and t.invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

revoke execute on function public.v1_invite_preview(text) from public, anon;
grant execute on function public.v1_invite_preview(text) to authenticated;
