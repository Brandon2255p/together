-- Who's in each Together, their role, and the colour the app uses for them. A person can be in many Togethers.
--
-- Leaving or being removed sets left_at instead of deleting the row, so what that person added (wishes, claims,
-- assignments, ratings) stays and still has a name. Rejoining clears left_at. Changes go through the v1_/v2_ functions:
-- there are no insert, update or delete policies.

create table public.together_members (
  together_id uuid not null references public.togethers (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- in join order: accent, partner, success, warning, then round again
  tone public.member_tone not null,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  -- set when they leave or are removed
  left_at timestamptz,
  -- when they last switched into or out of this Together; activity after it is "new" (v1_list_my_togethers)
  last_seen_at timestamptz not null default now(),
  primary key (together_id, profile_id)
);

create index together_members_profile_idx on public.together_members (profile_id) where left_at is null;

-- The signed-in user's current Together: profiles.current_together_id while they're still in it, else the one they
-- joined first, else null. Every shared table defaults its together_id to this and every policy checks it.
-- SECURITY DEFINER so policies don't recurse into together_members' own policy; policies wrap it in a subselect so it
-- runs once per statement rather than once per row. Not versioned: it's internal, the app never calls it.
create or replace function public.my_together_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.together_id
  from public.together_members m
  left join public.profiles p on p.id = m.profile_id and p.current_together_id = m.together_id
  where m.profile_id = (select auth.uid()) and m.left_at is null
  order by (p.id is not null) desc, m.joined_at, m.together_id
  limit 1;
$$;

revoke execute on function public.my_together_id() from public, anon;
grant execute on function public.my_together_id() to authenticated;

-- Everyone who is or was in any Together the signed-in user is in now, themselves included. For the profiles policy.
create or replace function public.my_people()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct other.profile_id
  from public.together_members mine
  join public.together_members other on other.together_id = mine.together_id
  where mine.profile_id = (select auth.uid()) and mine.left_at is null;
$$;

revoke execute on function public.my_people() from public, anon;
grant execute on function public.my_people() to authenticated;

alter table public.together_members enable row level security;

-- Members of the current Together see everyone who is or was in it (people who left still have names on what they
-- added). Leaving goes through v1_leave_together.
create policy "members read" on public.together_members for select to authenticated
  using (together_id = (select public.my_together_id()));

-- togethers: members can read and rename their current one. The others are listed by v1_list_my_togethers.
create policy "members read" on public.togethers for select to authenticated
  using (id = (select public.my_together_id()));
create policy "members rename" on public.togethers for update to authenticated
  using (id = (select public.my_together_id()))
  with check (id = (select public.my_together_id()));

-- profiles: yourself, and anyone in any Together you share
create policy "read self and my people" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or id in (select public.my_people()));
