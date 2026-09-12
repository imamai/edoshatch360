-- EDOS Hatch360 — daily operations, health, feed & inventory

create type edoshatch360_health_event as enum (
  'disease_incident', 'vet_visit', 'treatment', 'mortality_cause', 'observation'
);

create type edoshatch360_inventory_category as enum (
  'feed', 'vaccine', 'medication', 'equipment', 'packaging',
  'cleaning', 'spare_parts', 'other'
);

create type edoshatch360_stock_txn as enum (
  'opening', 'purchase', 'usage', 'adjustment', 'wastage', 'transfer'
);

-- One row per flock per date. This is the "60-second" entry from spec §14/§15
-- and doubles as the production record: eggs, feed, water, weight and
-- environment all land here rather than in four separate near-empty tables
-- (spec §70 forbids unnecessary duplication).
create table edoshatch360_daily_records (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references edoshatch360_tenants (id) on delete cascade,
  flock_id               uuid not null references edoshatch360_flocks (id) on delete cascade,
  record_date            date not null,
  mortality              integer not null default 0 check (mortality >= 0),
  culls                  integer not null default 0 check (culls >= 0),
  birds_sold             integer not null default 0 check (birds_sold >= 0),
  eggs_collected         integer check (eggs_collected is null or eggs_collected >= 0),
  eggs_broken            integer check (eggs_broken is null or eggs_broken >= 0),
  eggs_rejected          integer check (eggs_rejected is null or eggs_rejected >= 0),
  feed_consumed_kg       numeric(10, 2) check (feed_consumed_kg is null or feed_consumed_kg >= 0),
  water_consumed_liters  numeric(10, 2) check (water_consumed_liters is null or water_consumed_liters >= 0),
  avg_weight_grams       numeric(10, 2) check (avg_weight_grams is null or avg_weight_grams >= 0),
  temperature_c          numeric(5, 2),
  humidity_pct           numeric(5, 2),
  notes                  text,
  photo_url              text,
  recorded_by            uuid references edoshatch360_users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (flock_id, record_date)
);

-- Vaccination plan + actual administration in one row: a scheduled dose is
-- created with status 'due' and completed in place, so "what is due" and
-- "what was given" never drift apart.
create table edoshatch360_vaccinations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references edoshatch360_tenants (id) on delete cascade,
  flock_id          uuid not null references edoshatch360_flocks (id) on delete cascade,
  vaccine           text not null,
  disease_target    text,
  day_of_age        integer check (day_of_age is null or day_of_age >= 0),
  due_date          date not null,
  status            text not null default 'due' check (status in ('due', 'done', 'skipped', 'overdue')),
  administered_on   date,
  administered_by   uuid references edoshatch360_users (id) on delete set null,
  route             text,
  dose              text,
  birds_covered     integer check (birds_covered is null or birds_covered >= 0),
  cost_cents        bigint not null default 0 check (cost_cents >= 0),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table edoshatch360_medications (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references edoshatch360_tenants (id) on delete cascade,
  flock_id           uuid not null references edoshatch360_flocks (id) on delete cascade,
  product_name       text not null,
  reason             text,
  started_on         date not null,
  ended_on           date,
  dosage             text,
  route              text,
  withdrawal_days    integer not null default 0 check (withdrawal_days >= 0),
  -- Derived: the date after which birds/eggs are safe to sell.
  withdrawal_until   date generated always as (
    (coalesce(ended_on, started_on) + withdrawal_days)
  ) stored,
  administered_by    uuid references edoshatch360_users (id) on delete set null,
  cost_cents         bigint not null default 0 check (cost_cents >= 0),
  notes              text,
  created_at         timestamptz not null default now()
);

