SET local check_function_bodies = off;

CREATE TABLE "public"."push_subscriptions" (
  "endpoint"   text                     NOT NULL,
  "p256dh"     text                     NOT NULL,
  "auth"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "push_subscriptions_auth_check" CHECK ((char_length(auth) <= 100)),
  CONSTRAINT "push_subscriptions_endpoint_check" CHECK (((endpoint ~ '^https://'::text) AND (char_length(endpoint) <= 1000))),
  CONSTRAINT "push_subscriptions_p256dh_check" CHECK ((char_length(p256dh) <= 200)),
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (endpoint),
  "profile_id" uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."push_subscriptions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.v1_chore_reminders()
  RETURNS TABLE (
    endpoint text,
    p256dh   text,
    auth     text,
    titles   text[]
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select s.endpoint, s.p256dh, s.auth, array_agg(distinct c.title order by c.title)
  from public.push_subscriptions s
  join public.chore_assignees a on a.profile_id = s.profile_id
  join public.chores c on c.id = a.chore_id
  join public.togethers t on t.id = c.together_id
  where c.done_at is null
    and c.due is not null
    and c.due <= (now() at time zone t.time_zone)::date
  group by s.endpoint, s.p256dh, s.auth;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_chore_reminders"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.v1_save_push_subscription (
  p_endpoint text,
  p_p256dh   text,
  p_auth     text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (endpoint, profile_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_save_push_subscription"(text, text, text) FROM PUBLIC, "anon";

REVOKE ALL ON FUNCTION "public"."v1_chore_reminders"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_chore_reminders"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_chore_reminders"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_save_push_subscription"(text, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_save_push_subscription"(text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_save_push_subscription"(text, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_save_push_subscription"(text, text, text) TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."push_subscriptions" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."push_subscriptions" TO "service_role";

ALTER TABLE "public"."push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX push_subscriptions_profile_idx ON public.push_subscriptions USING btree (profile_id);

CREATE POLICY "own read" ON "public"."push_subscriptions"
  FOR SELECT
  TO "authenticated"
  USING ((profile_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "own remove" ON "public"."push_subscriptions"
  FOR DELETE
  TO "authenticated"
  USING ((profile_id = ( SELECT auth.uid() AS uid)));
