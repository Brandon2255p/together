SET local check_function_bodies = off;

CREATE TABLE "public"."file_folders" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"        text                     NOT NULL,
  "hue"         public.hue               NOT NULL DEFAULT 'accent'::public.hue,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "file_folders_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 60))),
  CONSTRAINT "file_folders_pkey" PRIMARY KEY (id),
  "together_id" uuid                     NOT NULL DEFAULT public.my_together_id(),
  CONSTRAINT "file_folders_id_together_id_key" UNIQUE (id, together_id),
  "created_by"  uuid                     DEFAULT auth.uid()
);

ALTER TABLE "public"."file_folders"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."files" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT "files_pkey" PRIMARY KEY (id),
  "together_id" uuid NOT NULL DEFAULT public.my_together_id()
);

ALTER TABLE "public"."files"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."together_keys" (
  "together_id"     uuid                     NOT NULL,
  "version"         integer                  NOT NULL,
  "vault_secret_id" uuid                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "retired_at"      timestamp with time zone,
  CONSTRAINT "together_keys_pkey" PRIMARY KEY (together_id, VERSION),
  CONSTRAINT "together_keys_vault_secret_id_key" UNIQUE (vault_secret_id),
  CONSTRAINT "together_keys_version_check" CHECK ((version > 0))
);

ALTER TABLE "public"."together_keys"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."togethers"
  ADD COLUMN "storage_quota_bytes" bigint NOT NULL DEFAULT '53687091200'::bigint;

CREATE TYPE "public"."file_kind" AS ENUM (
  'photo',
  'video',
  'document'
);

ALTER TABLE "public"."files"
  ADD COLUMN "kind" public.file_kind NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "name" text NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "mime_type" text NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "size_bytes" bigint NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "stored_bytes" bigint NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "key_version" integer NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "content_mac" text NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "original_path" text NOT NULL;

ALTER TABLE "public"."files"
  ADD COLUMN "thumb_path" text;

ALTER TABLE "public"."files"
  ADD COLUMN "preview_path" text;

ALTER TABLE "public"."files"
  ADD COLUMN "width" integer;

ALTER TABLE "public"."files"
  ADD COLUMN "height" integer;

ALTER TABLE "public"."files"
  ADD COLUMN "duration_ms" integer;

ALTER TABLE "public"."files"
  ADD COLUMN "taken_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."files"
  ADD COLUMN "folder_id" uuid;

ALTER TABLE "public"."files"
  ADD COLUMN "tags" text[] NOT NULL DEFAULT '{}'::text[];

CREATE TYPE "public"."file_status" AS ENUM (
  'uploading',
  'ready'
);

ALTER TABLE "public"."files"
  ADD COLUMN "status" public.file_status NOT NULL DEFAULT 'uploading'::public.file_status;

ALTER TABLE "public"."files"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."files"
  ADD COLUMN "deleted_at" timestamp WITH time zone;

ALTER TABLE "public"."files"
  ADD COLUMN "deleted_by" uuid;

CREATE OR REPLACE FUNCTION public.file_folders_only_empty()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if exists (select 1 from public.files where folder_id = old.id and deleted_at is null) then
    raise exception 'Move or bin the files in this folder first.' using errcode = '23503';
  end if;
  return old;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."file_folders_only_empty"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.files_check_quota()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_quota bigint;
  v_used bigint;
