-- A new file has to fit in its Together's storage quota. Everything counts: ready files, the bin (until it's purged)
-- and uploads still in progress. Locking the Together's row makes two people uploading at once take turns, so together
-- they can't go over.
create or replace function public.files_check_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.files_check_quota() from public, anon, authenticated;

create trigger files_check_quota
  before insert on public.files
  for each row execute function public.files_check_quota();
