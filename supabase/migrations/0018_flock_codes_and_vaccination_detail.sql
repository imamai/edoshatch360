-- Batch codes derived from the farm and bird type, and a fuller vaccination
-- record: who gave the dose, who supervised it, which vial it came from.

-- ------------------------------------------------------- vaccinations --

alter table edoshatch360_vaccinations
  add column if not exists supervised_by     uuid references edoshatch360_users (id) on delete set null,
  add column if not exists administered_name text,
  add column if not exists supervisor_name   text,
  add column if not exists manufacturer      text,
  add column if not exists batch_no          text,
  add column if not exists expiry_date       date,
  add column if not exists reaction_notes    text;

comment on column edoshatch360_vaccinations.administered_name is
  'Free-text name for whoever gave the dose when they are not a system user — a visiting vet or a casual worker.';
comment on column edoshatch360_vaccinations.batch_no is
  'Vial batch/serial number. Recorded so a bad batch can be traced back across flocks.';

-- --------------------------------------------------------- flock codes --

/**
 * Batch code from the farm and the bird type: RUI-BRO-001.
 *
 * The prefix makes a code readable on its own — anyone seeing RUI-BRO-003
 * knows it is the third broiler batch at Ruiru without opening anything. The
 * sequence is per tenant and per prefix, allocated under an advisory lock so
 * two people adding a flock at once cannot mint the same code.
 */
create or replace function edoshatch360_next_flock_code(
  p_tenant    uuid,
  p_farm      uuid,
  p_bird_type edoshatch360_bird_type
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_name text;
  v_farm_code text;
  v_type_code text;
  v_prefix    text;
  v_seq       integer;
begin
  if p_tenant not in (select edoshatch360_writable_tenant_ids()) then
    raise exception 'edoshatch360: not permitted for this organisation';
  end if;

  select name into v_farm_name from edoshatch360_farms
  where id = p_farm and tenant_id = p_tenant;

  if v_farm_name is null then
    raise exception 'edoshatch360: that farm does not belong to this organisation';
  end if;

  -- Letters only, so "Ruiru main farm" and "Farm #2" both reduce cleanly.
  v_farm_code := upper(substring(regexp_replace(v_farm_name, '[^a-zA-Z]', '', 'g') from 1 for 3));
  if coalesce(v_farm_code, '') = '' then v_farm_code := 'FRM'; end if;

  v_type_code := case p_bird_type
    when 'broiler'           then 'BRO'
    when 'layer'             then 'LAY'
    when 'kienyeji'          then 'KIE'
    when 'improved_kienyeji' then 'IKI'
    when 'breeder'           then 'BRE'
    when 'chick'             then 'CHK'
    when 'pullet'            then 'PUL'
    when 'turkey'            then 'TUR'
    else 'OTH' end;

  v_prefix := v_farm_code || '-' || v_type_code;

  perform pg_advisory_xact_lock(hashtext(p_tenant::text || v_prefix));

  select coalesce(max(substring(code from '[0-9]+$')::integer), 0) + 1
  into v_seq
  from edoshatch360_flocks
  where tenant_id = p_tenant
    and code like v_prefix || '-%';

  return v_prefix || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

revoke all on function edoshatch360_next_flock_code(uuid, uuid, edoshatch360_bird_type) from public;
revoke all on function edoshatch360_next_flock_code(uuid, uuid, edoshatch360_bird_type) from anon;
grant execute on function edoshatch360_next_flock_code(uuid, uuid, edoshatch360_bird_type) to authenticated;

/** The prefix alone, so the form can preview a code before anything is saved. */
create or replace function edoshatch360_flock_code_prefix(
  p_farm_name text,
  p_bird_type edoshatch360_bird_type
)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(upper(substring(regexp_replace(p_farm_name, '[^a-zA-Z]', '', 'g') from 1 for 3)), ''),
    'FRM'
  ) || '-' || case p_bird_type
    when 'broiler'           then 'BRO'
    when 'layer'             then 'LAY'
    when 'kienyeji'          then 'KIE'
    when 'improved_kienyeji' then 'IKI'
    when 'breeder'           then 'BRE'
    when 'chick'             then 'CHK'
    when 'pullet'            then 'PUL'
    when 'turkey'            then 'TUR'
    else 'OTH' end;
$$;

revoke all on function edoshatch360_flock_code_prefix(text, edoshatch360_bird_type) from public;
grant execute on function edoshatch360_flock_code_prefix(text, edoshatch360_bird_type) to authenticated;
