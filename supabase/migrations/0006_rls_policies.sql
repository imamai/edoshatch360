-- EDOS Hatch360 — Row Level Security.
--
-- Every Hatch360 table is RLS-protected. Nothing here grants access to the
-- unprefixed POS tables that share this database, and nothing in the POS
-- application can reach these rows.

alter table edoshatch360_tenants                 enable row level security;
alter table edoshatch360_users                   enable row level security;
alter table edoshatch360_memberships             enable row level security;
alter table edoshatch360_farms                   enable row level security;
alter table edoshatch360_houses                  enable row level security;
alter table edoshatch360_flocks                  enable row level security;
alter table edoshatch360_farm_assignments        enable row level security;
alter table edoshatch360_daily_records           enable row level security;
alter table edoshatch360_vaccinations            enable row level security;
alter table edoshatch360_medications             enable row level security;
alter table edoshatch360_health_records          enable row level security;
alter table edoshatch360_inventory               enable row level security;
alter table edoshatch360_inventory_transactions  enable row level security;
alter table edoshatch360_customers               enable row level security;
alter table edoshatch360_products                enable row level security;
alter table edoshatch360_sales                   enable row level security;
alter table edoshatch360_sale_items              enable row level security;
alter table edoshatch360_customer_payments       enable row level security;
alter table edoshatch360_expenses                enable row level security;
alter table edoshatch360_tasks                   enable row level security;
alter table edoshatch360_notifications           enable row level security;
alter table edoshatch360_plans                   enable row level security;
alter table edoshatch360_subscriptions           enable row level security;
alter table edoshatch360_payments                enable row level security;
alter table edoshatch360_settings                enable row level security;
alter table edoshatch360_audit_logs              enable row level security;
alter table edoshatch360_cms_pages               enable row level security;
alter table edoshatch360_cms_sections            enable row level security;
alter table edoshatch360_cms_media               enable row level security;
alter table edoshatch360_cms_testimonials        enable row level security;
alter table edoshatch360_cms_faqs                enable row level security;

-- ------------------------------------------------------- tenants / users --

create policy "tenant read" on edoshatch360_tenants for select to authenticated
  using (id in (select edoshatch360_tenant_ids()));
create policy "tenant update" on edoshatch360_tenants for update to authenticated
  using (id in (select edoshatch360_admin_tenant_ids()))
  with check (id in (select edoshatch360_admin_tenant_ids()));
-- No direct INSERT: tenants are created through edoshatch360_create_tenant(),
-- which also provisions the owner membership in the same transaction.

create policy "profile read" on edoshatch360_users for select to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.user_id from edoshatch360_memberships m
      where m.tenant_id in (select edoshatch360_tenant_ids())
    )
  );
create policy "profile update own" on edoshatch360_users for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Privilege escalation guard: is_platform_admin can only ever be changed by
-- an existing platform admin, never by the row's own owner.
create or replace function edoshatch360_guard_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin
     and not edoshatch360_is_platform_admin() then
    new.is_platform_admin := old.is_platform_admin;
  end if;
  return new;
end;
$$;

create trigger edoshatch360_users_guard_admin
  before update on edoshatch360_users
  for each row execute function edoshatch360_guard_platform_admin();

create policy "membership read" on edoshatch360_memberships for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "membership write" on edoshatch360_memberships for all to authenticated
  using (tenant_id in (select edoshatch360_admin_tenant_ids()))
  with check (tenant_id in (select edoshatch360_admin_tenant_ids()));

-- ------------------------------------------------------- farm structure --

create policy "farm read" on edoshatch360_farms for select to authenticated
  using (id in (select edoshatch360_farm_ids()));
create policy "farm insert" on edoshatch360_farms for insert to authenticated
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));
create policy "farm update" on edoshatch360_farms for update to authenticated
  using (id in (select edoshatch360_farm_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));
create policy "farm delete" on edoshatch360_farms for delete to authenticated
  using (tenant_id in (select edoshatch360_admin_tenant_ids()));

create policy "house read" on edoshatch360_houses for select to authenticated
  using (farm_id in (select edoshatch360_farm_ids()));
