-- Saves this device's push subscription for the signed-in person. If someone else had it (a shared phone, a new
-- sign-in), it moves to you: reminders go to whoever is signed in on the device now.

create function public.v1_save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (endpoint, profile_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

revoke execute on function public.v1_save_push_subscription(text, text, text) from public, anon;
grant execute on function public.v1_save_push_subscription(text, text, text) to authenticated;
