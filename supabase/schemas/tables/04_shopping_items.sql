-- The shopping list. done_at set = ticked into the basket.

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  together_id uuid not null default public.my_together_id() references public.togethers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  quantity integer not null default 1 check (quantity between 1 and 99),
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index shopping_items_together_idx on public.shopping_items (together_id, done_at);

alter table public.shopping_items enable row level security;

create policy "members" on public.shopping_items for all to authenticated
  using (together_id = (select public.my_together_id()))
  with check (together_id = (select public.my_together_id()));

-- New items are added as yourself.
create policy "add as self" on public.shopping_items as restrictive for insert to authenticated
  with check (added_by = (select auth.uid()));
