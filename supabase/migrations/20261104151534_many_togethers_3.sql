SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.ensure_owner (
  p_together_id uuid
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."ensure_owner"(uuid) FROM "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.my_people()
  RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select distinct other.profile_id
  from public.together_members mine
  join public.together_members other on other.together_id = mine.together_id
  where mine.profile_id = (select auth.uid()) and mine.left_at is null;
$function$;

REVOKE ALL ON FUNCTION "public"."my_people"() FROM "anon";

CREATE OR REPLACE FUNCTION public.my_together_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select m.together_id
  from public.together_members m
  left join public.profiles p on p.id = m.profile_id and p.current_together_id = m.together_id
  where m.profile_id = (select auth.uid()) and m.left_at is null
  order by (p.id is not null) desc, m.joined_at, m.together_id
  limit 1;
$function$;

