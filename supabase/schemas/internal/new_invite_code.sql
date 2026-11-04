-- Internal helpers: called by other functions, never by the app, so they aren't versioned.

-- 6 characters from an alphabet without look-alikes (0/O, 1/I)
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

revoke execute on function public.new_invite_code() from public, anon, authenticated;

-- The tone for the next person to join: accent, partner, success, warning in join order, then round again.
-- People who left keep their tone, so they still count.
create or replace function public.next_member_tone(p_together_id uuid)
returns public.member_tone
language sql
stable
set search_path = ''
as $$
  select (enum_range(null::public.member_tone))[
    1 + (select count(*)::int from public.together_members m where m.together_id = p_together_id) % 4
  ];
$$;

revoke execute on function public.next_member_tone(uuid) from public, anon, authenticated;

-- Makes p_together_id the signed-in user's current Together (null for none), and marks both the one they leave and
-- the one they open as seen. Callers check membership first.
create or replace function public.set_current_together(p_together_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  previous uuid := public.my_together_id();
begin
  update public.together_members set last_seen_at = now()
  where profile_id = me and together_id in (previous, p_together_id);
  update public.profiles set current_together_id = p_together_id where id = me;
end;
$$;

revoke execute on function public.set_current_together(uuid) from public, anon, authenticated;

-- A Together with members but no owner (made before roles existed, or every owner left) gets one: the member who
-- joined first. lib/backend/services/real/server.ts shows the same person as owner until this runs.
create or replace function public.ensure_owner(p_together_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.together_members set role = 'owner'
  where together_id = p_together_id
    and profile_id = (
      select m.profile_id from public.together_members m
      where m.together_id = p_together_id and m.left_at is null
      order by m.joined_at, m.profile_id
      limit 1
    )
    and not exists (
      select 1 from public.together_members o
      where o.together_id = p_together_id and o.left_at is null and o.role = 'owner'
    );
$$;

revoke execute on function public.ensure_owner(uuid) from public, anon, authenticated;

-- Raises unless the signed-in user owns their current Together. Returns its id.
create or replace function public.require_owner()
returns uuid
language plpgsql
volatile
set search_path = ''
as $$
declare
  t_id uuid := public.my_together_id();
begin
  if t_id is null then
    raise exception 'You''re not in a Together yet.' using errcode = 'P0002';
  end if;
  perform public.ensure_owner(t_id);
  if not exists (
    select 1 from public.together_members
    where together_id = t_id and profile_id = auth.uid() and left_at is null and role = 'owner'
  ) then
    raise exception 'Only an owner can do that.' using errcode = '42501';
  end if;
  return t_id;
end;
$$;

revoke execute on function public.require_owner() from public, anon, authenticated;
