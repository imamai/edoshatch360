-- Demo tenant with internally consistent records (spec §64).
--
-- Numbers come from real production curves rather than random noise: the
-- layer flock ramps into lay and eases off with age, the broiler flock gains
-- weight and eats in proportion to it, and mortality accrues at a plausible
-- daily rate. Every derived figure — hen-day production, FCR, days of feed
-- left — therefore computes to something a farmer would recognise.

do $$
declare
  v_tenant   uuid;
  v_farm_a   uuid;
  v_farm_b   uuid;
  v_h1 uuid; v_h2 uuid; v_h3 uuid;
  v_layers uuid; v_broilers uuid; v_kienyeji uuid;
  v_mash uuid; v_starter uuid;
begin
  if exists (select 1 from edoshatch360_tenants where slug = 'sunrise-poultry-demo') then
    raise notice 'demo tenant already present, skipping';
    return;
  end if;

  insert into edoshatch360_tenants (name, slug, mode, currency, phone, email, address, kra_pin)
  values ('Sunrise Poultry (Demo)', 'sunrise-poultry-demo', 'advanced', 'KES',
          '0712 000 000', 'demo@edoscentre.co.ke', 'Ruiru, Kiambu County', 'A123456789Z')
  returning id into v_tenant;

  insert into edoshatch360_farms (tenant_id, name, location, county)
  values (v_tenant, 'Ruiru main farm', 'Ruiru', 'Kiambu') returning id into v_farm_a;
  insert into edoshatch360_farms (tenant_id, name, location, county)
  values (v_tenant, 'Juja site', 'Juja', 'Kiambu') returning id into v_farm_b;

  insert into edoshatch360_houses (tenant_id, farm_id, name, code, capacity, house_type)
  values (v_tenant, v_farm_a, 'House 01', 'H1', 3000, 'deep_litter') returning id into v_h1;
  insert into edoshatch360_houses (tenant_id, farm_id, name, code, capacity, house_type)
  values (v_tenant, v_farm_a, 'House 02', 'H2', 3500, 'deep_litter') returning id into v_h2;
  insert into edoshatch360_houses (tenant_id, farm_id, name, code, capacity, house_type)
  values (v_tenant, v_farm_b, 'House 03', 'H3', 1000, 'free_range') returning id into v_h3;

  insert into edoshatch360_flocks
    (tenant_id, farm_id, house_id, code, name, bird_type, breed, placement_date,
     placement_count, cost_per_bird_cents, status, source_hatchery, entry_frequency)
  values (v_tenant, v_farm_a, v_h1, 'FL-2026-001', 'House 1 layers', 'layer', 'Isa Brown',
          current_date - 210, 2500, 12000, 'laying', 'Kenchic', 'daily')
  returning id into v_layers;

  insert into edoshatch360_flocks
    (tenant_id, farm_id, house_id, code, name, bird_type, breed, placement_date,
     placement_count, cost_per_bird_cents, expected_harvest_date, status, source_hatchery, entry_frequency)
  values (v_tenant, v_farm_a, v_h2, 'FL-2026-002', 'House 2 broilers', 'broiler', 'Cobb 500',
          current_date - 28, 3000, 9500, current_date + 7, 'finishing', 'Kenchic', 'daily')
  returning id into v_broilers;

  insert into edoshatch360_flocks
    (tenant_id, farm_id, house_id, code, name, bird_type, breed, placement_date,
     placement_count, cost_per_bird_cents, status, entry_frequency)
  values (v_tenant, v_farm_b, v_h3, 'FL-2026-003', 'Juja kienyeji', 'improved_kienyeji', 'Kuroiler',
          current_date - 150, 600, 15000, 'laying', 'daily')
  returning id into v_kienyeji;

  -- ---------------------------------------------------- layer records --
  insert into edoshatch360_daily_records
    (tenant_id, flock_id, record_date, mortality, culls, eggs_collected, eggs_broken,
     eggs_rejected, feed_consumed_kg, water_consumed_liters)
  select
    v_tenant, v_layers, d::date,
    case when random() < 0.35 then 1 else 0 end,
    case when random() < 0.06 then 1 else 0 end,
    greatest(0, round(
      2388
      * least(0.93, greatest(0, ((d::date - (current_date - 210)) - 119) / 60.0 * 0.93))
      * (1 - greatest(0, ((d::date - (current_date - 210)) - 200) * 0.0006))
      * (0.97 + random() * 0.06)
    ))::int,
    (random() * 22)::int,
    (random() * 14)::int,
    round((274 * (0.96 + random() * 0.08))::numeric, 1),
    round((690 * (0.94 + random() * 0.12))::numeric, 0)
  from generate_series(current_date - 89, current_date - 1, interval '1 day') d;

  -- --------------------------------------------------- broiler records --
  insert into edoshatch360_daily_records
    (tenant_id, flock_id, record_date, mortality, culls, feed_consumed_kg,
     water_consumed_liters, avg_weight_grams)
  select
    v_tenant, v_broilers, d::date,
    case when (d::date - (current_date - 28)) <= 7 then (random() * 4)::int
         when random() < 0.5 then 1 else 0 end,
    case when random() < 0.08 then 1 else 0 end,
    round((2950 * (0.018 + (d::date - (current_date - 28)) * 0.0045)
           * (0.96 + random() * 0.08))::numeric, 1),
    round((2950 * (0.036 + (d::date - (current_date - 28)) * 0.009))::numeric, 0),
    -- Weighed weekly, as most farms actually do.
    case when (d::date - (current_date - 28)) % 7 = 0
      then round((42 + (d::date - (current_date - 28)) * 56 * (0.98 + random() * 0.04))::numeric, 0)
      else null end
  from generate_series(current_date - 27, current_date - 1, interval '1 day') d;

  -- -------------------------------------------------- kienyeji records --
  insert into edoshatch360_daily_records
    (tenant_id, flock_id, record_date, mortality, culls, eggs_collected, eggs_broken,
     feed_consumed_kg, water_consumed_liters)
  select
    v_tenant, v_kienyeji, d::date,
    case when random() < 0.2 then 1 else 0 end,
    0,
    greatest(0, round(580 * 0.58 * (0.92 + random() * 0.16))::int),
    (random() * 5)::int,
    round((62 * (0.93 + random() * 0.14))::numeric, 1),
    round((150 * (0.93 + random() * 0.14))::numeric, 0)
  from generate_series(current_date - 89, current_date - 1, interval '1 day') d;

  -- ------------------------------------------------------- vaccinations --
  insert into edoshatch360_vaccinations
    (tenant_id, flock_id, vaccine, disease_target, day_of_age, due_date, status, administered_on)
  values
    (v_tenant, v_broilers, 'Newcastle disease (NDV) — Hitchner B1', 'Newcastle', 7,
     current_date - 21, 'done', current_date - 21),
    (v_tenant, v_broilers, 'Infectious bursal disease (Gumboro)', 'Gumboro', 14,
     current_date - 14, 'done', current_date - 14),
    (v_tenant, v_broilers, 'Gumboro booster', 'Gumboro', 18, current_date - 10, 'done', current_date - 10),
    (v_tenant, v_broilers, 'Newcastle disease (Lasota) booster', 'Newcastle', 21,
     current_date - 7, 'done', current_date - 7),
    (v_tenant, v_layers, 'Newcastle disease — quarterly booster', 'Newcastle', 213,
     current_date + 3, 'due', null),
    (v_tenant, v_kienyeji, 'Fowl typhoid', 'Typhoid', 148, current_date - 2, 'overdue', null);

  -- ---------------------------------------------------------- inventory --
  insert into edoshatch360_inventory
    (tenant_id, farm_id, category, name, unit, reorder_level, unit_cost_cents, supplier)
  values (v_tenant, v_farm_a, 'feed', 'Layers mash', 'kg', 800, 6200, 'Unga Farm Care')
  returning id into v_mash;

  insert into edoshatch360_inventory
    (tenant_id, farm_id, category, name, unit, reorder_level, unit_cost_cents, supplier)
  values (v_tenant, v_farm_a, 'feed', 'Broiler finisher', 'kg', 600, 7100, 'Unga Farm Care')
  returning id into v_starter;

  insert into edoshatch360_inventory
    (tenant_id, farm_id, category, name, unit, reorder_level, unit_cost_cents, supplier)
  values
    (v_tenant, v_farm_a, 'vaccine', 'Newcastle (Lasota) 1000 doses', 'vial', 2, 45000, 'Cooper K-Brands'),
    (v_tenant, v_farm_a, 'packaging', 'Egg trays (30)', 'piece', 200, 1500, 'Local supplier'),
    (v_tenant, v_farm_a, 'cleaning', 'Disinfectant', 'litre', 5, 85000, 'Agrovet');

  insert into edoshatch360_inventory_transactions
    (tenant_id, item_id, txn_type, quantity, unit_cost_cents, total_cents, occurred_on, reference)
  values
    (v_tenant, v_mash,    'opening',  6000, 6200, 37200000, current_date - 60, 'Opening balance'),
    (v_tenant, v_mash,    'purchase', 4000, 6200, 24800000, current_date - 25, 'Unga Farm Care'),
    (v_tenant, v_mash,    'usage',   -8200, 6200, 50840000, current_date - 1,  'Daily feeding'),
    (v_tenant, v_starter, 'opening',  5000, 7100, 35500000, current_date - 28, 'Opening balance'),
    (v_tenant, v_starter, 'usage',   -4550, 7100, 32305000, current_date - 1,  'Daily feeding');

  -- ---------------------------------------------------------- customers --
  insert into edoshatch360_customers (tenant_id, name, phone, location, customer_type, credit_limit_cents)
  values
    (v_tenant, 'Mama Njeri Groceries', '0722 111 222', 'Ruiru town', 'retailer',   5000000),
    (v_tenant, 'Thika Road Hotel',     '0733 444 555', 'Thika Road', 'hotel',     15000000),
    (v_tenant, 'Juja Boys High School','0700 888 999', 'Juja',       'school',    20000000),
    (v_tenant, 'Peter Kamau',          '0711 222 333', 'Ruiru',      'individual',       0),
    (v_tenant, 'Kariuki Wholesalers',  '0755 666 777', 'Nairobi',    'wholesaler',10000000);

  insert into edoshatch360_products (tenant_id, name, category, unit, default_price_cents)
  values
    (v_tenant, 'Eggs (tray of 30)', 'eggs',            'tray',  48000),
    (v_tenant, 'Live broiler',      'live_birds',      'bird',  58000),
    (v_tenant, 'Dressed chicken',   'processed_birds', 'kg',    68000),
    (v_tenant, 'Spent layer',       'spent_layers',    'bird',  42000),
    (v_tenant, 'Manure',            'manure',          'bag',   30000);

  -- ----------------------------------------------------------- expenses --
  insert into edoshatch360_expenses
    (tenant_id, farm_id, category, description, amount_cents, expense_date, vendor, payment_method)
  select v_tenant, v_farm_a, cat, descr, amt, dt, vendor, method
  from (values
    ('feed'::edoshatch360_expense_category, 'Layers mash — 40 bags',       24800000, current_date - 25, 'Unga Farm Care', 'bank'::edoshatch360_pay_method),
    ('feed',        'Broiler finisher — 50 bags',                          35500000, current_date - 28, 'Unga Farm Care', 'bank'),
    ('labour',      'Farm hands — monthly wages',                           5400000, current_date - 12, 'Staff',          'mpesa'),
    ('labour',      'Farm hands — monthly wages',                           5400000, current_date - 42, 'Staff',          'mpesa'),
    ('electricity', 'KPLC bill',                                            1240000, current_date - 9,  'Kenya Power',    'mpesa'),
    ('electricity', 'KPLC bill',                                            1180000, current_date - 39, 'Kenya Power',    'mpesa'),
    ('water',       'Water bill',                                            620000, current_date - 8,  'Water company',  'mpesa'),
    ('vaccines',    'Newcastle vaccine and vitamins',                         890000, current_date - 21, 'Agrovet',        'cash'),
    ('medication',  'Coccidiostat',                                           450000, current_date - 18, 'Agrovet',        'cash'),
    ('transport',   'Delivery runs',                                         1100000, current_date - 5,  'Boda riders',    'cash'),
    ('repairs',     'Drinker line repair',                                    380000, current_date - 15, 'Fundi',          'cash'),
    ('other',       'Egg trays',                                              300000, current_date - 20, 'Local supplier', 'cash')
  ) as t(cat, descr, amt, dt, vendor, method);

  raise notice 'demo tenant % created', v_tenant;
end $$;