begin
  select storage_quota_bytes into v_quota from public.togethers where id = new.together_id for update;
  select coalesce(sum(stored_bytes), 0) into v_used from public.files where together_id = new.together_id;
  if v_used + new.stored_bytes > v_quota then
    raise exception 'Not enough space: % bytes needed, % left.', new.stored_bytes, greatest(v_quota - v_used, 0)
      using errcode = '53100';
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."files_check_quota"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.files_guard()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.tags := coalesce(
    (select array_agg(distinct t order by t) from (select lower(btrim(x)) t from unnest(new.tags) x) s
     where t <> '' and char_length(t) <= 30),
    '{}'
  );

  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    if (new.id, new.together_id, new.kind, new.mime_type, new.size_bytes, new.stored_bytes, new.key_version,
        new.content_mac, new.original_path, new.thumb_path, new.preview_path, new.width, new.height, new.duration_ms,
        new.uploaded_by, new.created_at, new.status)
       is distinct from
       (old.id, old.together_id, old.kind, old.mime_type, old.size_bytes, old.stored_bytes, old.key_version,
        old.content_mac, old.original_path, old.thumb_path, old.preview_path, old.width, old.height, old.duration_ms,
        old.uploaded_by, old.created_at, old.status) then
      raise exception 'Only the name, folder, tags, date taken and bin can change.' using errcode = '42501';
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      new.deleted_at := now();
      new.deleted_by := auth.uid();
    elsif new.deleted_at is null then
      new.deleted_by := null;
    else
      new.deleted_at := old.deleted_at;
      new.deleted_by := old.deleted_by;
    end if;
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."files_guard"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.protect_storage_quota()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if new.storage_quota_bytes is distinct from old.storage_quota_bytes and current_user in ('authenticated', 'anon') then
    raise exception 'The storage limit can''t be changed here.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."protect_storage_quota"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.v1_empty_bin()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_count integer;
