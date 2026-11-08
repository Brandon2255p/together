SET local check_function_bodies = off;

CREATE TABLE "public"."challenge_goals" (
  "id"           uuid    NOT NULL DEFAULT gen_random_uuid(),
  "challenge_id" uuid    NOT NULL,
  "title"        text    NOT NULL,
  "target"       integer NOT NULL DEFAULT 1,
  "position"     integer NOT NULL DEFAULT 0,
  CONSTRAINT "challenge_goals_pkey" PRIMARY KEY (id),
  CONSTRAINT "challenge_goals_target_check" CHECK (((target >= 1) AND (target <= 99))),
  CONSTRAINT "challenge_goals_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120))),
  "together_id"  uuid    NOT NULL DEFAULT public.my_together_id(),
  CONSTRAINT "challenge_goals_id_together_id_key" UNIQUE (id, together_id)
);

ALTER TABLE "public"."challenge_goals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."challenge_members" (
  "challenge_id" uuid NOT NULL,
  "profile_id"   uuid NOT NULL,
  CONSTRAINT "challenge_members_pkey" PRIMARY KEY (challenge_id, profile_id),
  "together_id"  uuid NOT NULL DEFAULT public.my_together_id()
);

ALTER TABLE "public"."challenge_members"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."challenge_periods" (
  "challenge_id" uuid NOT NULL,
  "period_start" date NOT NULL,
  CONSTRAINT "challenge_periods_pkey" PRIMARY KEY (challenge_id, period_start),
  "together_id"  uuid NOT NULL DEFAULT public.my_together_id()
);

ALTER TABLE "public"."challenge_periods"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."challenge_progress" (
  "goal_id"      uuid                     NOT NULL,
  "period_start" date                     NOT NULL,
  "count"        integer                  NOT NULL DEFAULT 0,
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "challenge_progress_count_check" CHECK (((count >= 0) AND (count <= 99))),
  CONSTRAINT "challenge_progress_pkey" PRIMARY KEY (goal_id, period_start),
  "together_id"  uuid                     NOT NULL DEFAULT public.my_together_id(),
  "updated_by"   uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."challenge_progress"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."challenges" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  "title"       text NOT NULL,
  CONSTRAINT "challenges_pkey" PRIMARY KEY (id),
  CONSTRAINT "challenges_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120))),
  "together_id" uuid NOT NULL DEFAULT public.my_together_id(),
  CONSTRAINT "challenges_id_together_id_key" UNIQUE (id, together_id)
);

ALTER TABLE "public"."challenges"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."challenge_cadence" AS ENUM (
  'daily',
  'weekly',
  'monthly'
);

ALTER TABLE "public"."challenges"
  ADD COLUMN "cadence" public.challenge_cadence NOT NULL;

ALTER TABLE "public"."challenges"
  ADD COLUMN "starts_on" date NOT NULL;

ALTER TABLE "public"."challenges"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE TYPE "public"."challenge_outcome" AS ENUM (
  'done',
  'boosted',
  'reset'
);

ALTER TABLE "public"."challenge_periods"
  ADD COLUMN "outcome" public.challenge_outcome NOT NULL;

ALTER TABLE "public"."challenge_periods"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.challenge_period_start (
  p_cadence public.challenge_cadence,
  p_day     date
)
  RETURNS date
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select case p_cadence
    when 'daily' then p_day
    when 'weekly' then p_day - (extract(isodow from p_day)::integer - 1)
    else date_trunc('month', p_day)::date
  end;
$function$;

CREATE OR REPLACE FUNCTION public.v1_create_challenge (
  p_title      text,
  p_cadence    public.challenge_cadence,
  p_starts_on  date,
  p_member_ids uuid[],
  p_goals      jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  new_id uuid;
begin
  if coalesce(array_length(p_member_ids, 1), 0) = 0 then
    raise exception 'Pick who''s in it.';
  end if;
  if jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) = 0 then
    raise exception 'Add at least one goal.';
  end if;

  insert into public.challenges (title, cadence, starts_on) values (btrim(p_title), p_cadence, p_starts_on)
  returning id into new_id;
  insert into public.challenge_members (challenge_id, profile_id)
    select new_id, m from unnest(p_member_ids) as m;
  insert into public.challenge_goals (challenge_id, title, target, position)
    select new_id, btrim(g.value ->> 'title'), coalesce((g.value ->> 'target')::integer, 1), (g.ordinality - 1)::integer
    from jsonb_array_elements(p_goals) with ordinality as g;
  return new_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_create_challenge"(text, public.challenge_cadence, date, uuid[], jsonb) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_set_challenge_goal_count (
  p_goal_id uuid,
  p_count   integer
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  g public.challenge_goals;
  c public.challenges;
  today date;
  period date;
