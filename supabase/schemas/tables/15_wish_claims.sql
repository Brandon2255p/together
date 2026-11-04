-- Who's buying a wish as a gift. A table of its own so row-level security can hide it from the wish's owner: gifts
-- stay a surprise in the database, not just the UI. The primary key means one person per wish.

create table public.wish_claims (
  wish_id uuid primary key,
  together_id uuid not null default public.my_together_id(),
  claimed_by uuid not null default auth.uid(),
  claimed_at timestamptz not null default now(),
  foreign key (wish_id, together_id) references public.wishes (id, together_id) on delete cascade,
  foreign key (together_id, claimed_by) references public.together_members (together_id, profile_id) on delete cascade
);

alter table public.wish_claims enable row level security;

create policy "everyone but the owner reads" on public.wish_claims for select to authenticated
  using (
    together_id = (select public.my_together_id())
    and not exists (select 1 from public.wishes w where w.id = wish_id and w.owner_id = (select auth.uid()))
  );
-- as yourself, and never your own wish
create policy "claim as self" on public.wish_claims for insert to authenticated
  with check (
    together_id = (select public.my_together_id())
    and claimed_by = (select auth.uid())
    and not exists (select 1 from public.wishes w where w.id = wish_id and w.owner_id = (select auth.uid()))
  );
create policy "unclaim own" on public.wish_claims for delete to authenticated
  using (together_id = (select public.my_together_id()) and claimed_by = (select auth.uid()));
