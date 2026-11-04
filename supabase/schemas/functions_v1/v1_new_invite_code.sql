-- Owners only: a fresh invite code for the current Together, good for 48 hours. The old code stops working.
create or replace function public.v1_new_invite_code()
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_id uuid := public.require_owner();
begin
  loop
    begin
      return query
        update public.togethers t
        set invite_code = public.new_invite_code(), invite_expires_at = now() + interval '48 hours'
        where t.id = t_id
        returning t.invite_code, t.invite_expires_at;
      return;
    exception when unique_violation then
      -- invite code collision; try another
    end;
  end loop;
end;
$$;

revoke execute on function public.v1_new_invite_code() from public, anon;
grant execute on function public.v1_new_invite_code() to authenticated;
