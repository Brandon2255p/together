-- Who's in each Together, and the colour the app uses for them.

create table public.together_members (
  together_id uuid not null references public.togethers (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- the creator is accent, whoever joins is partner
  tone public.member_tone not null,
  joined_at timestamptz not null default now(),
  primary key (together_id, profile_id),
  -- one Together per person
  unique (profile_id),
  -- two people per Together, one colour each
  unique (together_id, tone)
);

-- The signed-in user's Together. Every shared table defaults its together_id to this and every policy checks it.
-- SECURITY DEFINER so policies don't recurse into together_members' own policy; policies wrap it in a subselect so it
-- runs once per statement rather than once per row. Not versioned: it's internal, the app never calls it.
create or replace function public.my_together_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.together_id from public.together_members m where m.profile_id = (select auth.uid());
$$;

revoke execute on function public.my_together_id() from public, anon;
grant execute on function public.my_together_id() to authenticated;

alter table public.together_members enable row level security;

-- Members see each other. You can leave (delete your own membership), nothing else.
create policy "members read" on public.together_members for select to authenticated
  using (together_id = (select public.my_together_id()));
create policy "leave" on public.together_members for delete to authenticated
  using (profile_id = (select auth.uid()));

-- togethers: members can read and rename theirs
create policy "members read" on public.togethers for select to authenticated
  using (id = (select public.my_together_id()));
create policy "members rename" on public.togethers for update to authenticated
  using (id = (select public.my_together_id()))
  with check (id = (select public.my_together_id()));

-- profiles: yourself, and the people in your Together
create policy "read self and my together" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select m.profile_id from public.together_members m where m.together_id = (select public.my_together_id()))
  );
