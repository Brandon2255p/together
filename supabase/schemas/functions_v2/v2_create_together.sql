-- Start a Together, even when you're already in others. You're its owner, and it becomes your current one.
create or replace function public.v2_create_together(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  t_id uuid;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  loop
    begin
      insert into public.togethers (name, invite_code) values (btrim(p_name), public.new_invite_code())
      returning id into t_id;
      exit;
    exception when unique_violation then
      -- invite code collision; try another
    end;
  end loop;

  insert into public.together_members (together_id, profile_id, tone, role) values (t_id, me, 'accent', 'owner');
  perform public.set_current_together(t_id);
  return t_id;
end;
$$;

revoke execute on function public.v2_create_together(text) from public, anon;
grant execute on function public.v2_create_together(text) to authenticated;
