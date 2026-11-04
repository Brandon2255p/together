SET local check_function_bodies = off;

CREATE TABLE "public"."chore_assignees" (
  "chore_id"   uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  CONSTRAINT "chore_assignees_pkey" PRIMARY KEY (chore_id, profile_id)
);

ALTER TABLE "public"."chore_assignees"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."chore_completions" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "chore_id"     uuid                     NOT NULL,
  "together_id"  uuid                     NOT NULL,
  "due"          date,
  "completed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chore_completions_pkey" PRIMARY KEY (id),
  "completed_by" uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."chore_completions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."chores" (
  "id"    uuid NOT NULL DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "due"   date,
  CONSTRAINT "chores_pkey" PRIMARY KEY (id),
  CONSTRAINT "chores_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120)))
);

ALTER TABLE "public"."chores"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."event_attendees" (
  "event_id"   uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  CONSTRAINT "event_attendees_pkey" PRIMARY KEY (event_id, profile_id)
);

ALTER TABLE "public"."event_attendees"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."events" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"      text                     NOT NULL,
  "day"        date                     NOT NULL,
  "start_time" time without time zone,
  "location"   text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "events_location_check" CHECK ((char_length(location) <= 120)),
  CONSTRAINT "events_pkey" PRIMARY KEY (id),
  CONSTRAINT "events_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120))),
  "created_by" uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."goal_owners" (
  "goal_id"    uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  CONSTRAINT "goal_owners_pkey" PRIMARY KEY (goal_id, profile_id)
);

ALTER TABLE "public"."goal_owners"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."goals" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"        text                     NOT NULL,
  "saved_cents"  bigint                   NOT NULL DEFAULT 0,
  "target_cents" bigint                   NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "goals_pkey" PRIMARY KEY (id),
  CONSTRAINT "goals_saved_cents_check" CHECK ((saved_cents >= 0)),
  CONSTRAINT "goals_target_cents_check" CHECK ((target_cents > 0)),
  CONSTRAINT "goals_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120)))
);

ALTER TABLE "public"."goals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."item_history" (
  "together_id"   uuid                     NOT NULL,
  "name_key"      text                     NOT NULL,
  "name"          text                     NOT NULL,
  "times_added"   integer                  NOT NULL DEFAULT 1,
  "last_added_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "item_history_pkey" PRIMARY KEY (together_id, name_key)
);

ALTER TABLE "public"."item_history"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."place_ratings" (
  "place_id"   uuid                     NOT NULL,
  "rating"     smallint                 NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "place_ratings_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
  "profile_id" uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "place_ratings_pkey" PRIMARY KEY (place_id, profile_id)
);

ALTER TABLE "public"."place_ratings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."places" (
  "id"       uuid NOT NULL DEFAULT gen_random_uuid(),
  "name"     text NOT NULL,
  "category" text NOT NULL DEFAULT ''::text,
  "area"     text NOT NULL DEFAULT ''::text,
  "maps_url" text,
  CONSTRAINT "places_area_check" CHECK ((char_length(area) <= 60)),
  CONSTRAINT "places_category_check" CHECK ((char_length(category) <= 40)),
  CONSTRAINT "places_maps_url_check" CHECK ((maps_url ~ '^https://'::text)),
  CONSTRAINT "places_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120))),
  CONSTRAINT "places_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."places"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 40))),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."shopping_items" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "quantity"   integer                  NOT NULL DEFAULT 1,
  "done_at"    timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "shopping_items_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 80))),
  CONSTRAINT "shopping_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "shopping_items_quantity_check" CHECK (((quantity >= 1) AND (quantity <= 99))),
  "added_by"   uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."shopping_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."together_members" (
  "together_id" uuid NOT NULL,
  "profile_id"  uuid NOT NULL,
  CONSTRAINT "together_members_pkey" PRIMARY KEY (together_id, profile_id),
  CONSTRAINT "together_members_profile_id_key" UNIQUE (profile_id)
);