create policy "house write" on edoshatch360_houses for all to authenticated
  using (farm_id in (select edoshatch360_farm_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (farm_id in (select edoshatch360_farm_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "flock read" on edoshatch360_flocks for select to authenticated
  using (farm_id in (select edoshatch360_farm_ids()));
create policy "flock write" on edoshatch360_flocks for all to authenticated
  using (farm_id in (select edoshatch360_farm_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (farm_id in (select edoshatch360_farm_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "assignment read" on edoshatch360_farm_assignments for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "assignment write" on edoshatch360_farm_assignments for all to authenticated
  using (tenant_id in (select edoshatch360_admin_tenant_ids()))
  with check (tenant_id in (select edoshatch360_admin_tenant_ids()));

-- ------------------------------------------------------- flock-scoped ops --

create policy "daily read" on edoshatch360_daily_records for select to authenticated
  using (flock_id in (select edoshatch360_flock_ids()));
create policy "daily write" on edoshatch360_daily_records for all to authenticated
  using (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "vacc read" on edoshatch360_vaccinations for select to authenticated
  using (flock_id in (select edoshatch360_flock_ids()));
create policy "vacc write" on edoshatch360_vaccinations for all to authenticated
  using (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "meds read" on edoshatch360_medications for select to authenticated
  using (flock_id in (select edoshatch360_flock_ids()));
create policy "meds write" on edoshatch360_medications for all to authenticated
  using (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "health read" on edoshatch360_health_records for select to authenticated
  using (flock_id in (select edoshatch360_flock_ids()));
create policy "health write" on edoshatch360_health_records for all to authenticated
  using (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (flock_id in (select edoshatch360_flock_ids()) and tenant_id in (select edoshatch360_writable_tenant_ids()));

-- ----------------------------------------------------------- inventory --

create policy "inv read" on edoshatch360_inventory for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids())
         and (farm_id is null or farm_id in (select edoshatch360_farm_ids())));
create policy "inv write" on edoshatch360_inventory for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "invtxn read" on edoshatch360_inventory_transactions for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "invtxn write" on edoshatch360_inventory_transactions for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

-- ------------------------------------------------------------ commerce --

create policy "customer read" on edoshatch360_customers for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "customer write" on edoshatch360_customers for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "product read" on edoshatch360_products for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "product write" on edoshatch360_products for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "sale read" on edoshatch360_sales for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "sale write" on edoshatch360_sales for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "saleitem read" on edoshatch360_sale_items for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "saleitem write" on edoshatch360_sale_items for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "custpay read" on edoshatch360_customer_payments for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "custpay write" on edoshatch360_customer_payments for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "expense read" on edoshatch360_expenses for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "expense write" on edoshatch360_expenses for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

-- ------------------------------------------------- tasks / notifications --

create policy "task read" on edoshatch360_tasks for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids())
         and (farm_id is null or farm_id in (select edoshatch360_farm_ids())));
create policy "task write" on edoshatch360_tasks for all to authenticated
  using (tenant_id in (select edoshatch360_writable_tenant_ids()))
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

create policy "notice read" on edoshatch360_notifications for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids())
         and (user_id is null or user_id = (select auth.uid())));
create policy "notice update" on edoshatch360_notifications for update to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids())
         and (user_id is null or user_id = (select auth.uid())))
  with check (tenant_id in (select edoshatch360_tenant_ids()));
create policy "notice insert" on edoshatch360_notifications for insert to authenticated
  with check (tenant_id in (select edoshatch360_writable_tenant_ids()));

-- ------------------------------------------------- billing (read-mostly) --

-- Plans are public: the marketing pricing page renders them for signed-out
-- visitors (spec §47 — pricing is CMS-driven, never hardcoded).
create policy "plans public read" on edoshatch360_plans for select to anon, authenticated
  using (is_active);
create policy "plans admin write" on edoshatch360_plans for all to authenticated
  using (edoshatch360_is_platform_admin())
  with check (edoshatch360_is_platform_admin());

create policy "sub read" on edoshatch360_subscriptions for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "sub admin write" on edoshatch360_subscriptions for all to authenticated
  using (edoshatch360_is_platform_admin())
  with check (edoshatch360_is_platform_admin());

-- Payments are written server-side only (service role, from the M-Pesa
-- callback). Clients may read their own tenant's history, never write it.
create policy "payment read" on edoshatch360_payments for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));

create policy "setting read" on edoshatch360_settings for select to authenticated
  using (tenant_id in (select edoshatch360_tenant_ids()));
create policy "setting write" on edoshatch360_settings for all to authenticated
  using (tenant_id in (select edoshatch360_admin_tenant_ids()))
  with check (tenant_id in (select edoshatch360_admin_tenant_ids()));

-- Audit logs are append-only: insert + read, never update or delete.
create policy "audit read" on edoshatch360_audit_logs for select to authenticated
  using (tenant_id in (select edoshatch360_admin_tenant_ids()));
create policy "audit insert" on edoshatch360_audit_logs for insert to authenticated
  with check (tenant_id in (select edoshatch360_tenant_ids()));

-- ----------------------------------------------------------------- CMS --

create policy "cms page read" on edoshatch360_cms_pages for select to anon, authenticated
  using (is_published or edoshatch360_is_platform_admin());
create policy "cms page write" on edoshatch360_cms_pages for all to authenticated
  using (edoshatch360_is_platform_admin()) with check (edoshatch360_is_platform_admin());

create policy "cms section read" on edoshatch360_cms_sections for select to anon, authenticated
  using (is_visible or edoshatch360_is_platform_admin());
create policy "cms section write" on edoshatch360_cms_sections for all to authenticated
  using (edoshatch360_is_platform_admin()) with check (edoshatch360_is_platform_admin());

create policy "cms media read" on edoshatch360_cms_media for select to anon, authenticated using (true);
create policy "cms media write" on edoshatch360_cms_media for all to authenticated
  using (edoshatch360_is_platform_admin()) with check (edoshatch360_is_platform_admin());

create policy "cms testimonial read" on edoshatch360_cms_testimonials for select to anon, authenticated
  using (is_published or edoshatch360_is_platform_admin());
create policy "cms testimonial write" on edoshatch360_cms_testimonials for all to authenticated
  using (edoshatch360_is_platform_admin()) with check (edoshatch360_is_platform_admin());

create policy "cms faq read" on edoshatch360_cms_faqs for select to anon, authenticated
  using (is_published or edoshatch360_is_platform_admin());
create policy "cms faq write" on edoshatch360_cms_faqs for all to authenticated
  using (edoshatch360_is_platform_admin()) with check (edoshatch360_is_platform_admin());
