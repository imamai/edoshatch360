-- Fix: edoshatch360_create_tenant inserted a non-existent `county_seed`
-- column on edoshatch360_tenants. plpgsql only syntax-checks bodies at CREATE
-- time, so this would have failed at first signup rather than at migration.
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
  v_base   text;
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

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'farm'; end if;
  v_slug := v_base;
  while exists (select 1 from edoshatch360_tenants t where t.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into edoshatch360_tenants (name, slug, mode)
  values (trim(p_name), v_slug, p_mode)
  returning id into v_tenant;

  insert into edoshatch360_memberships (tenant_id, user_id, role, status)
  values (v_tenant, auth.uid(), 'owner', 'active');

  insert into edoshatch360_farms (tenant_id, name, county)
  values (v_tenant, coalesce(nullif(trim(p_farm_name), ''), trim(p_name) || ' Farm'), p_county)
  returning id into v_farm;

  insert into edoshatch360_products (tenant_id, name, category, unit, default_price_cents)
  values
    (v_tenant, 'Eggs (tray of 30)', 'eggs',            'tray',  45000),
    (v_tenant, 'Live broiler',      'live_birds',      'bird',  55000),
    (v_tenant, 'Dressed chicken',   'processed_birds', 'kg',    65000),
    (v_tenant, 'Spent layer',       'spent_layers',    'bird',  40000),
    (v_tenant, 'Day-old chick',     'chicks',          'chick', 12000),
    (v_tenant, 'Manure',            'manure',          'bag',   30000);

  select id into v_plan from edoshatch360_plans where is_active order by sort_order limit 1;

  if v_plan is not null then
    insert into edoshatch360_subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end)
    values (v_tenant, v_plan, 'trialing', now() + interval '30 days', now() + interval '30 days');
  end if;

  update edoshatch360_users set last_tenant_id = v_tenant where id = auth.uid();

  return v_tenant;
end;
$$;

grant execute on function edoshatch360_create_tenant(text, text, text, edoshatch360_farm_mode) to authenticated;
