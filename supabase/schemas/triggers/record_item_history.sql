-- Every item added to the list counts towards the autocomplete history.
create or replace function public.record_item_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.item_history (together_id, name_key, name)
  values (new.together_id, lower(btrim(new.name)), btrim(new.name))
  on conflict (together_id, name_key) do update
    set times_added = public.item_history.times_added + 1,
        name = excluded.name,
        last_added_at = now();
  return new;
end;
$$;

revoke execute on function public.record_item_history() from public, anon, authenticated;

create trigger shopping_items_history
  after insert on public.shopping_items
  for each row execute function public.record_item_history();
