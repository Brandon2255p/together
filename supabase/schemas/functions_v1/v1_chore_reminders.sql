-- For the daily reminder job (server only, with the secret key): every push subscription whose owner has chores due
-- today or overdue, in their Together's time zone, with those chores' titles.

create function public.v1_chore_reminders()
returns table (endpoint text, p256dh text, auth text, titles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.endpoint, s.p256dh, s.auth, array_agg(distinct c.title order by c.title)
  from public.push_subscriptions s
  join public.chore_assignees a on a.profile_id = s.profile_id
  join public.chores c on c.id = a.chore_id
  join public.togethers t on t.id = c.together_id
  where c.done_at is null
    and c.due is not null
    and c.due <= (now() at time zone t.time_zone)::date
  group by s.endpoint, s.p256dh, s.auth;
$$;

revoke execute on function public.v1_chore_reminders() from public, anon, authenticated;
grant execute on function public.v1_chore_reminders() to service_role;
