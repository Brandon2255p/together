-- Each Together's file encryption keys. The browser encrypts photos, videos and documents with them before upload
-- (lib/files/crypto.ts), so Storage only ever holds ciphertext. The 32-byte keys themselves live in Supabase Vault;
-- this table only says which Vault secret is which version. Every file row records the version that encrypted it, so a
-- later rotation can add version N+1, re-encrypt, and retire N.
--
-- RLS is on with no policies: nobody reads this table directly. Members get their keys through
-- functions_v1/v1_files_keys.sql, which also makes version 1 the first time it's asked.

create table public.together_keys (
  together_id uuid not null references public.togethers (id) on delete cascade,
  version integer not null check (version > 0),
  vault_secret_id uuid not null unique,
  created_at timestamptz not null default now(),
  -- set when a newer version takes over
  retired_at timestamptz,
  primary key (together_id, version)
);

-- one key in use per Together
create unique index together_keys_active_idx on public.together_keys (together_id) where retired_at is null;

alter table public.together_keys enable row level security;
