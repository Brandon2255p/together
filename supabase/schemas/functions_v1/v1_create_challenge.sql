-- Start a challenge with who's in it and its goals, all at once. p_goals: [{"title": "Gym", "target": 3}, …]
create or replace function public.v1_create_challenge(
  p_title text,
  p_cadence public.challenge_cadence,
  p_starts_on date,
  p_member_ids uuid[],
  p_goals jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if coalesce(array_length(p_member_ids, 1), 0) = 0 then
    raise exception 'Pick who''s in it.';
  end if;
  if jsonb_typeof(p_goals) <> 'array' or jsonb_array_length(p_goals) = 0 then
    raise exception 'Add at least one goal.';
  end if;

  insert into public.challenges (title, cadence, starts_on) values (btrim(p_title), p_cadence, p_starts_on)
  returning id into new_id;
  insert into public.challenge_members (challenge_id, profile_id)
    select new_id, m from unnest(p_member_ids) as m;
  insert into public.challenge_goals (challenge_id, title, target, position)
    select new_id, btrim(g.value ->> 'title'), coalesce((g.value ->> 'target')::integer, 1), (g.ordinality - 1)::integer
    from jsonb_array_elements(p_goals) with ordinality as g;
  return new_id;
end;
$$;

revoke execute on function public.v1_create_challenge(text, public.challenge_cadence, date, uuid[], jsonb) from public, anon;
grant execute on function public.v1_create_challenge(text, public.challenge_cadence, date, uuid[], jsonb) to authenticated;
