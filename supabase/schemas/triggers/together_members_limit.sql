-- Someone can be in at most 2 Togethers at once. Starting, joining or coming back to a third is refused (create and
-- join roll back whole), until they leave one. Leaving frees the place. The app shows the same rule before asking.
create or replace function public.limit_togethers_per_person()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.left_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.left_at is null then
    return new;
  end if;
  -- one person's memberships are checked one at a time, so two joins at once can't both squeeze in
  perform pg_advisory_xact_lock(hashtextextended('together_members_limit:' || new.profile_id::text, 0));
  if (
    select count(*) from public.together_members
    where profile_id = new.profile_id and left_at is null and together_id <> new.together_id
  ) >= 2 then
    raise exception 'You can be in 2 Togethers at most. Leave one to start or join another.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_togethers_per_person() from public, anon, authenticated;

create trigger together_members_limit
  before insert or update of left_at on public.together_members
  for each row execute function public.limit_togethers_per_person();
