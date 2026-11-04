-- Who's going to an event.

create table public.event_attendees (
  event_id uuid not null,
  together_id uuid not null default public.my_together_id(),
  profile_id uuid not null,
  primary key (event_id, profile_id),
  foreign key (event_id, together_id) references public.events (id, together_id) on delete cascade,
  foreign key (together_id, profile_id) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.event_attendees enable row level security;

create policy "members" on public.event_attendees for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
