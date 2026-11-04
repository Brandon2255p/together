-- Who ticked what, and when. Written by functions_v1/v1_set_chore_done.sql.

create table public.chore_completions (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null,
  together_id uuid not null,
  completed_by uuid default auth.uid() references public.profiles (id) on delete set null,
  -- the due date this completion was for
  due date,
  completed_at timestamptz not null default now(),
  foreign key (chore_id, together_id) references public.chores (id, together_id) on delete cascade
);

create index chore_completions_chore_idx on public.chore_completions (chore_id, completed_at desc);

alter table public.chore_completions enable row level security;

create policy "members read" on public.chore_completions for select to authenticated
  using (together_id = (select public.my_together_id()));
create policy "log as self" on public.chore_completions for insert to authenticated
  with check (together_id = (select public.my_together_id()) and completed_by = (select auth.uid()));