ALTER TABLE "public"."together_members"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."togethers" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"        text                     NOT NULL,
  "invite_code" text                     NOT NULL,
  "time_zone"   text                     NOT NULL DEFAULT 'Africa/Johannesburg'::text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "togethers_invite_code_check" CHECK ((invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'::text)),
  CONSTRAINT "togethers_invite_code_key" UNIQUE (invite_code),
  CONSTRAINT "togethers_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))),
  CONSTRAINT "togethers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."togethers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."visits" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "place_id"   uuid                     NOT NULL,
  "day"        date                     NOT NULL,
  "title"      text                     NOT NULL,
  "note"       text,
  "rating"     smallint,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "visits_note_check" CHECK ((char_length(note) <= 500)),
  CONSTRAINT "visits_pkey" PRIMARY KEY (id),
  CONSTRAINT "visits_rating_check" CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT "visits_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120))),
  "created_by" uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."visits"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."wish_claims" (
  "wish_id"    uuid                     NOT NULL,
  "claimed_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "wish_claims_pkey" PRIMARY KEY (wish_id),
  "claimed_by" uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."wish_claims"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."wishes" (
  "id"          uuid   NOT NULL DEFAULT gen_random_uuid(),
  "name"        text   NOT NULL,
  "price_cents" bigint,
  "url"         text,
  CONSTRAINT "wishes_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 120))),
  CONSTRAINT "wishes_pkey" PRIMARY KEY (id),
  CONSTRAINT "wishes_price_cents_check" CHECK ((price_cents >= 0)),
  CONSTRAINT "wishes_url_check" CHECK ((url ~ '^https?://'::text)),
  "owner_id"    uuid   NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "public"."wishes"
  ENABLE ROW LEVEL SECURITY;

CREATE TYPE "public"."chore_repeat" AS ENUM (
  'once',
  'daily',
  'weekly',
  'monthly'
);

ALTER TABLE "public"."chores"
  ADD COLUMN "repeat" public.chore_repeat NOT NULL DEFAULT 'once'::public.chore_repeat;

ALTER TABLE "public"."chores"
  ADD COLUMN "done_at" timestamp WITH time zone;

ALTER TABLE "public"."chores"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE TYPE "public"."hue" AS ENUM (
  'accent',
  'partner',
  'success',
  'warning'
);

ALTER TABLE "public"."wishes"
  ADD COLUMN "hue" public.hue NOT NULL DEFAULT 'accent'::public.hue;

ALTER TABLE "public"."wishes"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE TYPE "public"."member_tone" AS ENUM (
  'accent',
  'partner'
);

ALTER TABLE "public"."together_members"
  ADD COLUMN "tone" public.member_tone NOT NULL;

ALTER TABLE "public"."together_members"
  ADD COLUMN "joined_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE TYPE "public"."place_status" AS ENUM (
  'been',
  'want'
);

ALTER TABLE "public"."places"
  ADD COLUMN "status" public.place_status NOT NULL DEFAULT 'want'::public.place_status;

ALTER TABLE "public"."places"
  ADD COLUMN "hue" public.hue NOT NULL DEFAULT 'accent'::public.hue;

ALTER TABLE "public"."places"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1), 'You'), 40)
  );
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.mark_place_visited()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  update public.places set status = 'been' where id = new.place_id and status <> 'been';
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."mark_place_visited"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.my_together_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select m.together_id from public.together_members m where m.profile_id = (select auth.uid());
$function$;

REVOKE ALL ON FUNCTION "public"."my_together_id"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.new_invite_code()
  RETURNS text
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$function$;

