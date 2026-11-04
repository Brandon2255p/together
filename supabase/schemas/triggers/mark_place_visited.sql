-- Logging a visit means you've been.
create or replace function public.mark_place_visited()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.places set status = 'been' where id = new.place_id and status <> 'been';
  return new;
end;
$$;

revoke execute on function public.mark_place_visited() from public, anon, authenticated;

create trigger visits_mark_place_visited
  after insert on public.visits
  for each row execute function public.mark_place_visited();
