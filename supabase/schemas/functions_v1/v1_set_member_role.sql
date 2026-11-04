-- Owners only: make someone an owner, or a member again. A Together always keeps at least one owner.
create or replace function public.v1_set_member_role(p_profile_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_id uuid := public.require_owner();
begin
  -- lock the Together's members so two owners can't both step down at once
  perform 1 from public.together_members where together_id = t_id for update;

  update public.together_members set role = p_role
  where together_id = t_id and profile_id = p_profile_id and left_at is null;
  if not found then
    raise exception 'They''re not in this Together.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.together_members where together_id = t_id and left_at is null and role = 'owner'
  ) then
    raise exception 'A Together needs an owner. Make someone else the owner first.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.v1_set_member_role(uuid, public.member_role) from public, anon;
grant execute on function public.v1_set_member_role(uuid, public.member_role) to authenticated;
