-- EDOS Hatch360 — RLS helper functions.
--
-- All of these are SECURITY DEFINER set-returning functions rather than
-- inline subqueries in the policies themselves, for two reasons:
--   1. Recursion: a policy on edoshatch360_memberships that itself reads
--      edoshatch360_memberships would recurse infinitely. A definer function
--      bypasses RLS and breaks the cycle.
--   2. Performance: policies written as `tenant_id in (select ...ids())`
--      evaluate the set ONCE per statement instead of once per row, which is
--      the difference between an index scan and a seq scan on large tables.

-- Is the caller an EDOS platform administrator (spec §46)?
create or replace function edoshatch360_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_platform_admin from edoshatch360_users u where u.id = auth.uid()),
    false
  );
$$;

-- Every tenant the caller belongs to with an active membership.
create or replace function edoshatch360_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from edoshatch360_tenants t
  where edoshatch360_is_platform_admin()
  union
  select m.tenant_id from edoshatch360_memberships m
  where m.user_id = auth.uid() and m.status = 'active';
$$;

-- Tenants where the caller may create/modify records (anything but 'viewer').
create or replace function edoshatch360_writable_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from edoshatch360_tenants t
  where edoshatch360_is_platform_admin()
  union
  select m.tenant_id from edoshatch360_memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.role <> 'viewer';
$$;

-- Tenants where the caller may change settings, staff and billing.
create or replace function edoshatch360_admin_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id from edoshatch360_tenants t
  where edoshatch360_is_platform_admin()
  union
  select m.tenant_id from edoshatch360_memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
    and m.role = 'owner';
$$;

-- Farms the caller can see.
--
-- Rule: tenant-wide roles (owner/accountant/sales/vet) see every farm in the
-- tenant. Operational roles (manager/supervisor/worker) are restricted to the
-- farms explicitly assigned to them IF they have any assignment rows at all;
-- with no assignments they fall back to the whole tenant, so a one-farm
-- smallholder never has to create assignment rows just to use the app
-- (spec §31 — don't force enterprise workflows on small farmers).
create or replace function edoshatch360_farm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id
  from edoshatch360_farms f
  join edoshatch360_memberships m
    on m.tenant_id = f.tenant_id
   and m.user_id = auth.uid()
   and m.status = 'active'
  where m.role in ('owner', 'accountant', 'sales', 'vet', 'viewer')
     or not exists (
       select 1 from edoshatch360_farm_assignments a
       where a.user_id = auth.uid() and a.tenant_id = f.tenant_id
     )
     or exists (
       select 1 from edoshatch360_farm_assignments a
       where a.user_id = auth.uid() and a.farm_id = f.id
     )
  union
  select f.id from edoshatch360_farms f where edoshatch360_is_platform_admin();
$$;

-- Flocks living in farms the caller can see.
create or replace function edoshatch360_flock_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select fl.id
  from edoshatch360_flocks fl
  where fl.farm_id in (select edoshatch360_farm_ids());
$$;

grant execute on function edoshatch360_is_platform_admin()      to authenticated;
grant execute on function edoshatch360_tenant_ids()             to authenticated;
grant execute on function edoshatch360_writable_tenant_ids()    to authenticated;
grant execute on function edoshatch360_admin_tenant_ids()       to authenticated;
grant execute on function edoshatch360_farm_ids()               to authenticated;
grant execute on function edoshatch360_flock_ids()              to authenticated;
grant execute on function edoshatch360_ensure_profile()         to authenticated;
