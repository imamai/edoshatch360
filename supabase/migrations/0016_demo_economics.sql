-- Make the demo farm's economics honest.
--
-- Two problems with the first pass: daily records stopped at yesterday, so
-- "Eggs today" read 0 with a −100% delta; and feed purchases were all dated
-- in the previous month while sales fell in this one, producing an 86% profit
-- margin. No poultry farm runs at 86%. Feed is roughly 60-70% of the cost of
-- an egg, and that is what these figures now reflect.

do $$
declare
  v_tenant   uuid;
  v_farm     uuid;
  v_layers   uuid;
  v_broilers uuid;
  v_kienyeji uuid;
  v_eggs     uuid;
  v_birds    uuid;
  v_cust     uuid[];
  v_sale     uuid;
  v_month    date := date_trunc('month', current_date)::date;
  v_days     int  := (current_date - date_trunc('month', current_date)::date) + 1;
begin
  select id into v_tenant from edoshatch360_tenants where slug = 'sunrise-poultry-demo';
  if v_tenant is null then return; end if;

  select id into v_farm from edoshatch360_farms where tenant_id = v_tenant order by created_at limit 1;
  select id into v_layers   from edoshatch360_flocks where tenant_id = v_tenant and code = 'FL-2026-001';
  select id into v_broilers from edoshatch360_flocks where tenant_id = v_tenant and code = 'FL-2026-002';
  select id into v_kienyeji from edoshatch360_flocks where tenant_id = v_tenant and code = 'FL-2026-003';
  select id into v_eggs  from edoshatch360_products where tenant_id = v_tenant and category = 'eggs' limit 1;
  select id into v_birds from edoshatch360_products where tenant_id = v_tenant and category = 'live_birds' limit 1;
  select array_agg(id order by created_at) into v_cust
  from edoshatch360_customers where tenant_id = v_tenant;

  -- ------------------------------------------------ today's records --
  insert into edoshatch360_daily_records
    (tenant_id, flock_id, record_date, mortality, culls, eggs_collected, eggs_broken,
     eggs_rejected, feed_consumed_kg, water_consumed_liters)
  values
    (v_tenant, v_layers, current_date, 1, 0, 1842, 14, 9, 276.4, 702),
    (v_tenant, v_kienyeji, current_date, 0, 0, 331, 3, 0, 63.5, 154)
  on conflict (flock_id, record_date) do nothing;

  insert into edoshatch360_daily_records
    (tenant_id, flock_id, record_date, mortality, culls, feed_consumed_kg,
     water_consumed_liters, avg_weight_grams)
  values (v_tenant, v_broilers, current_date, 1, 0, 428.5, 1040, 1620)
  on conflict (flock_id, record_date) do nothing;

  -- ------------------------------------------- feed cost, this month --
  -- Sized from what the flocks actually ate: ~287 kg/day layers at KES 62,
  -- ~345 kg/day broilers at KES 71, ~63 kg/day kienyeji at KES 62.
  if not exists (
    select 1 from edoshatch360_expenses
    where tenant_id = v_tenant and category = 'feed' and expense_date >= v_month
  ) then
    insert into edoshatch360_expenses
      (tenant_id, farm_id, flock_id, category, description, amount_cents, expense_date, vendor, payment_method)
    values
      (v_tenant, v_farm, v_layers,
       'feed', 'Layers mash — ' || round(287 * v_days / 50.0) || ' bags',
       round(287 * v_days * 62)::bigint * 100, v_month + 2, 'Unga Farm Care', 'bank'),
      (v_tenant, v_farm, v_broilers,
       'feed', 'Broiler finisher — ' || round(345 * v_days / 50.0) || ' bags',
       round(345 * v_days * 71)::bigint * 100, v_month + 1, 'Unga Farm Care', 'bank'),
      (v_tenant, v_farm, v_kienyeji,
       'feed', 'Kienyeji growers mash — ' || round(63 * v_days / 50.0) || ' bags',
       round(63 * v_days * 62)::bigint * 100, v_month + 3, 'Agrovet', 'mpesa');
  end if;

  -- Running costs for the current month, so the cost mix is not feed alone.
  if not exists (
    select 1 from edoshatch360_expenses
    where tenant_id = v_tenant and category = 'labour' and expense_date >= v_month
  ) then
    insert into edoshatch360_expenses
      (tenant_id, farm_id, category, description, amount_cents, expense_date, vendor, payment_method)
    values
      (v_tenant, v_farm, 'labour',      'Farm hands — monthly wages', 5400000, v_month + 4, 'Staff',         'mpesa'),
      (v_tenant, v_farm, 'electricity', 'KPLC bill',                  1290000, v_month + 6, 'Kenya Power',   'mpesa'),
      (v_tenant, v_farm, 'water',       'Water bill',                  640000, v_month + 6, 'Water company', 'mpesa'),
      (v_tenant, v_farm, 'transport',   'Delivery runs',              1350000, v_month + 5, 'Boda riders',   'cash'),
      (v_tenant, v_farm, 'medication',  'Vitamins and coccidiostat',   520000, v_month + 3, 'Agrovet',       'cash');
  end if;

  -- ----------------------------------- egg sales matched to production --
  -- The layers produce roughly 61 trays a day and the kienyeji another 11.
  -- Previously the demo sold about half of that, which made revenue look
  -- unrelated to the production figures on the same dashboard.
  update edoshatch360_sale_items si
  set quantity = round(si.quantity * 2.1),
      line_total_cents = (round(si.quantity * 2.1) * si.unit_price_cents)::bigint
  from edoshatch360_sales s
  where s.id = si.sale_id
    and s.tenant_id = v_tenant
    and si.product_id = v_eggs
    and s.doc_type in ('invoice', 'receipt');

  -- ------------------------------------------ progressive broiler sale --
  -- A finishing batch sold in lots rather than all at once, which is how it
  -- actually goes. The matching birds_sold entries keep the live bird count
  -- and the revenue telling the same story.
  if not exists (
    select 1 from edoshatch360_sales
    where tenant_id = v_tenant and doc_number like 'RCP-BRL-%'
  ) then
    for i in 1..3 loop
      insert into edoshatch360_sales
        (tenant_id, farm_id, customer_id, doc_type, doc_number, sale_date,
         payment_method, status, notes)
      values (v_tenant, v_farm, v_cust[5], 'receipt',
              'RCP-BRL-' || to_char(current_date, 'YYYY') || '-' || lpad(i::text, 3, '0'),
              current_date - (i * 2), 'mpesa', 'draft',
              'Broiler harvest lot ' || i)
      returning id into v_sale;

      insert into edoshatch360_sale_items
        (tenant_id, sale_id, product_id, description, quantity, unit_price_cents, line_total_cents, sort_order)
      values (v_tenant, v_sale, v_birds, 'Live broiler — harvest lot ' || i,
              260, 58000, 260 * 58000, 0);

      insert into edoshatch360_customer_payments
        (tenant_id, sale_id, amount_cents, method, paid_at)
      values (v_tenant, v_sale, 260 * 58000, 'mpesa', (current_date - (i * 2))::timestamptz);

      update edoshatch360_daily_records
      set birds_sold = 260
      where flock_id = v_broilers and record_date = current_date - (i * 2);
    end loop;
  end if;

  raise notice 'demo economics adjusted over % days of the month', v_days;
end $$;