REVOKE ALL ON FUNCTION "public"."new_invite_code"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.record_item_history()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.item_history (together_id, name_key, name)
  values (new.together_id, lower(btrim(new.name)), btrim(new.name))
  on conflict (together_id, name_key) do update
    set times_added = public.item_history.times_added + 1,
        name = excluded.name,
        last_added_at = now();
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."record_item_history"() FROM PUBLIC, "anon", "authenticated";

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

  insert into public.together_members (together_id, profile_id, tone) values (t_id, me, 'accent');
  return t_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_create_together"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_item_catalog()
  RETURNS TABLE (
    name        text,
    times_added integer,
    popular     boolean
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  with mine as (
    select h.name_key, h.name, h.times_added
    from public.item_history h
    where h.together_id = public.my_together_id()
  ),
  popular as (
    select h.name_key, min(h.name) as name
    from public.item_history h
    group by h.name_key
    having count(*) >= 3
    order by count(*) desc
    limit 200
  )
  select coalesce(m.name, p.name), coalesce(m.times_added, 0), p.name_key is not null
  from mine m
  full join popular p using (name_key)
  where public.my_together_id() is not null;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_item_catalog"() FROM PUBLIC, "anon";

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

  select tone into free_tone from unnest(enum_range(null::public.member_tone)) as tone
  where tone not in (select m.tone from public.together_members m where m.together_id = t_id)
  limit 1;

  if free_tone is null then
    raise exception 'That Together already has two people.' using errcode = '23514';
  end if;

  insert into public.together_members (together_id, profile_id, tone) values (t_id, me, free_tone);
  return t_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_join_together"(text) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_set_chore_done (
  p_chore_id uuid,
  p_done     boolean
)
  RETURNS public.chores
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
declare
  c public.chores;
  today date;
  step interval;
  base date;
  n integer := 1;
begin
  select * into c from public.chores where id = p_chore_id for update;
  if not found then
    raise exception 'That chore was removed.' using errcode = 'P0002';
  end if;

  if p_done then
    insert into public.chore_completions (chore_id, together_id, due) values (c.id, c.together_id, c.due);
  end if;

  if p_done and c.repeat <> 'once' then
    select (now() at time zone t.time_zone)::date into today from public.togethers t where t.id = c.together_id;
    step := case c.repeat when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end;
    base := coalesce(c.due, today);
    while (base + step * n)::date <= today loop
      n := n + 1;
    end loop;
    update public.chores set due = (base + step * n)::date, done_at = null where id = c.id returning * into c;
  else
    update public.chores set done_at = case when p_done then now() end where id = c.id returning * into c;
  end if;

  return c;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_set_chore_done"(uuid, boolean) FROM PUBLIC, "anon";

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."together_members"
  ADD CONSTRAINT "together_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."together_members"
  ADD CONSTRAINT "together_members_together_id_tone_key" UNIQUE (together_id, tone);

ALTER TABLE "public"."item_history"
  ADD CONSTRAINT "item_history_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

ALTER TABLE "public"."together_members"
  ADD CONSTRAINT "together_members_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE INDEX chore_completions_chore_idx ON public.chore_completions USING btree (chore_id, completed_at DESC);

CREATE INDEX item_history_name_key_idx ON public.item_history USING btree (name_key);

CREATE INDEX visits_place_idx ON public.visits USING btree (place_id, day DESC);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER shopping_items_history
  AFTER INSERT ON public.shopping_items
  FOR EACH ROW
  EXECUTE FUNCTION public.record_item_history();

CREATE TRIGGER visits_mark_place_visited
  AFTER INSERT ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_place_visited();

CREATE POLICY "members read" ON "public"."chore_completions"
  FOR SELECT
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

CREATE POLICY "members read" ON "public"."item_history"
  FOR SELECT
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

CREATE POLICY "read self and my together" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((id = ( SELECT auth.uid() AS uid)) OR (id IN ( SELECT m.profile_id
   FROM public.together_members m
  WHERE (m.together_id = ( SELECT public.my_together_id() AS my_together_id))))));

CREATE POLICY "update self" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "members read" ON "public"."together_members"
  FOR SELECT
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

