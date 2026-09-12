-- EDOS Hatch360 — core tenancy + farm structure
--
-- IMPORTANT: this database (Supabase project `edos-pos`) is shared with an
-- unrelated live POS application that owns the unprefixed public tables
-- (clients, invoices, payments, products, pos_*, ...). EVERY object created
-- by Hatch360 — tables, enums, functions, indexes — carries the
-- `edoshatch360_` prefix so the two systems can never collide.

-- ---------------------------------------------------------------- enums --

create type edoshatch360_role as enum (
  'owner',        -- tenant owner / business owner
  'manager',      -- farm manager (one or many assigned farms)
  'supervisor',   -- house / flock supervisor
  'worker',       -- records daily activity
  'vet',          -- veterinarian / animal health officer
  'accountant',   -- finance officer
  'sales',        -- sales officer
  'viewer'        -- read-only
);

create type edoshatch360_bird_type as enum (
  'broiler', 'layer', 'kienyeji', 'improved_kienyeji',
  'breeder', 'chick', 'pullet', 'turkey', 'other'
);

create type edoshatch360_flock_status as enum (
  'planned', 'brooding', 'growing', 'laying', 'finishing', 'harvested', 'closed'
);

create type edoshatch360_entry_frequency as enum ('daily', 'weekly', 'milestone');

-- Tenants start in `simple` mode (small-farmer UI, spec §31) and are upgraded
-- to `advanced` progressively — see spec §66 "the interface should grow with
-- the farmer".
create type edoshatch360_farm_mode as enum ('simple', 'advanced');

-- ---------------------------------------------------------------- tables --

create table edoshatch360_tenants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  mode            edoshatch360_farm_mode not null default 'simple',
  country         text not null default 'KE',
  currency        text not null default 'KES',
  timezone        text not null default 'Africa/Nairobi',
  logo_url        text,
  brand_color     text,
  kra_pin         text,
  phone           text,
  email           text,
  address         text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Mirrors auth.users. Row is created by a trigger on auth.users insert so the
-- app never has to special-case "profile not yet created".
create table edoshatch360_users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  email              text,
  phone              text,
  avatar_url         text,
  locale             text not null default 'en',
  is_platform_admin  boolean not null default false,
  last_tenant_id     uuid references edoshatch360_tenants (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table edoshatch360_memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references edoshatch360_tenants (id) on delete cascade,
  user_id     uuid not null references edoshatch360_users (id) on delete cascade,
  role        edoshatch360_role not null default 'worker',
  status      text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  invited_by  uuid references edoshatch360_users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table edoshatch360_farms (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references edoshatch360_tenants (id) on delete cascade,
  name         text not null,
  location     text,
  county       text,
  latitude     numeric(9, 6),
  longitude    numeric(9, 6),
  photo_url    text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table edoshatch360_houses (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references edoshatch360_tenants (id) on delete cascade,
  farm_id     uuid not null references edoshatch360_farms (id) on delete cascade,
  name        text not null,
  code        text,
  capacity    integer check (capacity is null or capacity >= 0),
  house_type  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table edoshatch360_flocks (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references edoshatch360_tenants (id) on delete cascade,
  farm_id                uuid not null references edoshatch360_farms (id) on delete cascade,
  house_id               uuid references edoshatch360_houses (id) on delete set null,
  code                   text not null,
  name                   text,
  bird_type              edoshatch360_bird_type not null,
  breed                  text,
  placement_date         date not null,
  placement_count        integer not null check (placement_count >= 0),
  -- Maintained by trigger from daily records; never written directly by the app.
  current_count          integer not null default 0 check (current_count >= 0),
  source_hatchery        text,
  cost_per_bird_cents    bigint not null default 0 check (cost_per_bird_cents >= 0),
  expected_harvest_date  date,
  status                 edoshatch360_flock_status not null default 'brooding',
  entry_frequency        edoshatch360_entry_frequency not null default 'daily',
  photo_url              text,
  notes                  text,
  closed_at              timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tenant_id, code)
);

-- Restricts a manager/supervisor to specific farms (spec §30). A user with no
-- rows here and a tenant-wide role (owner/accountant) sees every farm.
create table edoshatch360_farm_assignments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references edoshatch360_tenants (id) on delete cascade,
  user_id     uuid not null references edoshatch360_users (id) on delete cascade,
  farm_id     uuid not null references edoshatch360_farms (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, farm_id)
);

-- --------------------------------------------------------------- indexes --

create index edoshatch360_memberships_user_idx   on edoshatch360_memberships (user_id, status);
create index edoshatch360_memberships_tenant_idx on edoshatch360_memberships (tenant_id);
create index edoshatch360_farms_tenant_idx       on edoshatch360_farms (tenant_id) where is_active;
create index edoshatch360_houses_farm_idx        on edoshatch360_houses (farm_id) where is_active;
create index edoshatch360_flocks_tenant_idx      on edoshatch360_flocks (tenant_id, status);
create index edoshatch360_flocks_farm_idx        on edoshatch360_flocks (farm_id);
create index edoshatch360_flocks_house_idx       on edoshatch360_flocks (house_id);
create index edoshatch360_assignments_user_idx   on edoshatch360_farm_assignments (user_id);

-- -------------------------------------------------------------- triggers --

create or replace function edoshatch360_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger edoshatch360_tenants_touch before update on edoshatch360_tenants
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_users_touch before update on edoshatch360_users
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_farms_touch before update on edoshatch360_farms
  for each row execute function edoshatch360_touch_updated_at();
create trigger edoshatch360_flocks_touch before update on edoshatch360_flocks
  for each row execute function edoshatch360_touch_updated_at();

-- Keep edoshatch360_users in lockstep with auth.users.
--
-- auth.users is SHARED with the unrelated POS application living in this same
-- Supabase project, so this trigger swallows its own errors: a failure here
-- must degrade to "Hatch360 profile row missing" (which the app heals on next
-- login via edoshatch360_ensure_profile) and must never abort someone else's
-- signup transaction.
create or replace function edoshatch360_handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  begin
    insert into edoshatch360_users (id, email, full_name, phone)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      coalesce(new.raw_user_meta_data ->> 'phone', new.phone)
    )
    on conflict (id) do nothing;
  exception
    when others then
      raise warning 'edoshatch360: profile provisioning skipped for % (%)', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Self-heal for any auth user that predates this trigger, or whose profile
-- insert was skipped above. Called on login from the app.
create or replace function edoshatch360_ensure_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into edoshatch360_users (id, email, full_name, phone)
  select u.id, u.email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         coalesce(u.raw_user_meta_data ->> 'phone', u.phone)
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

create trigger edoshatch360_on_auth_user_created
  after insert on auth.users
  for each row execute function edoshatch360_handle_new_auth_user();
