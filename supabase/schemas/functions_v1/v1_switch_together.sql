-- Open another of your Togethers. Everything the app reads follows (through my_together_id()).
create or replace function public.v1_switch_together(p_together_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.together_members
    where together_id = p_together_id and profile_id = auth.uid() and left_at is null
  ) then
    raise exception 'You''re not in that Together.' using errcode = '42501';
  end if;
  perform public.set_current_together(p_together_id);
end;
$$;

revoke execute on function public.v1_switch_together(uuid) from public, anon;
grant execute on function public.v1_switch_together(uuid) to authenticated;
