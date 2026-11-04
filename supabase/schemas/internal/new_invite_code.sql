-- Internal helpers: called by other functions, never by the app, so they aren't versioned.

-- 6 characters from an alphabet without look-alikes (0/O, 1/I)
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

revoke execute on function public.new_invite_code() from public, anon, authenticated;
