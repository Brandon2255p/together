-- Keeps file rows honest when members edit them (rename, move, tag, bin, restore):
--   * tags are trimmed, lowercased, de-duplicated and kept short;
--   * what was uploaded (kind, sizes, key, MAC, paths, who, when) can't change, nor can the status (v1_finish_upload
--     does that);
--   * the bin records who moved it there and when, using the clock rather than what the app sent.
-- Functions that run as the owner (security definer: v1_finish_upload, v1_empty_bin, the purge) skip the member rules.
create or replace function public.files_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke execute on function public.files_guard() from public, anon, authenticated;

create trigger files_guard
  before insert or update on public.files
  for each row execute function public.files_guard();
