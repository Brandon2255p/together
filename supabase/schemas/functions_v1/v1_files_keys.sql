-- The current Together's file encryption keys, for the browser to encrypt and decrypt with (lib/files/crypto.ts).
-- Every version that still exists comes back, so files encrypted before a rotation stay readable; `active` marks the
-- one new uploads use. The first call makes version 1: 32 random bytes, stored in Supabase Vault.
-- Members only. The keys never touch a table the app can read (tables/25_together_keys.sql).

create function public.v1_files_keys()
returns table (version integer, key text, active boolean)
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.v1_files_keys() from public, anon;
grant execute on function public.v1_files_keys() to authenticated;
