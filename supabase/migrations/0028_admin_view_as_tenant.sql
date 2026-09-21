-- "View as" — a platform admin looking at one organisation's real screens,
-- as a support tool, without a password and without a new bypass.
--
-- No RLS policy is touched by this migration. Every table's tenant-scoping
-- already runs through edoshatch360_tenant_ids(), which reads
-- edoshatch360_memberships for the caller's own active rows — so an admin
-- looking at a farm they are not a member of already sees nothing there,
-- exactly as anyone else would. The two functions below grant that access
-- the same way any teammate gets it: a real membership row, just a
-- temporary, read-only ("viewer") one, self-granted and clearly marked as
-- such (invited_by = the admin's own id, never the tenant's own doing).
--
-- edoshatch360_admin_stop_viewing only ever deletes a row matching that
-- exact signature, so it can never remove a membership a farm actually
-- created for someone.

create or replace function public.edoshatch360_admin_view_as(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not edoshatch360_is_platform_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  if not exists (select 1 from edoshatch360_tenants where id = p_tenant) then
    raise exception 'That organisation no longer exists.' using errcode = 'HB001';
  end if;

  -- Never overwrites a membership the admin already holds in their own
  -- right — if they are already on this tenant, there is nothing to grant.
  insert into edoshatch360_memberships (tenant_id, user_id, role, status, invited_by)
  values (p_tenant, auth.uid(), 'viewer', 'active', auth.uid())
  on conflict (tenant_id, user_id) do nothing;
end;
$function$;

create or replace function public.edoshatch360_admin_stop_viewing(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not edoshatch360_is_platform_admin() then
    raise exception 'Not authorized.' using errcode = '42501';
  end if;

  delete from edoshatch360_memberships
  where tenant_id = p_tenant
    and user_id = auth.uid()
    and role = 'viewer'
    and invited_by = auth.uid();
end;
$function$;

revoke all on function public.edoshatch360_admin_view_as(uuid) from public, anon;
grant execute on function public.edoshatch360_admin_view_as(uuid) to authenticated;

revoke all on function public.edoshatch360_admin_stop_viewing(uuid) from public, anon;
grant execute on function public.edoshatch360_admin_stop_viewing(uuid) to authenticated;
