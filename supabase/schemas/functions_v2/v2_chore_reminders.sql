-- For the daily reminder job (server only, with the secret key): every push subscription whose owner has chores due
-- today or overdue, in each Together's time zone, with those chores' titles. Covers every Together the person is in,
-- but not ones they've left (their assignments stay there; see together_members.left_at). v1 reminded people who left.

create or replace function public.v2_chore_reminders()
returns table (endpoint text, p256dh text, auth text, titles text[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.endpoint, s.p256dh, s.auth, array_agg(distinct c.title order by c.title)
  from public.push_subscriptions s
  join public.chore_assignees a on a.profile_id = s.profile_id
  join public.together_members m on m.together_id = a.together_id and m.profile_id = a.profile_id and m.left_at is null
  join public.chores c on c.id = a.chore_id
  join public.togethers t on t.id = c.together_id
  where c.done_at is null
    and c.due is not null
    and c.due <= (now() at time zone t.time_zone)::date
  group by s.endpoint, s.p256dh, s.auth;
$$;

revoke execute on function public.v2_chore_reminders() from public, anon, authenticated;
grant execute on function public.v2_chore_reminders() to service_role;
