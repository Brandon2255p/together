-- Calendar feeds: a secret link per person per Together that Google Calendar, Apple Calendar or anything else that
-- reads .ics can subscribe to. The token is the lock, so nobody reads this table directly: the app gets its own link
-- through functions_v1/v1_calendar_feed_token.sql, and the feed route reads events through
-- functions_v1/v1_calendar_feed.sql, which needs the token. Leaving the Together stops the link working.

create table public.calendar_feeds (
  -- 64 hex characters from two random UUIDs
  token text primary key check (token ~ '^[0-9a-f]{64}$'),
  together_id uuid not null,
  profile_id uuid not null,
  created_at timestamptz not null default now(),
  unique (together_id, profile_id),
  foreign key (together_id, profile_id) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.calendar_feeds enable row level security;
