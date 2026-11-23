-- A folder can only be deleted when it's empty. Files in the bin don't count: they lose their folder (the foreign key
-- sets it to null) and come back without one if restored.
create or replace function public.file_folders_only_empty()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.files where folder_id = old.id and deleted_at is null) then
    raise exception 'Move or bin the files in this folder first.' using errcode = '23503';
  end if;
  return old;
end;
$$;

revoke execute on function public.file_folders_only_empty() from public, anon, authenticated;

create trigger file_folders_only_empty
  before delete on public.file_folders
  for each row execute function public.file_folders_only_empty();
