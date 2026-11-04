-- Every Together you're in, for the switcher: who's in it, your tone and role there, and its activity.
-- last_activity_at is the newest thing anyone added or did there. has_news is true when someone else did something
-- after you last switched into or out of it (it's never true for your current Together).
create or replace function public.v1_list_my_togethers()
returns table (
  id uuid,
  name text,
  member_count int,
  members jsonb,
  tone public.member_tone,
  role public.member_role,
  is_current boolean,
  last_activity_at timestamptz,
  has_news boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select m.together_id, m.tone, m.role, m.last_seen_at, m.joined_at
    from public.together_members m
    where m.profile_id = (select auth.uid()) and m.left_at is null
  ),
  activity as (
    select s.together_id, s.created_at as at, s.added_by as who from public.shopping_items s
    union all select c.together_id, c.created_at, c.created_by from public.chores c
    union all select c.together_id, c.completed_at, c.completed_by from public.chore_completions c
    union all select e.together_id, e.created_at, e.created_by from public.events e
    union all select p.together_id, p.created_at, p.created_by from public.places p
    union all select v.together_id, v.created_at, v.created_by from public.visits v
    union all select w.together_id, w.created_at, w.owner_id from public.wishes w
    union all select m.together_id, m.joined_at, m.profile_id from public.together_members m where m.left_at is null
  )
  select
    t.id,
    t.name,
    (select count(*)::int from public.together_members m where m.together_id = t.id and m.left_at is null),
    (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'tone', m.tone) order by m.joined_at), '[]')
      from public.together_members m join public.profiles p on p.id = m.profile_id
      where m.together_id = t.id and m.left_at is null
    ),
    mine.tone,
    mine.role,
    t.id = public.my_together_id(),
    greatest(t.created_at, (select max(a.at) from activity a where a.together_id = t.id)),
    t.id <> public.my_together_id() and exists (
      select 1 from activity a
      where a.together_id = t.id and a.at > mine.last_seen_at and a.who is distinct from (select auth.uid())
    )
  from mine
  join public.togethers t on t.id = mine.together_id
  order by mine.joined_at;
$$;

revoke execute on function public.v1_list_my_togethers() from public, anon;
grant execute on function public.v1_list_my_togethers() to authenticated;