begin
  if public.my_together_id() is null then
    raise exception 'You''re not in a Together yet.' using errcode = '42501';
  end if;
  update public.files
  set deleted_at = least(deleted_at, now() - interval '30 days')
  where together_id = public.my_together_id() and deleted_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_empty_bin"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_file_months (
  p_kinds public.file_kind[] DEFAULT NULL::public.file_kind[]
)
  RETURNS TABLE (
    year  integer,
    month integer,
    count integer
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select
    extract(year from f.taken_at at time zone t.time_zone)::integer,
    extract(month from f.taken_at at time zone t.time_zone)::integer,
    count(*)::integer
  from public.files f
  join public.togethers t on t.id = f.together_id
  where f.together_id = (select public.my_together_id())
    and f.status = 'ready'
    and f.deleted_at is null
    and (p_kinds is null or f.kind = any (p_kinds))
  group by 1, 2
  order by 1 desc, 2 desc;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_file_months"(public.file_kind[]) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_files_keys()
  RETURNS TABLE (
    version integer,
    key     text,
    active  boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
#variable_conflict use_column
declare
  v_together uuid := public.my_together_id();
  v_version integer;
  v_secret uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if v_together is null then
    raise exception 'You''re not in a Together yet.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.together_keys k where k.together_id = v_together and k.retired_at is null) then
    -- two members opening the app at once make one key, not two
    perform pg_advisory_xact_lock(hashtextextended('together_keys:' || v_together::text, 0));
    if not exists (select 1 from public.together_keys k where k.together_id = v_together and k.retired_at is null) then
      select coalesce(max(k.version), 0) + 1 into v_version from public.together_keys k where k.together_id = v_together;
      v_secret := vault.create_secret(
        encode(extensions.gen_random_bytes(32), 'base64'),
        'together_files_' || v_together::text || '_v' || v_version,
        'File encryption key for a Together'
      );
      insert into public.together_keys (together_id, version, vault_secret_id) values (v_together, v_version, v_secret);
    end if;
  end if;

  return query
    select k.version, s.decrypted_secret::text, k.retired_at is null
    from public.together_keys k
    join vault.decrypted_secrets s on s.id = k.vault_secret_id
    where k.together_id = v_together
    order by k.version;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_files_keys"() FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_find_duplicates (
  p_macs text[]
)
  RETURNS TABLE (
    content_mac      text,
    file_id          uuid,
    name             text,
    uploaded_by_name text,
    created_at       timestamp with time zone,
    in_bin           boolean
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select f.content_mac, f.id, f.name, p.name, f.created_at, f.deleted_at is not null
  from public.files f
  left join public.profiles p on p.id = f.uploaded_by
  where f.together_id = (select public.my_together_id())
    and f.status = 'ready'
    and f.content_mac = any (p_macs);
$function$;

REVOKE ALL ON FUNCTION "public"."v1_find_duplicates"(text[]) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_finish_upload (
  p_id uuid
)
  RETURNS public.files
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_file public.files;
  v_expected integer;
  v_count integer;
  v_size bigint;
begin
  select * into v_file from public.files
  where id = p_id
    and together_id = public.my_together_id()
    and uploaded_by = auth.uid()
    and status = 'uploading'
  for update;
  if not found then
    raise exception 'That upload isn''t waiting to finish.' using errcode = 'P0002';
  end if;

  v_expected := 1 + (v_file.thumb_path is not null)::integer + (v_file.preview_path is not null)::integer;
  select count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_count, v_size
  from storage.objects o
  where o.bucket_id = 'files' and o.name in (v_file.original_path, v_file.thumb_path, v_file.preview_path);

  if v_count <> v_expected then
    raise exception 'Part of the upload is missing.' using errcode = 'P0002';
  end if;
  if v_size > v_file.stored_bytes or v_size = 0 then
    raise exception 'The upload doesn''t match what was expected.' using errcode = '22023';
  end if;

  update public.files set status = 'ready', stored_bytes = v_size where id = p_id returning * into v_file;
  return v_file;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_finish_upload"(uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_search_files (
  p_query           text                     DEFAULT NULL::text,
  p_kinds           public.file_kind[]       DEFAULT NULL::public.file_kind[],
  p_year            integer                  DEFAULT NULL::integer,
  p_month           integer                  DEFAULT NULL::integer,
  p_limit           integer                  DEFAULT 50,
  p_before_taken_at timestamp with time zone DEFAULT NULL::timestamp WITH time zone,
  p_before_id       uuid                     DEFAULT NULL::uuid
)
  RETURNS SETOF public.files
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
  AS $function$
declare
  v_words text[];
begin
  if p_month is not null and p_year is null then
    raise exception 'Pick a year before a month.' using errcode = '22023';
  end if;
  if p_month is not null and p_month not between 1 and 12 then
    raise exception 'There''s no month %.', p_month using errcode = '22023';
  end if;

  -- words, with LIKE's wildcards escaped
  select coalesce(array_agg(replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_')), '{}')
  into v_words
  from unnest(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+')) w
  where w <> '';

  return query
    select f.*
    from public.files f
    join public.togethers t on t.id = f.together_id
    left join public.file_folders d on d.id = f.folder_id
    left join public.profiles p on p.id = f.uploaded_by
    where f.together_id = (select public.my_together_id())
      and f.status = 'ready'
      and f.deleted_at is null
      and (p_kinds is null or f.kind = any (p_kinds))
      and (p_year is null or extract(year from f.taken_at at time zone t.time_zone) = p_year)
      and (p_month is null or extract(month from f.taken_at at time zone t.time_zone) = p_month)
      and (p_before_taken_at is null or (f.taken_at, f.id) < (p_before_taken_at, p_before_id))
      and not exists (
        select 1 from unnest(v_words) w
        where not (
          lower(f.name) like '%' || w || '%'
          or exists (select 1 from unnest(f.tags) tag where tag like '%' || w || '%')
          or lower(coalesce(d.name, '')) like '%' || w || '%'
          or lower(coalesce(p.name, '')) like '%' || w || '%'
        )
      )
    order by f.taken_at desc, f.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$function$;

REVOKE ALL ON FUNCTION "public"."v1_search_files"(text, public.file_kind[], integer, integer, integer, timestamp WITH time zone, uuid) FROM PUBLIC, "anon";

CREATE OR REPLACE FUNCTION public.v1_storage_usage()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  with mine as (
    select f.kind, f.stored_bytes, f.status, f.deleted_at
    from public.files f
    where f.together_id = (select public.my_together_id())
  ),
  part as (
    select
      case when deleted_at is not null then 'bin' else kind::text || 's' end as name,
      count(*)::integer as count,
      sum(stored_bytes)::bigint as bytes
    from mine
    where status = 'ready' or deleted_at is not null
    group by 1
  )
  select jsonb_build_object(
    'quota_bytes', t.storage_quota_bytes,
    'used_bytes', (select coalesce(sum(stored_bytes), 0)::bigint from mine),
    'photos', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'photos'), '{"count": 0, "bytes": 0}'),
    'videos', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'videos'), '{"count": 0, "bytes": 0}'),
    'documents', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'documents'), '{"count": 0, "bytes": 0}'),
    'bin', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'bin'), '{"count": 0, "bytes": 0}')
  )
  from public.togethers t
  where t.id = (select public.my_together_id());
