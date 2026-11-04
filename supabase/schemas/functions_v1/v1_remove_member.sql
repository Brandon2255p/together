-- Owners only: take someone out of the current Together. What they added stays (see together_members.left_at).
-- To go yourself, use v1_leave_together.
create or replace function public.v1_remove_member(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_id uuid := public.require_owner();
begin
  if p_profile_id = auth.uid() then
    raise exception 'To go yourself, leave the Together instead.' using errcode = 'P0001';
  end if;
  update public.together_members set left_at = now(), role = 'member'
  where together_id = t_id and profile_id = p_profile_id and left_at is null;
  if not found then
    raise exception 'They''re not in this Together.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.v1_remove_member(uuid) from public, anon;
grant execute on function public.v1_remove_member(uuid) to authenticated;
