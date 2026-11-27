SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.v1_abort_upload (
  p_id uuid
)
  RETURNS SETOF text
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with gone as (
    delete from public.files
    where id = p_id
      and together_id = public.my_together_id()
      and uploaded_by = auth.uid()
      and status = 'uploading'
    returning original_path, thumb_path, preview_path
  )
  select p from gone, unnest(array[gone.original_path, gone.thumb_path, gone.preview_path]) as p where p is not null;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_abort_upload"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_release_stuck_upload (
  p_mac text
)
  RETURNS SETOF text
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with gone as (
    delete from public.files
    where together_id = public.my_together_id()
      and content_mac = p_mac
      and status = 'uploading'
      and (uploaded_by = auth.uid() or created_at < now() - interval '20 minutes')
    returning original_path, thumb_path, preview_path
  )
  select p from gone, unnest(array[gone.original_path, gone.thumb_path, gone.preview_path]) as p where p is not null;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_release_stuck_upload"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_sweep_stale_uploads()
  RETURNS SETOF text
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with gone as (
    delete from public.files
    where status = 'uploading' and created_at < now() - interval '1 hour'
    returning original_path, thumb_path, preview_path
  )
  select p from gone, unnest(array[gone.original_path, gone.thumb_path, gone.preview_path]) as p where p is not null;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_sweep_stale_uploads"() FROM PUBLIC, "anon", "authenticated";

GRANT EXECUTE ON FUNCTION "public"."v1_abort_upload"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_abort_upload"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_abort_upload"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_abort_upload"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_release_stuck_upload"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_release_stuck_upload"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_release_stuck_upload"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_release_stuck_upload"(text) TO "service_role";

REVOKE ALL ON FUNCTION "public"."v1_sweep_stale_uploads"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_sweep_stale_uploads"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_sweep_stale_uploads"() TO "service_role";
