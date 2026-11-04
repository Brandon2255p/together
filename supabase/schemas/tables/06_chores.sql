-- Chores: once-off or recurring, with an optional due date.

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  -- optional. A recurring chore without a date counts from the day it's first done.
  due date,
  repeat public.chore_repeat not null default 'once',
  -- only used by once-off chores; recurring ones roll their due date forward instead (v1_set_chore_done)
  done_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- target for composite foreign keys, so children can't point across Togethers
  unique (id, together_id)
);

create index chores_together_due_idx on public.chores (together_id, due);

alter table public.chores enable row level security;

create policy "members" on public.chores for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
