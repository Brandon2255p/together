-- Web push: one row per browser or installed app that asked for reminders. Only you see and remove your own.
-- Saved through functions_v1/v1_save_push_subscription.sql, so a device that changes hands moves to its new owner.

create table public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy "own read" on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "own remove" on public.push_subscriptions for delete to authenticated
  using (profile_id = (select auth.uid()));