create table edoshatch360_health_records (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references edoshatch360_tenants (id) on delete cascade,
  flock_id      uuid not null references edoshatch360_flocks (id) on delete cascade,
  event_type    edoshatch360_health_event not null,
  occurred_on   date not null,
  title         text not null,
  symptoms      text,
  diagnosis     text,
  treatment     text,
  birds_affected integer check (birds_affected is null or birds_affected >= 0),
  severity      text check (severity is null or severity in ('low', 'medium', 'high', 'critical')),
  vet_name      text,
  cost_cents    bigint not null default 0 check (cost_cents >= 0),
  photo_url     text,
  notes         text,
  recorded_by   uuid references edoshatch360_users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table edoshatch360_inventory (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references edoshatch360_tenants (id) on delete cascade,
  farm_id           uuid references edoshatch360_farms (id) on delete cascade,
  category          edoshatch360_inventory_category not null,
  name              text not null,
  sku               text,
  unit              text not null default 'kg',
  -- Maintained by trigger from edoshatch360_inventory_transactions.
  current_stock     numeric(12, 2) not null default 0,
  reorder_level     numeric(12, 2) not null default 0 check (reorder_level >= 0),
  unit_cost_cents   bigint not null default 0 check (unit_cost_cents >= 0),
  supplier          text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table edoshatch360_inventory_transactions (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references edoshatch360_tenants (id) on delete cascade,
  item_id          uuid not null references edoshatch360_inventory (id) on delete cascade,
  txn_type         edoshatch360_stock_txn not null,
  -- Signed at write time by the app: positive for opening/purchase, negative
  -- for usage/wastage; adjustments may be either.
  quantity         numeric(12, 2) not null,
  unit_cost_cents  bigint not null default 0 check (unit_cost_cents >= 0),
  total_cents      bigint not null default 0,
  reference        text,
  flock_id         uuid references edoshatch360_flocks (id) on delete set null,
  house_id         uuid references edoshatch360_houses (id) on delete set null,
  occurred_on      date not null default current_date,
  notes            text,
  created_by       uuid references edoshatch360_users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index edoshatch360_daily_flock_date_idx on edoshatch360_daily_records (flock_id, record_date desc);
create index edoshatch360_daily_tenant_date_idx on edoshatch360_daily_records (tenant_id, record_date desc);
create index edoshatch360_vacc_flock_idx on edoshatch360_vaccinations (flock_id, due_date);
create index edoshatch360_vacc_due_idx on edoshatch360_vaccinations (tenant_id, status, due_date);
create index edoshatch360_meds_flock_idx on edoshatch360_medications (flock_id, started_on desc);
create index edoshatch360_health_flock_idx on edoshatch360_health_records (flock_id, occurred_on desc);
create index edoshatch360_inv_tenant_idx on edoshatch360_inventory (tenant_id, category) where is_active;
create index edoshatch360_invtxn_item_idx on edoshatch360_inventory_transactions (item_id, occurred_on desc);
create index edoshatch360_invtxn_tenant_idx on edoshatch360_inventory_transactions (tenant_id, occurred_on desc);

create trigger edoshatch360_daily_touch before update on edoshatch360_daily_records
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_vacc_touch before update on edoshatch360_vaccinations
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_inv_touch before update on edoshatch360_inventory
  for each row execute function edoshatch360_touch_updated_at();

-- Recompute a flock's live bird count from placement minus every loss/sale
-- recorded to date. Full recompute (not an incremental +/-) so that editing or
-- deleting a past record can never leave the count permanently skewed.
create or replace function edoshatch360_recount_flock(p_flock_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update edoshatch360_flocks f
  set current_count = greatest(
    0,
    f.placement_count - coalesce((
      select sum(d.mortality + d.culls + d.birds_sold)
      from edoshatch360_daily_records d
      where d.flock_id = f.id
    ), 0)
  )
  where f.id = p_flock_id;
$$;

create or replace function edoshatch360_daily_records_recount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform edoshatch360_recount_flock(coalesce(new.flock_id, old.flock_id));
  return coalesce(new, old);
end;
$$;

create trigger edoshatch360_daily_recount
  after insert or update or delete on edoshatch360_daily_records
  for each row execute function edoshatch360_daily_records_recount();

-- Keep edoshatch360_inventory.current_stock as the sum of its transactions.
create or replace function edoshatch360_restock_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid := coalesce(new.item_id, old.item_id);
begin
  update edoshatch360_inventory i
  set current_stock = coalesce((
    select sum(t.quantity)
    from edoshatch360_inventory_transactions t
    where t.item_id = i.id
  ), 0)
  where i.id = v_item;
  return coalesce(new, old);
end;
$$;

create trigger edoshatch360_invtxn_restock
  after insert or update or delete on edoshatch360_inventory_transactions
  for each row execute function edoshatch360_restock_item();
