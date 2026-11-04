-- Savings goals, personal or shared (see goal_owners).

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  saved_cents bigint not null default 0 check (saved_cents >= 0),
  target_cents bigint not null check (target_cents > 0),
  created_at timestamptz not null default now(),
  unique (id, together_id)
);

alter table public.goals enable row level security;

create policy "members" on public.goals for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));
