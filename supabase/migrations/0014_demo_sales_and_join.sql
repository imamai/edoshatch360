-- Demo sales, plus the RPC that lets a new account open the demo farm.

do $$
declare
  v_tenant uuid;
  v_farm   uuid;
  v_eggs   uuid;
  v_birds  uuid;
  v_manure uuid;
  v_cust   uuid[];
  v_sale   uuid;
  v_n      int;
  v_qty    numeric;
  v_price  bigint;
  v_date   date;
  v_doc    edoshatch360_doc_type;
  v_paid   bigint;
begin
  select id into v_tenant from edoshatch360_tenants where slug = 'sunrise-poultry-demo';
  if v_tenant is null then
    raise notice 'no demo tenant, skipping demo sales';
    return;
  end if;
  if exists (select 1 from edoshatch360_sales where tenant_id = v_tenant) then
    raise notice 'demo sales already present, skipping';
    return;
  end if;

  select id into v_farm from edoshatch360_farms where tenant_id = v_tenant order by created_at limit 1;
  select id into v_eggs   from edoshatch360_products where tenant_id = v_tenant and category = 'eggs' limit 1;
  select id into v_birds  from edoshatch360_products where tenant_id = v_tenant and category = 'live_birds' limit 1;
  select id into v_manure from edoshatch360_products where tenant_id = v_tenant and category = 'manure' limit 1;

  select array_agg(id order by created_at) into v_cust
  from edoshatch360_customers where tenant_id = v_tenant;

  -- Roughly every other day for the last 60 days: an egg sale to one of the
  -- regular buyers, with a realistic split of paid receipts and open invoices.
  for v_n in 0..29 loop
    v_date := current_date - (v_n * 2);
    v_doc  := case when v_n % 3 = 0 then 'invoice' else 'receipt' end;
    v_qty  := 55 + floor(random() * 35);
    v_price := 48000;

    insert into edoshatch360_sales
      (tenant_id, farm_id, customer_id, doc_type, doc_number, sale_date, due_date,
       payment_method, status, created_at)
    values (
      v_tenant, v_farm,
      v_cust[1 + (v_n % array_length(v_cust, 1))],
      v_doc,
      case v_doc when 'invoice' then 'INV-' else 'RCP-' end
        || to_char(v_date, 'YYYY') || '-' || lpad((v_n + 1)::text, 4, '0'),
      v_date,
      case when v_doc = 'invoice' then v_date + 14 else null end,
      case when v_n % 4 = 0 then 'cash'::edoshatch360_pay_method else 'mpesa'::edoshatch360_pay_method end,
      'draft',
      v_date::timestamptz
    )
    returning id into v_sale;

    insert into edoshatch360_sale_items
      (tenant_id, sale_id, product_id, description, quantity, unit_price_cents, line_total_cents, sort_order)
    values (v_tenant, v_sale, v_eggs, 'Eggs (tray of 30)', v_qty, v_price,
            (v_qty * v_price)::bigint, 0);

    -- Some orders pick up birds or manure as well.
    if v_n % 5 = 0 then
      insert into edoshatch360_sale_items
        (tenant_id, sale_id, product_id, description, quantity, unit_price_cents, line_total_cents, sort_order)
      values (v_tenant, v_sale, v_birds, 'Live broiler', 20, 58000, 20 * 58000, 1);
    end if;
    if v_n % 7 = 0 then
      insert into edoshatch360_sale_items
        (tenant_id, sale_id, product_id, description, quantity, unit_price_cents, line_total_cents, sort_order)
      values (v_tenant, v_sale, v_manure, 'Manure', 15, 30000, 15 * 30000, 2);
    end if;

    -- Receipts are paid in full. Invoices: older ones settled, the most
    -- recent few left open so "owed to you" is a real number.
    select total_cents into v_paid from edoshatch360_sales where id = v_sale;

    if v_doc = 'receipt' then
      insert into edoshatch360_customer_payments
        (tenant_id, sale_id, amount_cents, method, paid_at)
      values (v_tenant, v_sale, v_paid,
              case when v_n % 4 = 0 then 'cash'::edoshatch360_pay_method else 'mpesa'::edoshatch360_pay_method end,
              v_date::timestamptz);
    elsif v_n > 6 then
      insert into edoshatch360_customer_payments
        (tenant_id, sale_id, amount_cents, method, paid_at)
      values (v_tenant, v_sale, v_paid, 'mpesa', (v_date + 9)::timestamptz);
    elsif v_n = 3 then
      -- One part-payment, so the "partial" state is represented.
      insert into edoshatch360_customer_payments
        (tenant_id, sale_id, amount_cents, method, paid_at)
      values (v_tenant, v_sale, (v_paid / 2), 'mpesa', (v_date + 5)::timestamptz);
    end if;
  end loop;

  -- A couple of open quotations.
  insert into edoshatch360_sales
    (tenant_id, farm_id, customer_id, doc_type, doc_number, sale_date, status)
  values (v_tenant, v_farm, v_cust[3], 'quotation',
          'QT-' || to_char(current_date, 'YYYY') || '-0001', current_date - 4, 'sent')
  returning id into v_sale;

  insert into edoshatch360_sale_items
    (tenant_id, sale_id, product_id, description, quantity, unit_price_cents, line_total_cents, sort_order)
  values (v_tenant, v_sale, v_eggs, 'Eggs (tray of 30) — weekly supply', 200, 47000, 200 * 47000, 0);

  raise notice 'demo sales created';
end $$;

-- ---------------------------------------------------------------- join --

/**
 * Adds the signed-in user to the demo farm as a read-only viewer.
 *
 * Viewer, not owner, on purpose: the demo tenant is shared by everyone who
 * opens it, so nobody should be able to change or delete its records. Their
 * own organisation is untouched and remains switchable from the top bar.
 */
create or replace function edoshatch360_join_demo()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demo uuid;
begin
  if auth.uid() is null then
    raise exception 'edoshatch360: sign in required';
  end if;

  select id into v_demo from edoshatch360_tenants where slug = 'sunrise-poultry-demo';
  if v_demo is null then
    raise exception 'edoshatch360: demo farm is not available';
  end if;

  perform edoshatch360_ensure_profile();

  insert into edoshatch360_memberships (tenant_id, user_id, role, status)
  values (v_demo, auth.uid(), 'viewer', 'active')
  on conflict (tenant_id, user_id) do nothing;

  update edoshatch360_users set last_tenant_id = v_demo where id = auth.uid();

  return v_demo;
end;
$$;

grant execute on function edoshatch360_join_demo() to authenticated;
