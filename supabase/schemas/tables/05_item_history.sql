-- Everything a Together has added to the list, for the autocomplete. Kept by triggers/record_item_history.sql, so it
-- survives the basket being cleared. Read through functions_v1/v1_item_catalog.sql.

create table public.item_history (
  together_id uuid not null references public.togethers (id) on delete cascade,
  -- lower-cased and trimmed, so "Milk" and "milk " count as one item
  name_key text not null,
  -- the spelling used most recently
  name text not null,
  times_added integer not null default 1,
  last_added_at timestamptz not null default now(),
  primary key (together_id, name_key)
);

create index item_history_name_key_idx on public.item_history (name_key);

alter table public.item_history enable row level security;

create policy "members read" on public.item_history for select to authenticated
  using (together_id = (select public.my_together_id()));
