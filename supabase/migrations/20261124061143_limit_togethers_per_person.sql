SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.limit_togethers_per_person()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if new.left_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.left_at is null then
    return new;
  end if;
  -- one person's memberships are checked one at a time, so two joins at once can't both squeeze in
  perform pg_advisory_xact_lock(hashtextextended('together_members_limit:' || new.profile_id::text, 0));
  if (
    select count(*) from public.together_members
    where profile_id = new.profile_id and left_at is null and together_id <> new.together_id
  ) >= 2 then
    raise exception 'You can be in 2 Togethers at most. Leave one to start or join another.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."limit_togethers_per_person"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER together_members_limit
  BEFORE INSERT OR UPDATE OF left_at ON public.together_members
  FOR EACH ROW
  EXECUTE FUNCTION public.limit_togethers_per_person();

REVOKE ALL ON FUNCTION "public"."limit_togethers_per_person"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."limit_togethers_per_person"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."limit_togethers_per_person"() TO "service_role";
