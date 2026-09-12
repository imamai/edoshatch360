-- EDOS Hatch360 — customers, sales, finance

create type edoshatch360_customer_type as enum (
  'individual', 'retailer', 'wholesaler', 'hotel', 'restaurant',
  'school', 'distributor', 'other'
);

create type edoshatch360_product_category as enum (
  'eggs', 'live_birds', 'processed_birds', 'spent_layers',
  'chicks', 'manure', 'feed', 'other'
);

create type edoshatch360_doc_type as enum ('quotation', 'order', 'invoice', 'receipt');

create type edoshatch360_sale_status as enum (
  'draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'
);

create type edoshatch360_pay_method as enum ('cash', 'mpesa', 'bank', 'credit', 'cheque', 'other');

create type edoshatch360_expense_category as enum (
  'feed', 'chicks', 'vaccines', 'medication', 'labour', 'electricity',
  'water', 'transport', 'repairs', 'equipment', 'rent', 'marketing', 'other'
);

create table edoshatch360_customers (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references edoshatch360_tenants (id) on delete cascade,
  name               text not null,
  phone              text,
  email              text,
  location           text,
  customer_type      edoshatch360_customer_type not null default 'individual',
  credit_limit_cents bigint not null default 0 check (credit_limit_cents >= 0),
  notes              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table edoshatch360_products (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references edoshatch360_tenants (id) on delete cascade,
  name                text not null,
  category            edoshatch360_product_category not null,
  unit                text not null default 'pc',
  default_price_cents bigint not null default 0 check (default_price_cents >= 0),
  photo_url           text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create table edoshatch360_sales (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references edoshatch360_tenants (id) on delete cascade,
  farm_id           uuid references edoshatch360_farms (id) on delete set null,
  customer_id       uuid references edoshatch360_customers (id) on delete set null,
  doc_type          edoshatch360_doc_type not null default 'receipt',
  doc_number        text not null,
  sale_date         date not null default current_date,
  due_date          date,
  subtotal_cents    bigint not null default 0,
  discount_cents    bigint not null default 0 check (discount_cents >= 0),
  tax_cents         bigint not null default 0 check (tax_cents >= 0),
  total_cents       bigint not null default 0,
  amount_paid_cents bigint not null default 0 check (amount_paid_cents >= 0),
  -- Derived so "who owes me what" is a plain indexed query, never an app-side sum.
  balance_cents     bigint generated always as (total_cents - amount_paid_cents) stored,
  payment_method    edoshatch360_pay_method,
  status            edoshatch360_sale_status not null default 'draft',
  notes             text,
  created_by        uuid references edoshatch360_users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, doc_number)
);

create table edoshatch360_sale_items (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references edoshatch360_tenants (id) on delete cascade,
  sale_id          uuid not null references edoshatch360_sales (id) on delete cascade,
  product_id       uuid references edoshatch360_products (id) on delete set null,
  flock_id         uuid references edoshatch360_flocks (id) on delete set null,
  description      text not null,
  quantity         numeric(12, 2) not null check (quantity > 0),
  unit_price_cents bigint not null default 0 check (unit_price_cents >= 0),
  discount_cents   bigint not null default 0 check (discount_cents >= 0),
  line_total_cents bigint not null default 0,
  sort_order       integer not null default 0
);

create table edoshatch360_customer_payments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references edoshatch360_tenants (id) on delete cascade,
  sale_id     uuid not null references edoshatch360_sales (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  method      edoshatch360_pay_method not null default 'cash',
  reference   text,
  paid_at     timestamptz not null default now(),
  received_by uuid references edoshatch360_users (id) on delete set null,
  notes       text
);

create table edoshatch360_expenses (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references edoshatch360_tenants (id) on delete cascade,
  farm_id       uuid references edoshatch360_farms (id) on delete set null,
  flock_id      uuid references edoshatch360_flocks (id) on delete set null,
  category      edoshatch360_expense_category not null,
  description   text not null,
  amount_cents  bigint not null check (amount_cents >= 0),
  expense_date  date not null default current_date,
  vendor        text,
  payment_method edoshatch360_pay_method,
  reference     text,
  receipt_url   text,
  created_by    uuid references edoshatch360_users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index edoshatch360_customers_tenant_idx on edoshatch360_customers (tenant_id) where is_active;
create index edoshatch360_products_tenant_idx on edoshatch360_products (tenant_id) where is_active;
create index edoshatch360_sales_tenant_idx on edoshatch360_sales (tenant_id, sale_date desc);
create index edoshatch360_sales_customer_idx on edoshatch360_sales (customer_id, sale_date desc);
create index edoshatch360_sales_outstanding_idx on edoshatch360_sales (tenant_id, status) where balance_cents > 0;
create index edoshatch360_saleitems_sale_idx on edoshatch360_sale_items (sale_id, sort_order);
create index edoshatch360_custpay_sale_idx on edoshatch360_customer_payments (sale_id, paid_at desc);
create index edoshatch360_expenses_tenant_idx on edoshatch360_expenses (tenant_id, expense_date desc);
create index edoshatch360_expenses_flock_idx on edoshatch360_expenses (flock_id, expense_date desc);

create trigger edoshatch360_customers_touch before update on edoshatch360_customers
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_sales_touch before update on edoshatch360_sales
  for each row execute function edoshatch360_touch_updated_at();

-- Roll sale item lines up into the sale header, then settle status from the
-- payments actually recorded. Both directions recompute from scratch so an
-- edited or deleted line/payment can never strand a stale total.
create or replace function edoshatch360_resum_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal bigint;
  v_paid     bigint;
  v_total    bigint;
  v_doc      edoshatch360_doc_type;
  v_due      date;
begin
  select coalesce(sum(line_total_cents), 0) into v_subtotal
  from edoshatch360_sale_items where sale_id = p_sale_id;

  select coalesce(sum(amount_cents), 0) into v_paid
  from edoshatch360_customer_payments where sale_id = p_sale_id;

  update edoshatch360_sales s
  set subtotal_cents    = v_subtotal,
      total_cents       = greatest(0, v_subtotal - s.discount_cents + s.tax_cents),
      amount_paid_cents = v_paid
  where s.id = p_sale_id
  returning s.total_cents, s.doc_type, s.due_date into v_total, v_doc, v_due;

  -- A quotation or draft order is never "paid"; only invoices/receipts settle.
  update edoshatch360_sales s
  set status = case
        when s.status = 'cancelled' then 'cancelled'
        when v_doc in ('quotation', 'order') then s.status
        when v_paid >= v_total and v_total > 0 then 'paid'
        when v_paid > 0 then 'partial'
        when v_due is not null and v_due < current_date then 'overdue'
        else s.status
      end
  where s.id = p_sale_id;
end;
$$;

create or replace function edoshatch360_sale_rollup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform edoshatch360_resum_sale(coalesce(new.sale_id, old.sale_id));
  return coalesce(new, old);
end;
$$;

create trigger edoshatch360_saleitems_rollup
  after insert or update or delete on edoshatch360_sale_items
  for each row execute function edoshatch360_sale_rollup();

create trigger edoshatch360_custpay_rollup
  after insert or update or delete on edoshatch360_customer_payments
  for each row execute function edoshatch360_sale_rollup();
