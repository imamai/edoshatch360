-- EDOS Hatch360 — server-side business logic.

-- Provision a whole tenant in one transaction: organisation, owner
-- membership, first farm, a starter product catalogue and a trial
-- subscription. Direct INSERT on edoshatch360_tenants is denied by RLS
-- precisely so a tenant can never exist without an owner attached to it.
create or replace function edoshatch360_create_tenant(
  p_name      text,
  p_farm_name text default null,
  p_county    text default null,
  p_mode      edoshatch360_farm_mode default 'simple'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_farm   uuid;
  v_slug   text;
  v_plan   uuid;
  v_n      integer := 0;
begin
  if auth.uid() is null then
    raise exception 'edoshatch360: sign in required';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'edoshatch360: organisation name is required';
  end if;

  perform edoshatch360_ensure_profile();

  -- Slugify, then de-duplicate with a numeric suffix.
  v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'farm'; end if;
  while exists (select 1 from edoshatch360_tenants t where t.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g') || '-' || v_n;
    v_slug := trim(both '-' from v_slug);
  end loop;

  insert into edoshatch360_tenants (name, slug, mode, county_seed)
  values (trim(p_name), v_slug, p_mode, null)
  returning id into v_tenant;

  insert into edoshatch360_memberships (tenant_id, user_id, role, status)
  values (v_tenant, auth.uid(), 'owner', 'active');

  insert into edoshatch360_farms (tenant_id, name, county)
  values (v_tenant, coalesce(nullif(trim(p_farm_name), ''), trim(p_name) || ' Farm'), p_county)
  returning id into v_farm;

  -- A catalogue the farmer can sell from on day one (spec §27).
  insert into edoshatch360_products (tenant_id, name, category, unit, default_price_cents)
  values
    (v_tenant, 'Eggs (tray of 30)', 'eggs',            'tray', 45000),
    (v_tenant, 'Live broiler',      'live_birds',      'bird', 55000),
    (v_tenant, 'Dressed chicken',   'processed_birds', 'kg',   65000),
    (v_tenant, 'Spent layer',       'spent_layers',    'bird', 40000),
    (v_tenant, 'Day-old chick',     'chicks',          'chick', 12000),
    (v_tenant, 'Manure',            'manure',          'bag',  30000);

  select id into v_plan from edoshatch360_plans
  where is_active order by sort_order limit 1;

  if v_plan is not null then
    insert into edoshatch360_subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end)
    values (v_tenant, v_plan, 'trialing', now() + interval '30 days', now() + interval '30 days');
  end if;

  update edoshatch360_users set last_tenant_id = v_tenant where id = auth.uid();

  return v_tenant;
end;
$$;

-- Next document number for a tenant, e.g. INV-2026-0007.
-- Serialised per tenant+type with a transaction-scoped advisory lock so two
-- concurrent checkouts can never mint the same number and trip the
-- unique(tenant_id, doc_number) constraint.
create or replace function edoshatch360_next_doc_number(
  p_tenant uuid,
  p_type   edoshatch360_doc_type
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text := case p_type
    when 'quotation' then 'QT'
    when 'order'     then 'SO'
    when 'invoice'   then 'INV'
    else 'RCP' end;
  v_year text := to_char(current_date, 'YYYY');
  v_seq  integer;
begin
  if p_tenant not in (select edoshatch360_writable_tenant_ids()) then
    raise exception 'edoshatch360: not permitted for this organisation';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_tenant::text || v_prefix));

  select coalesce(max(substring(doc_number from '[0-9]+$')::integer), 0) + 1
  into v_seq
  from edoshatch360_sales
  where tenant_id = p_tenant
    and doc_number like v_prefix || '-' || v_year || '-%';

  return v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

grant execute on function edoshatch360_create_tenant(text, text, text, edoshatch360_farm_mode) to authenticated;
grant execute on function edoshatch360_next_doc_number(uuid, edoshatch360_doc_type) to authenticated;
