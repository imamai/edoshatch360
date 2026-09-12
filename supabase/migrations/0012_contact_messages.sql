-- Contact form submissions from the public marketing site.
create table edoshatch360_contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  farm_size  text,
  county     text,
  message    text not null,
  source     text not null default 'website',
  handled    boolean not null default false,
  created_at timestamptz not null default now(),
  -- Light abuse guard: one submission per email per minute. Set by trigger,
  -- never by the client.
  dedupe_key text
);

create unique index edoshatch360_contact_dedupe_idx on edoshatch360_contact_messages (dedupe_key);
create index edoshatch360_contact_new_idx on edoshatch360_contact_messages (created_at desc) where not handled;

create or replace function edoshatch360_set_contact_dedupe()
returns trigger
language plpgsql
as $$
begin
  new.dedupe_key :=
    lower(trim(new.email)) || ':' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI');
  new.handled := false;
  new.created_at := now();
  return new;
end;
$$;

create trigger edoshatch360_contact_dedupe
  before insert on edoshatch360_contact_messages
  for each row execute function edoshatch360_set_contact_dedupe();

alter table edoshatch360_contact_messages enable row level security;

-- Anyone may submit; only platform admins may read. Nothing written here is
-- readable by the anonymous role that wrote it.
create policy "contact submit" on edoshatch360_contact_messages
  for insert to anon, authenticated
  with check (
    length(trim(name)) between 1 and 120
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and length(trim(message)) between 5 and 4000
  );

create policy "contact read admin" on edoshatch360_contact_messages
  for select to authenticated
  using (edoshatch360_is_platform_admin());

create policy "contact update admin" on edoshatch360_contact_messages
  for update to authenticated
  using (edoshatch360_is_platform_admin())
  with check (edoshatch360_is_platform_admin());
