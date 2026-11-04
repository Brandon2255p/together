-- Realtime: each person sees the other's changes live. Realtime applies row-level security too.
-- wish_claims is left out on purpose: the wish's owner mustn't learn that something was claimed.

alter publication supabase_realtime add table
  public.shopping_items,
  public.chores,
  public.chore_assignees,
  public.events,
  public.event_attendees,
  public.places,
  public.place_ratings,
  public.visits,
  public.wishes,
  public.goals,
  public.goal_owners,
  public.togethers,
  public.together_members,
  public.profiles;
