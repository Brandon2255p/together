SET local check_function_bodies = off;

CREATE TABLE "public"."calendar_feeds" (
  "token"       text                     NOT NULL,
  "together_id" uuid                     NOT NULL,
  "profile_id"  uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "calendar_feeds_pkey" PRIMARY KEY (token),
  CONSTRAINT "calendar_feeds_together_id_profile_id_key" UNIQUE (together_id, profile_id),
  CONSTRAINT "calendar_feeds_token_check" CHECK ((token ~ '^[0-9a-f]{64}$'::text))
);

ALTER TABLE "public"."calendar_feeds"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.v1_calendar_feed (
  p_token text
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select jsonb_build_object(
    'name', t.name,
    'time_zone', t.time_zone,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'day', e.day,
        'time', to_char(e.start_time, 'HH24:MI'),
        'location', e.location,
        'place', p.name,
        'attendees', coalesce((
          select jsonb_agg(pr.name order by m.joined_at)
          from public.event_attendees a
          join public.profiles pr on pr.id = a.profile_id
          join public.together_members m on m.together_id = a.together_id and m.profile_id = a.profile_id
          where a.event_id = e.id
        ), '[]'::jsonb),
        'created_at', e.created_at
      ) order by e.day, e.start_time nulls first)
      from public.events e
      left join public.places p on p.id = e.place_id
      where e.together_id = t.id
        and e.day >= (now() at time zone t.time_zone)::date - 90
    ), '[]'::jsonb)
  )
  from public.calendar_feeds f
  join public.together_members m on m.together_id = f.together_id and m.profile_id = f.profile_id and m.left_at is null
  join public.togethers t on t.id = f.together_id
  where f.token = p_token;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_calendar_feed"(text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.v1_calendar_feed_token (
  p_reset boolean DEFAULT false
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_together uuid := public.my_together_id();
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if v_together is null or not exists (
    select 1 from public.together_members
    where together_id = v_together and profile_id = auth.uid() and left_at is null
  ) then
    raise exception 'You''re not in a Together yet.' using errcode = '42501';
  end if;

  if p_reset then
    delete from public.calendar_feeds where together_id = v_together and profile_id = auth.uid();
  end if;

  insert into public.calendar_feeds (token, together_id, profile_id)
  values (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), v_together, auth.uid())
  on conflict (together_id, profile_id) do nothing;

  select token into v_token from public.calendar_feeds where together_id = v_together and profile_id = auth.uid();
  return v_token;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_calendar_feed_token"(boolean) FROM PUBLIC, "anon";

ALTER TABLE "public"."calendar_feeds"
  ADD CONSTRAINT "calendar_feeds_together_id_profile_id_fkey" FOREIGN KEY (together_id, profile_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

REVOKE ALL ON FUNCTION "public"."v1_calendar_feed"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed_token"(boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_calendar_feed_token"(boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed_token"(boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_calendar_feed_token"(boolean) TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."calendar_feeds" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."calendar_feeds" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."calendar_feeds" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."calendar_feeds" TO "service_role";
