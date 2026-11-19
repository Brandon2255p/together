-- Your calendar feed link's token for your current Together, made the first time you ask. p_reset swaps it for a
-- new one, so anything subscribed with the old link stops getting updates.

create function public.v1_calendar_feed_token(p_reset boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_together uuid := public.my_together_id();
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if v_together is null or not exists (
    select 1 from public.together_members
    where together_id = v_together and profile_id = auth.uid() and left_at is null
  ) then
    raise exception 'You''re not in a Together yet.' using errcode = '42501';
  end if;

  if p_reset then
    delete from public.calendar_feeds where together_id = v_together and profile_id = auth.uid();
  end if;

  insert into public.calendar_feeds (token, together_id, profile_id)
  values (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), v_together, auth.uid())
  on conflict (together_id, profile_id) do nothing;

  select token into v_token from public.calendar_feeds where together_id = v_together and profile_id = auth.uid();
  return v_token;
end;
$$;

revoke execute on function public.v1_calendar_feed_token(boolean) from public, anon;
grant execute on function public.v1_calendar_feed_token(boolean) to authenticated;
