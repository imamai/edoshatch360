-- Financial data is now restricted at the database, not just in the UI.
--
-- Previously every active member of a tenant could read sales, payments,
-- expenses and customers; the app merely declined to render those screens for
-- operational roles. That made the role restriction cosmetic — a worker with
-- the anon key and a session could still read revenue. These policies move
-- the boundary into RLS so it holds regardless of the client.
--
-- Roles that may see money: owner, accountant, sales, manager, viewer.
-- Roles that may not: worker, supervisor, vet.

create or replace function edoshatch360_money_tenant_ids()
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
    and m.role in ('owner', 'accountant', 'sales', 'manager', 'viewer');
$$;

grant execute on function edoshatch360_money_tenant_ids() to authenticated;

-- Writing money still requires a non-viewer role as well.
create or replace function edoshatch360_money_write_tenant_ids()
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
    and m.role in ('owner', 'accountant', 'sales', 'manager');
$$;

grant execute on function edoshatch360_money_write_tenant_ids() to authenticated;

drop policy if exists "sale read"     on edoshatch360_sales;
drop policy if exists "sale write"    on edoshatch360_sales;
drop policy if exists "saleitem read" on edoshatch360_sale_items;
drop policy if exists "saleitem write" on edoshatch360_sale_items;
drop policy if exists "custpay read"  on edoshatch360_customer_payments;
drop policy if exists "custpay write" on edoshatch360_customer_payments;
drop policy if exists "expense read"  on edoshatch360_expenses;
drop policy if exists "expense write" on edoshatch360_expenses;
drop policy if exists "customer read" on edoshatch360_customers;
drop policy if exists "customer write" on edoshatch360_customers;

create policy "sale read" on edoshatch360_sales for select to authenticated
  using (tenant_id in (select edoshatch360_money_tenant_ids()));
create policy "sale write" on edoshatch360_sales for all to authenticated
  using (tenant_id in (select edoshatch360_money_write_tenant_ids()))
  with check (tenant_id in (select edoshatch360_money_write_tenant_ids()));

create policy "saleitem read" on edoshatch360_sale_items for select to authenticated
  using (tenant_id in (select edoshatch360_money_tenant_ids()));
create policy "saleitem write" on edoshatch360_sale_items for all to authenticated
  using (tenant_id in (select edoshatch360_money_write_tenant_ids()))
  with check (tenant_id in (select edoshatch360_money_write_tenant_ids()));

create policy "custpay read" on edoshatch360_customer_payments for select to authenticated
  using (tenant_id in (select edoshatch360_money_tenant_ids()));
create policy "custpay write" on edoshatch360_customer_payments for all to authenticated
  using (tenant_id in (select edoshatch360_money_write_tenant_ids()))
  with check (tenant_id in (select edoshatch360_money_write_tenant_ids()));

create policy "expense read" on edoshatch360_expenses for select to authenticated
  using (tenant_id in (select edoshatch360_money_tenant_ids()));
create policy "expense write" on edoshatch360_expenses for all to authenticated
  using (tenant_id in (select edoshatch360_money_write_tenant_ids()))
  with check (tenant_id in (select edoshatch360_money_write_tenant_ids()));

create policy "customer read" on edoshatch360_customers for select to authenticated
  using (tenant_id in (select edoshatch360_money_tenant_ids()));
create policy "customer write" on edoshatch360_customers for all to authenticated
  using (tenant_id in (select edoshatch360_money_write_tenant_ids()))
  with check (tenant_id in (select edoshatch360_money_write_tenant_ids()));
