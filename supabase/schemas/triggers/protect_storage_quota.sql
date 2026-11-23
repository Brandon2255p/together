-- Members can rename their Together but not raise its storage quota. Only the service role (or a migration) can.
create or replace function public.protect_storage_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.storage_quota_bytes is distinct from old.storage_quota_bytes and current_user in ('authenticated', 'anon') then
    raise exception 'The storage limit can''t be changed here.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_storage_quota() from public, anon, authenticated;

create trigger togethers_protect_storage_quota
  before update on public.togethers
  for each row execute function public.protect_storage_quota();