CREATE POLICY "leave" ON "public"."together_members"
  FOR DELETE
  TO "authenticated"
  USING ((profile_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "members read" ON "public"."togethers"
  FOR SELECT
  TO "authenticated"
  USING ((id = ( SELECT public.my_together_id() AS my_together_id)));

CREATE POLICY "members rename" ON "public"."togethers"
  FOR UPDATE
  TO "authenticated"
  USING ((id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."chore_assignees";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."chores";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."events";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."places";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."shopping_items";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."wishes";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."mark_place_visited"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."mark_place_visited"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."mark_place_visited"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."my_together_id"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."my_together_id"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."my_together_id"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."my_together_id"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."new_invite_code"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."new_invite_code"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."new_invite_code"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."record_item_history"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_item_history"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."record_item_history"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_create_together"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_create_together"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_create_together"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_create_together"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_item_catalog"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_item_catalog"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_item_catalog"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_item_catalog"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_join_together"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_join_together"(text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_join_together"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_join_together"(text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_set_chore_done"(uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_set_chore_done"(uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_set_chore_done"(uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_set_chore_done"(uuid, boolean) TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chore_assignees" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."chore_assignees" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chore_assignees" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chore_assignees" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chore_completions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."chore_completions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chore_completions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chore_completions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chores" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."chores" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chores" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."chores" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_attendees" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."event_attendees" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_attendees" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."event_attendees" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goal_owners" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."goal_owners" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goal_owners" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goal_owners" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."goals" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."goals" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."item_history" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."item_history" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."item_history" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."item_history" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."place_ratings" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."place_ratings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."place_ratings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."place_ratings" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."places" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."places" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."places" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."places" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."shopping_items" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."shopping_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."shopping_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."shopping_items" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."together_members" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."together_members" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."together_members" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."together_members" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."togethers" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."togethers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."togethers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."togethers" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visits" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."visits" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visits" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."visits" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wish_claims" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."wish_claims" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wish_claims" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wish_claims" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wishes" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."wishes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wishes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."wishes" TO "service_role";

ALTER TABLE "public"."chore_assignees"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."chore_assignees"
  ADD CONSTRAINT "chore_assignees_together_id_profile_id_fkey" FOREIGN KEY (together_id, profile_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."chore_assignees"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."chore_completions"
  ADD CONSTRAINT "chore_completions_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE POLICY "log as self" ON "public"."chore_completions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (completed_by = ( SELECT auth.uid() AS uid))));

ALTER TABLE "public"."chores"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."chores"
  ADD CONSTRAINT "chores_id_together_id_key" UNIQUE (id, together_id);

ALTER TABLE "public"."chore_assignees"
  ADD CONSTRAINT "chore_assignees_chore_id_together_id_fkey" FOREIGN KEY (chore_id, together_id) REFERENCES public.chores(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."chore_completions"
  ADD CONSTRAINT "chore_completions_chore_id_together_id_fkey" FOREIGN KEY (chore_id, together_id) REFERENCES public.chores(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."chores"
  ADD CONSTRAINT "chores_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE INDEX chores_together_due_idx ON public.chores USING btree (together_id, due);

CREATE POLICY "members" ON "public"."chores"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."chores"
  ADD COLUMN "created_by" uuid DEFAULT auth.uid();

ALTER TABLE "public"."chores"
  ADD CONSTRAINT "chores_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."event_attendees"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."event_attendees"
  ADD CONSTRAINT "event_attendees_together_id_profile_id_fkey" FOREIGN KEY (together_id, profile_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."event_attendees"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."events"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_id_together_id_key" UNIQUE (id, together_id);

ALTER TABLE "public"."event_attendees"
  ADD CONSTRAINT "event_attendees_event_id_together_id_fkey" FOREIGN KEY (event_id, together_id) REFERENCES public.events(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE INDEX events_together_day_idx ON public.events USING btree (together_id, day);

CREATE POLICY "members" ON "public"."events"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."goal_owners"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."goal_owners"
  ADD CONSTRAINT "goal_owners_together_id_profile_id_fkey" FOREIGN KEY (together_id, profile_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."goal_owners"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."goals"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."goals"
  ADD CONSTRAINT "goals_id_together_id_key" UNIQUE (id, together_id);

ALTER TABLE "public"."goal_owners"
  ADD CONSTRAINT "goal_owners_goal_id_together_id_fkey" FOREIGN KEY (goal_id, together_id) REFERENCES public.goals(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."goals"
  ADD CONSTRAINT "goals_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."goals"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."place_ratings"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

CREATE POLICY "members read" ON "public"."place_ratings"
  FOR SELECT
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."place_ratings"
  ADD CONSTRAINT "place_ratings_together_id_profile_id_fkey" FOREIGN KEY (together_id, profile_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE POLICY "change own" ON "public"."place_ratings"
  FOR UPDATE
  TO "authenticated"
  USING ((profile_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "rate as self" ON "public"."place_ratings"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (profile_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "remove own" ON "public"."place_ratings"
  FOR DELETE
  TO "authenticated"
  USING ((profile_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."places"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_id_together_id_key" UNIQUE (id, together_id);

ALTER TABLE "public"."place_ratings"
  ADD CONSTRAINT "place_ratings_place_id_together_id_fkey" FOREIGN KEY (place_id, together_id) REFERENCES public.places(id, together_id) ON DELETE CASCADE;

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE INDEX places_together_idx ON public.places USING btree (together_id, status);

CREATE POLICY "members" ON "public"."places"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."places"
  ADD COLUMN "created_by" uuid DEFAULT auth.uid();

ALTER TABLE "public"."places"
  ADD CONSTRAINT "places_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."shopping_items"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."shopping_items"
  ADD CONSTRAINT "shopping_items_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE INDEX shopping_items_together_idx ON public.shopping_items USING btree (together_id, done_at);

CREATE POLICY "members" ON "public"."shopping_items"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."shopping_items"
  ADD CONSTRAINT "shopping_items_added_by_fkey" FOREIGN KEY (added_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE POLICY "add as self" ON "public"."shopping_items"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((added_by = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."visits"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."visits"
  ADD CONSTRAINT "visits_place_id_together_id_fkey" FOREIGN KEY (place_id, together_id) REFERENCES public.places(id, together_id) ON DELETE CASCADE;

CREATE POLICY "members" ON "public"."visits"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."visits"
  ADD CONSTRAINT "visits_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."wish_claims"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."wish_claims"
  ADD CONSTRAINT "wish_claims_together_id_claimed_by_fkey" FOREIGN KEY (together_id, claimed_by) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE POLICY "unclaim own" ON "public"."wish_claims"
  FOR DELETE
  TO "authenticated"
  USING ((claimed_by = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."wishes"
  ADD COLUMN "together_id" uuid NOT NULL DEFAULT public.my_together_id();

ALTER TABLE "public"."wishes"
  ADD CONSTRAINT "wishes_id_together_id_key" UNIQUE (id, together_id);

ALTER TABLE "public"."wish_claims"
  ADD CONSTRAINT "wish_claims_wish_id_together_id_fkey" FOREIGN KEY (wish_id, together_id) REFERENCES public.wishes(id, together_id) ON DELETE CASCADE;

CREATE POLICY "members read" ON "public"."wishes"
  FOR SELECT
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."wishes"
  ADD CONSTRAINT "wishes_together_id_owner_id_fkey" FOREIGN KEY (together_id, owner_id) REFERENCES public.together_members(together_id, profile_id) ON DELETE CASCADE;

CREATE INDEX wishes_owner_idx ON public.wishes USING btree (together_id, owner_id);

CREATE POLICY "claim as self" ON "public"."wish_claims"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (claimed_by = ( SELECT auth.uid() AS uid)) AND (NOT (EXISTS ( SELECT 1
   FROM public.wishes w
  WHERE ((w.id = wish_claims.wish_id) AND (w.owner_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY "everyone but the owner reads" ON "public"."wish_claims"
  FOR SELECT
  TO "authenticated"
  USING (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (NOT (EXISTS ( SELECT 1
   FROM public.wishes w
  WHERE ((w.id = wish_claims.wish_id) AND (w.owner_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY "add own" ON "public"."wishes"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (owner_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "edit own" ON "public"."wishes"
  FOR UPDATE
  TO "authenticated"
  USING ((owner_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((owner_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "remove own" ON "public"."wishes"
  FOR DELETE
  TO "authenticated"
  USING ((owner_id = ( SELECT auth.uid() AS uid)));
