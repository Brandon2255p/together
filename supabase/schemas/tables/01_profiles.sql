-- One row per signed-in user, created by triggers/handle_new_user.sql.
-- Its read policy lives in 03_together_members.sql, because it needs that table.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  -- the Together the app shows; switched with v1_switch_together. my_together_id() ignores it once you've left.
  -- The foreign key is added in 02_togethers.sql, which comes after this file.
  current_together_id uuid
);

alter table public.profiles enable row level security;

create policy "update self" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
