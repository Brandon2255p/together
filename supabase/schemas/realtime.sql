-- Realtime: each person sees the other's changes live. Realtime applies row-level security too.
-- wish_claims is left out on purpose.

alter publication supabase_realtime add table
  public.shopping_items,
  public.chores,
  public.chore_assignees,
  public.events,
  public.places,
  public.wishes;
