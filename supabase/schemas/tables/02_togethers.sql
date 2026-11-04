-- A Together: people sharing lists, a calendar, places and wishes. A person can be in many.
-- Created and joined through functions_v1 (there's no insert policy). Policies are in 03_together_members.sql,
-- because they need my_together_id().

create table public.togethers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- 6 characters, no look-alikes (0/O, 1/I)
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  -- codes work for 48 hours; the owner makes a new one with v1_new_invite_code
  invite_expires_at timestamptz not null default now() + interval '48 hours',
  -- "today", due dates and recurring chores are worked out in this zone
  time_zone text not null default 'Africa/Johannesburg',
  created_at timestamptz not null default now()
);

alter table public.togethers enable row level security;

alter table public.profiles
  add constraint profiles_current_together_id_fkey
  foreign key (current_together_id) references public.togethers (id) on delete set null;
