-- EDOS Hatch360 — tasks, alerts, subscriptions, settings, audit, CMS

create type edoshatch360_task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
create type edoshatch360_priority as enum ('low', 'normal', 'high', 'urgent');
create type edoshatch360_severity as enum ('info', 'attention', 'critical');

create type edoshatch360_notice_category as enum (
  'critical', 'health', 'production', 'inventory', 'finance', 'task', 'system'
);

create type edoshatch360_sub_status as enum (
  'trialing', 'active', 'past_due', 'cancelled', 'expired'
);

create table edoshatch360_tasks (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references edoshatch360_tenants (id) on delete cascade,
  farm_id      uuid references edoshatch360_farms (id) on delete cascade,
  house_id     uuid references edoshatch360_houses (id) on delete set null,
  flock_id     uuid references edoshatch360_flocks (id) on delete set null,
  title        text not null,
  description  text,
  category     text,
  assignee_id  uuid references edoshatch360_users (id) on delete set null,
  due_date     date,
  priority     edoshatch360_priority not null default 'normal',
  status       edoshatch360_task_status not null default 'todo',
  photo_url    text,
  completed_at timestamptz,
  created_by   uuid references edoshatch360_users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table edoshatch360_notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references edoshatch360_tenants (id) on delete cascade,
  -- null = broadcast to everyone in the tenant.
  user_id     uuid references edoshatch360_users (id) on delete cascade,
  category    edoshatch360_notice_category not null default 'system',
  severity    edoshatch360_severity not null default 'info',
  title       text not null,
  body        text,
  link        text,
  is_read     boolean not null default false,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Pricing is configurable from the admin CMS, never hardcoded (spec §47).
create table edoshatch360_plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  tagline       text,
  description   text,
  price_cents   bigint not null default 0 check (price_cents >= 0),
  currency      text not null default 'KES',
  billing_period text not null default 'month' check (billing_period in ('month', 'year')),
  max_farms     integer,
  max_houses    integer,
  max_birds     integer,
  max_users     integer,
  features      jsonb not null default '[]'::jsonb,
  is_popular    boolean not null default false,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create table edoshatch360_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references edoshatch360_tenants (id) on delete cascade,
  plan_id            uuid not null references edoshatch360_plans (id),
  status             edoshatch360_sub_status not null default 'trialing',
  started_at         timestamptz not null default now(),
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  cancel_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Platform/subscription payments (M-Pesa today, Stripe later). Never stores
-- card data or credentials — only the gateway's own reference (spec §48).
create table edoshatch360_payments (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references edoshatch360_tenants (id) on delete cascade,
  subscription_id  uuid references edoshatch360_subscriptions (id) on delete set null,
  plan_id          uuid references edoshatch360_plans (id) on delete set null,
  provider         text not null default 'mpesa',
  reference        text,
  amount_cents     bigint not null check (amount_cents >= 0),
  currency         text not null default 'KES',
  status           text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  payer_phone      text,
  paid_at          timestamptz,
  gateway_payload  jsonb,
  created_at       timestamptz not null default now()
);

-- Per-tenant key/value config: eTIMS credentials, receipt/invoice branding,
-- tax settings, notification preferences. Kept as jsonb so adding a new
-- setting is a UI change, not a migration.
create table edoshatch360_settings (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references edoshatch360_tenants (id) on delete cascade,
  key        text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references edoshatch360_users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table edoshatch360_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references edoshatch360_tenants (id) on delete cascade,
  user_id     uuid references edoshatch360_users (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ CMS --

create table edoshatch360_cms_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  meta_title       text,
  meta_description text,
  og_image_url     text,
  is_published     boolean not null default true,
  updated_at       timestamptz not null default now()
);

create table edoshatch360_cms_sections (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references edoshatch360_cms_pages (id) on delete cascade,
  section_key  text not null,
  sort_order   integer not null default 0,
  eyebrow      text,
  heading      text,
  subheading   text,
  body         text,
  image_url    text,
  image_alt    text,
  cta_label    text,
  cta_href     text,
  -- Repeating content for the section (feature lists, stat tiles, steps).
  data         jsonb not null default '[]'::jsonb,
  is_visible   boolean not null default true,
  updated_at   timestamptz not null default now(),
  unique (page_id, section_key)
);

create table edoshatch360_cms_media (
  id         uuid primary key default gen_random_uuid(),
  bucket     text not null default 'hatch360-cms',
  path       text not null,
  url        text not null,
  alt_text   text,
  width      integer,
  height     integer,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table edoshatch360_cms_testimonials (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role         text,
  company      text,
  location     text,
  quote        text not null,
  avatar_url   text,
  rating       smallint check (rating is null or rating between 1 and 5),
  sort_order   integer not null default 0,
  is_published boolean not null default true
);

create table edoshatch360_cms_faqs (
  id           uuid primary key default gen_random_uuid(),
  category     text not null default 'general',
  question     text not null,
  answer       text not null,
  sort_order   integer not null default 0,
  is_published boolean not null default true
);

create index edoshatch360_tasks_tenant_idx on edoshatch360_tasks (tenant_id, status, due_date);
create index edoshatch360_tasks_assignee_idx on edoshatch360_tasks (assignee_id, status);
create index edoshatch360_notif_user_idx on edoshatch360_notifications (tenant_id, user_id, is_read) where not is_archived;
create index edoshatch360_subs_tenant_idx on edoshatch360_subscriptions (tenant_id, status);
create index edoshatch360_pay_tenant_idx on edoshatch360_payments (tenant_id, created_at desc);
create index edoshatch360_audit_tenant_idx on edoshatch360_audit_logs (tenant_id, created_at desc);
create index edoshatch360_cms_sections_page_idx on edoshatch360_cms_sections (page_id, sort_order);

create trigger edoshatch360_tasks_touch before update on edoshatch360_tasks
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_subs_touch before update on edoshatch360_subscriptions
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_cmspages_touch before update on edoshatch360_cms_pages
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_cmssections_touch before update on edoshatch360_cms_sections
  for each row execute function edoshatch360_touch_updated_at();
