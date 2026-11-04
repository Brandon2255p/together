SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.next_member_tone (
  p_together_id uuid
)
  RETURNS public.member_tone
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select (enum_range(null::public.member_tone))[
    1 + (select count(*)::int from public.together_members m where m.together_id = p_together_id) % 4
  ];
$function$;

REVOKE ALL ON FUNCTION "public"."next_member_tone"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.require_owner()
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  t_id uuid := public.my_together_id();
begin
  if t_id is null then
    raise exception 'You''re not in a Together yet.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.together_members
    where together_id = t_id and profile_id = auth.uid() and left_at is null and role = 'owner'
  ) then
    raise exception 'Only an owner can do that.' using errcode = '42501';
  end if;
  return t_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."require_owner"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.set_current_together (
  p_together_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  me uuid := auth.uid();
  previous uuid := public.my_together_id();
begin
  update public.together_members set last_seen_at = now()
  where profile_id = me and together_id in (previous, p_together_id);
  update public.profiles set current_together_id = p_together_id where id = me;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."set_current_together"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.v1_create_together (
  p_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  me uuid := auth.uid();
  t_id uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if exists (select 1 from public.together_members where profile_id = me) then
    raise exception 'You''re already in a Together.' using errcode = '23505';
  end if;

  loop
    begin
      insert into public.togethers (name, invite_code) values (btrim(p_name), public.new_invite_code())
      returning id into t_id;
      exit;
    exception when unique_violation then
      -- invite code collision; try another
    end;
  end loop;

  insert into public.together_members (together_id, profile_id, tone, role) values (t_id, me, 'accent', 'owner');
  return t_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.v1_invite_preview (
  p_code text
)
  RETURNS TABLE (
    id             uuid,
    name           text,
    members        jsonb,
    expired        boolean,
    already_member boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."v1_invite_preview"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_join_together (
  p_code text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

  -- v1 keeps its two-person rule: only the first two tones
  select tone into free_tone from unnest(array['accent', 'partner']::public.member_tone[]) as tone
  where tone not in (select m.tone from public.together_members m where m.together_id = t_id)
  limit 1;

  if free_tone is null then
    raise exception 'That Together already has two people.' using errcode = '23514';
  end if;

  insert into public.together_members (together_id, profile_id, tone) values (t_id, me, free_tone);
  return t_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.v1_leave_together()
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."v1_leave_together"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_list_my_togethers()
  RETURNS TABLE (
    id               uuid,
    name             text,
    member_count     integer,
    members          jsonb,
    tone             public.member_tone,
    role             public.member_role,
    is_current       boolean,
    last_activity_at timestamp with time zone,
    has_news         boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."v1_list_my_togethers"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_new_invite_code()
  RETURNS TABLE (
    invite_code       text,
    invite_expires_at timestamp with time zone
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  t_id uuid := public.require_owner();
begin
  loop
    begin
      return query
        update public.togethers t
        set invite_code = public.new_invite_code(), invite_expires_at = now() + interval '48 hours'
        where t.id = t_id
        returning t.invite_code, t.invite_expires_at;
      return;
    exception when unique_violation then
      -- invite code collision; try another
    end;
  end loop;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_new_invite_code"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_remove_member (
  p_profile_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  t_id uuid := public.require_owner();
begin
  if p_profile_id = auth.uid() then
    raise exception 'To go yourself, leave the Together instead.' using errcode = 'P0001';
  end if;
  update public.together_members set left_at = now(), role = 'member'
  where together_id = t_id and profile_id = p_profile_id and left_at is null;
  if not found then
    raise exception 'They''re not in this Together.' using errcode = 'P0002';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_remove_member"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_set_member_role (
  p_profile_id uuid,
  p_role       public.member_role
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  t_id uuid := public.require_owner();
begin
  -- lock the Together's members so two owners can't both step down at once
  perform 1 from public.together_members where together_id = t_id for update;

  update public.together_members set role = p_role
  where together_id = t_id and profile_id = p_profile_id and left_at is null;
  if not found then
    raise exception 'They''re not in this Together.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.together_members where together_id = t_id and left_at is null and role = 'owner'
  ) then
    raise exception 'A Together needs an owner. Make someone else the owner first.' using errcode = 'P0001';
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_set_member_role"(uuid, public.member_role) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_switch_together (
  p_together_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.together_members
    where together_id = p_together_id and profile_id = auth.uid() and left_at is null
  ) then
    raise exception 'You''re not in that Together.' using errcode = '42501';
  end if;
  perform public.set_current_together(p_together_id);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_switch_together"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v2_create_together (
  p_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  me uuid := auth.uid();
  t_id uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  loop
    begin
      insert into public.togethers (name, invite_code) values (btrim(p_name), public.new_invite_code())
      returning id into t_id;
      exit;
    exception when unique_violation then
      -- invite code collision; try another
    end;
  end loop;

  insert into public.together_members (together_id, profile_id, tone, role) values (t_id, me, 'accent', 'owner');
  perform public.set_current_together(t_id);
  return t_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v2_create_together"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v2_join_together (
  p_code text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."v2_join_together"(text) FROM PUBLIC, "anon";

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_current_together_id_fkey" FOREIGN KEY (current_together_id) REFERENCES public.togethers(id) ON DELETE SET NULL;

CREATE INDEX together_members_profile_idx ON public.together_members USING btree (profile_id)
  WHERE (left_at IS NULL);

CREATE POLICY "read self and my people" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((id = ( SELECT auth.uid() AS uid)) OR (id IN ( SELECT public.my_people() AS my_people))));

CREATE POLICY "unclaim own" ON "public"."wish_claims"
  FOR DELETE
  TO "authenticated"
  USING (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (claimed_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY "edit own" ON "public"."wishes"
  FOR UPDATE
  TO "authenticated"
  USING (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (owner_id = ( SELECT auth.uid() AS uid))))
  WITH CHECK (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (owner_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "remove own" ON "public"."wishes"
  FOR DELETE
  TO "authenticated"
  USING (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (owner_id = ( SELECT auth.uid() AS uid))));

REVOKE ALL ON FUNCTION "public"."my_people"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."my_people"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."my_people"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."my_people"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."my_people"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."next_member_tone"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."next_member_tone"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."next_member_tone"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."require_owner"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."require_owner"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."require_owner"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_current_together"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_current_together"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_current_together"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_invite_preview"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_invite_preview"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_invite_preview"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_invite_preview"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_leave_together"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_leave_together"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_leave_together"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_leave_together"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_list_my_togethers"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_list_my_togethers"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_list_my_togethers"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_list_my_togethers"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_new_invite_code"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_new_invite_code"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_new_invite_code"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_new_invite_code"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_remove_member"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_remove_member"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_remove_member"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_remove_member"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_set_member_role"(uuid, public.member_role) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_set_member_role"(uuid, public.member_role) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_set_member_role"(uuid, public.member_role) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_set_member_role"(uuid, public.member_role) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_switch_together"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_switch_together"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_switch_together"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_switch_together"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v2_create_together"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v2_create_together"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v2_create_together"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v2_create_together"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v2_join_together"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v2_join_together"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v2_join_together"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v2_join_together"(text) TO "service_role";