$function$;

REVOKE ALL ON FUNCTION "public"."v1_storage_usage"() FROM PUBLIC, "anon";

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_check3" CHECK (((kind = 'document'::public.file_kind) OR ((folder_id IS NULL) AND (tags = '{}'::text[]))));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_check4" CHECK (((kind <> 'document'::public.file_kind) OR ((thumb_path IS NULL) AND (preview_path IS NULL))));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_check5" CHECK (((kind = 'video'::public.file_kind) OR (duration_ms IS NULL)));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_content_mac_check" CHECK ((content_mac ~ '^[0-9a-f]{64}$'::text));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_deleted_by_fkey" FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_duration_ms_check" CHECK ((duration_ms >= 0));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_height_check" CHECK ((height > 0));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_mime_type_check" CHECK (((char_length(mime_type) >= 1) AND (char_length(mime_type) <= 200)));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_name_check" CHECK (((char_length(btrim(name)) >= 1) AND (char_length(btrim(name)) <= 200)));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_size_bytes_check" CHECK ((size_bytes >= 0));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_stored_bytes_check" CHECK ((stored_bytes > 0));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_tags_check" CHECK ((cardinality(tags) <= 10));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_width_check" CHECK ((width > 0));

ALTER TABLE "public"."together_keys"
  ADD CONSTRAINT "together_keys_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

ALTER TABLE "public"."togethers"
  ADD CONSTRAINT "togethers_storage_quota_bytes_check" CHECK ((storage_quota_bytes > 0));

CREATE INDEX files_tags_idx ON public.files USING gin (tags);

CREATE UNIQUE INDEX together_keys_active_idx ON public.together_keys USING btree (together_id)
  WHERE (retired_at IS NULL);

CREATE TRIGGER file_folders_only_empty
  BEFORE DELETE ON public.file_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.file_folders_only_empty();

CREATE TRIGGER files_check_quota
  BEFORE INSERT ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.files_check_quota();

CREATE TRIGGER files_guard
  BEFORE INSERT OR UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.files_guard();

CREATE TRIGGER togethers_protect_storage_quota
  BEFORE UPDATE ON public.togethers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_storage_quota();

CREATE POLICY "files: members read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'files'::text) AND ((storage.foldername(name))[1] = (( SELECT public.my_together_id() AS my_together_id))::text)));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."file_folders";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."files";

