SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.v2_finish_upload (
  p_id uuid
)
  RETURNS public.files
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_file public.files;
begin
  update public.files set status = 'ready'
  where id = p_id
    and together_id = public.my_together_id()
    and uploaded_by = auth.uid()
    and status = 'uploading'
  returning * into v_file;
  if not found then
    raise exception 'That upload isn''t waiting to finish.' using errcode = 'P0002';
  end if;
  return v_file;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v2_finish_upload"(uuid) FROM PUBLIC, "anon";

GRANT EXECUTE ON FUNCTION "public"."v2_finish_upload"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v2_finish_upload"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v2_finish_upload"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v2_finish_upload"(uuid) TO "service_role";
