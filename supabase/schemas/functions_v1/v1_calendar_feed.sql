-- For the calendar feed route: the Together a feed token opens, with its plans from 90 days ago on, each with its place
-- and who's going. Null when the token matches nothing or its owner has left.
-- Callable with the publishable key (calendar apps don't sign in): the 64-hex token is the lock, and without a valid one
-- this returns nothing. Guessing one isn't feasible (256 random bits), so no secret key is needed.

create function public.v1_calendar_feed(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', t.name,
    'time_zone', t.time_zone,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'title', e.title,
        'day', e.day,
        'time', to_char(e.start_time, 'HH24:MI'),
        'location', e.location,
        'place', p.name,
        'attendees', coalesce((
          select jsonb_agg(pr.name order by m.joined_at)
          from public.event_attendees a
          join public.profiles pr on pr.id = a.profile_id
          join public.together_members m on m.together_id = a.together_id and m.profile_id = a.profile_id
          where a.event_id = e.id
        ), '[]'::jsonb),
        'created_at', e.created_at
      ) order by e.day, e.start_time nulls first)
      from public.events e
      left join public.places p on p.id = e.place_id
      where e.together_id = t.id
        and e.day >= (now() at time zone t.time_zone)::date - 90
    ), '[]'::jsonb)
  )
  from public.calendar_feeds f
  join public.together_members m on m.together_id = f.together_id and m.profile_id = f.profile_id and m.left_at is null
  join public.togethers t on t.id = f.together_id
  where f.token = p_token;
$$;

revoke execute on function public.v1_calendar_feed(text) from public;
grant execute on function public.v1_calendar_feed(text) to anon, authenticated, service_role;