REVOKE ALL ON FUNCTION "public"."file_folders_only_empty"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."file_folders_only_empty"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."file_folders_only_empty"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."files_check_quota"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."files_check_quota"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."files_check_quota"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."files_guard"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."files_guard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."files_guard"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."protect_storage_quota"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_storage_quota"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."protect_storage_quota"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_empty_bin"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_empty_bin"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_empty_bin"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_empty_bin"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_file_months"(public.file_kind[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_file_months"(public.file_kind[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_file_months"(public.file_kind[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_file_months"(public.file_kind[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_files_keys"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_files_keys"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_files_keys"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_files_keys"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_find_duplicates"(text[]) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_find_duplicates"(text[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_find_duplicates"(text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_find_duplicates"(text[]) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_finish_upload"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_finish_upload"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_finish_upload"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_finish_upload"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_search_files"(text, public.file_kind[], integer, integer, integer, timestamp WITH time zone, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_search_files"(text, public.file_kind[], integer, integer, integer, timestamp WITH time zone, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_search_files"(text, public.file_kind[], integer, integer, integer, timestamp WITH time zone, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_search_files"(text, public.file_kind[], integer, integer, integer, timestamp WITH time zone, uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."v1_storage_usage"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."v1_storage_usage"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_storage_usage"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."v1_storage_usage"() TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."file_folders" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."file_folders" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."file_folders" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."file_folders" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."files" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."files" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."files" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."files" TO "service_role";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."together_keys" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."together_keys" FROM "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."together_keys" TO "postgres";

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."together_keys" TO "service_role";

ALTER TABLE "public"."file_folders"
  ADD CONSTRAINT "file_folders_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX file_folders_name_idx ON public.file_folders USING btree (together_id, lower(btrim(name)));

CREATE POLICY "members" ON "public"."file_folders"
  FOR ALL
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."file_folders"
  ADD CONSTRAINT "file_folders_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE POLICY "add as self" ON "public"."file_folders"
  AS RESTRICTIVE
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_check1" CHECK (((thumb_path IS NULL) OR (thumb_path = ((((together_id)::text || '/'::text) || (id)::text) || '/thumb.bin'::text))));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_check2" CHECK (((preview_path IS NULL) OR (preview_path = ((((together_id)::text || '/'::text) || (id)::text) || '/preview.bin'::text))));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_check" CHECK ((original_path = ((((together_id)::text || '/'::text) || (id)::text) || '/original.bin'::text)));

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_folder_id_together_id_fkey" FOREIGN KEY (folder_id, together_id) REFERENCES public.file_folders(id, together_id) ON DELETE SET NULL (folder_id);

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_together_id_content_mac_key" UNIQUE (together_id, content_mac);

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_together_id_fkey" FOREIGN KEY (together_id) REFERENCES public.togethers(id) ON DELETE CASCADE;

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_together_id_key_version_fkey" FOREIGN KEY (together_id, key_version) REFERENCES public.together_keys(together_id, VERSION);

CREATE INDEX files_bin_idx ON public.files USING btree (together_id, deleted_at)
  WHERE (deleted_at IS NOT NULL);

CREATE INDEX files_drive_idx ON public.files USING btree (together_id, folder_id, created_at DESC)
  WHERE ((status = 'ready'::public.file_status) AND (deleted_at IS NULL) AND (kind = 'document'::public.file_kind));

CREATE INDEX files_gallery_idx ON public.files USING btree (together_id, kind, taken_at DESC, id DESC)
  WHERE ((status = 'ready'::public.file_status) AND (deleted_at IS NULL));

CREATE POLICY "members edit" ON "public"."files"
  FOR UPDATE
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)))
  WITH CHECK ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

CREATE POLICY "members read" ON "public"."files"
  FOR SELECT
  TO "authenticated"
  USING ((together_id = ( SELECT public.my_together_id() AS my_together_id)));

ALTER TABLE "public"."files"
  ADD COLUMN "uploaded_by" uuid DEFAULT auth.uid();

ALTER TABLE "public"."files"
  ADD CONSTRAINT "files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE POLICY "members upload" ON "public"."files"
  FOR INSERT
  TO "authenticated"
  WITH
    CHECK
    (((together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (uploaded_by = ( SELECT auth.uid() AS uid)) AND (status = 'uploading'::public.file_status) AND
    (deleted_at IS NULL)));

CREATE POLICY "files: add your upload" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'files'::text) AND (EXISTS ( SELECT 1
   FROM public.files f
  WHERE
    ((f.together_id = ( SELECT public.my_together_id() AS my_together_id)) AND (f.uploaded_by = ( SELECT auth.uid() AS uid)) AND (f.status = 'uploading'::public.file_status) AND
    (((objects.name = f.original_path) OR (objects.name = f.thumb_path)) OR (objects.name = f.preview_path)))))));