begin
  select * into g from public.challenge_goals where id = p_goal_id;
  if not found then
    raise exception 'That goal was removed.' using errcode = 'P0002';
  end if;
  -- one change to a challenge at a time, so two people ticking at once still mark the period done
  select * into c from public.challenges where id = g.challenge_id for update;
  select (now() at time zone t.time_zone)::date into today from public.togethers t where t.id = c.together_id;
  if c.starts_on > today then
    raise exception 'This challenge hasn''t started yet.';
  end if;
  period := public.challenge_period_start(c.cadence, today);

  insert into public.challenge_progress (goal_id, together_id, period_start, count)
  values (g.id, g.together_id, period, least(greatest(p_count, 0), g.target))
  on conflict (goal_id, period_start) do update
    set count = excluded.count, updated_by = auth.uid(), updated_at = now();

  if exists (
    select 1 from public.challenge_goals cg
    left join public.challenge_progress p on p.goal_id = cg.id and p.period_start = period
    where cg.challenge_id = c.id and coalesce(p.count, 0) < cg.target
  ) then
    delete from public.challenge_periods where challenge_id = c.id and period_start = period and outcome = 'done';
  else
    insert into public.challenge_periods (challenge_id, together_id, period_start, outcome)
    values (c.id, c.together_id, period, 'done')
    on conflict (challenge_id, period_start) do nothing;
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_set_challenge_goal_count"(uuid, integer) FROM PUBLIC, "anon";

ALTER TABLE "public"."challenges"
  ADD CONSTRAINT "challenges_check"
    CHECK
    (((cadence = 'daily'::public.challenge_cadence) OR ((cadence = 'weekly'::public.challenge_cadence) AND (EXTRACT(isodow FROM starts_on) = (1)::numeric)) OR ((cadence =
    'monthly'::public.challenge_cadence) AND (EXTRACT(day FROM starts_on) = (1)::numeric))));

CREATE INDEX challenge_goals_challenge_idx ON public.challenge_goals USING btree (challenge_id, "position");

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."challenge_goals";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."challenge_members";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."challenge_periods";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."challenge_progress";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."challenges";

GRANT EXECUTE ON FUNCTION "public"."challenge_period_start"(public.challenge_cadence, date) TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."challenge_period_start"(public.challenge_cadence, date) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."challenge_period_start"(public.challenge_cadence, date) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."challenge_period_start"(public.challenge_cadence, date) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_create_challenge"(text, public.challenge_cadence, date, uuid[], jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_create_challenge"(text, public.challenge_cadence, date, uuid[], jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_create_challenge"(text, public.challenge_cadence, date, uuid[], jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_create_challenge"(text, public.challenge_cadence, date, uuid[], jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_set_challenge_goal_count"(uuid, integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_set_challenge_goal_count"(uuid, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_set_challenge_goal_count"(uuid, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_set_challenge_goal_count"(uuid, integer) TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_goals" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."challenge_goals" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_goals" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_goals" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_members" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."challenge_members" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_members" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_members" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_periods" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."challenge_periods" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_periods" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_periods" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_progress" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."challenge_progress" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_progress" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenge_progress" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenges" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."challenges" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenges" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."challenges" TO "service_role";

CREATE POLICY "members" ON "public"."challenge_goals"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."challenge_members"
  ADD CONSTRAINT "challenge_members_together_id_profile_id_fkey" FOREIGN KEY (together_id, profile_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."challenge_members"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

CREATE POLICY "members" ON "public"."challenge_periods"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."challenge_periods"
  ADD COLUMN "decided_by" uuid DEFAULT auth.uid();

ALTER TABLE "public"."challenge_periods"
  ADD CONSTRAINT "challenge_periods_decided_by_fkey" FOREIGN KEY (decided_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."challenge_progress"
  ADD CONSTRAINT "challenge_progress_goal_id_together_id_fkey" FOREIGN KEY (goal_id, together_id) REFERENCES public.challenge_goals(id, together_id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."challenge_progress"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."challenge_progress"
  ADD CONSTRAINT "challenge_progress_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."challenge_goals"
  ADD CONSTRAINT "challenge_goals_challenge_id_together_id_fkey" FOREIGN KEY (challenge_id, together_id) REFERENCES public.challenges(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."challenge_members"
  ADD CONSTRAINT "challenge_members_challenge_id_together_id_fkey" FOREIGN KEY (challenge_id, together_id) REFERENCES public.challenges(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."challenge_periods"
  ADD CONSTRAINT "challenge_periods_challenge_id_together_id_fkey" FOREIGN KEY (challenge_id, together_id) REFERENCES public.challenges(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."challenges"
  ADD CONSTRAINT "challenges_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."challenges"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."challenges"
  ADD COLUMN "created_by" uuid DEFAULT auth.uid();

ALTER TABLE "public"."challenges"
  ADD CONSTRAINT "challenges_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
