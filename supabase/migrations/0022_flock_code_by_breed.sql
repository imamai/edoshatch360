-- Batch numbers gain the breed: RUI-LAY-KEN-001.
--
-- Farm, bird type, breed, then the sequence. The bird type says what the
-- birds are for and the breed says which birds they are — a farm running two
-- houses of layers has a Lohmann batch and a Kenbro batch, and RUI-LAY-001
-- alone cannot tell them apart.
--
-- Breed is optional on the form, so its segment is simply absent when none
-- was chosen. That leaves RUI-LAY-001, which is exactly the shape codes had
-- before this migration.
--
-- Existing codes are left as they are. A code is an identifier that has been
-- written on houses, records and documents; rewriting history would break
-- every reference to it. Numbering carries on rather than restarting: an
-- unbreeded batch matches the same pattern its predecessors did, and a
-- breeded one starts a sequence of its own at 001.

create or replace function public.edoshatch360_next_flock_code(
  p_tenant    uuid,
  p_farm      uuid,
  p_bird_type edoshatch360_bird_type,
  p_breed     text
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_farm_name  text;
  v_farm_code  text;
  v_type_code  text;
  v_breed_code text;
  v_prefix     text;
  v_seq        integer;
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

  -- The breed, by the same rule as the farm. "Rainbow Rooster" becomes RAI.
  v_breed_code := upper(substring(regexp_replace(coalesce(p_breed, ''), '[^a-zA-Z]', '', 'g') from 1 for 3));

  v_prefix := v_farm_code || '-' || v_type_code;
  if coalesce(v_breed_code, '') <> '' then
    v_prefix := v_prefix || '-' || v_breed_code;
  end if;

  -- Held for the length of the transaction so two people placing a flock at
  -- the same moment cannot be handed the same number.
  perform pg_advisory_xact_lock(hashtext(p_tenant::text || v_prefix));

  -- Anchored on the whole code rather than a LIKE prefix: without the anchor,
  -- a breedless RUI-LAY would also match RUI-LAY-KEN-007 and take its number.
  -- Farm, type and breed codes are letters only, so nothing in the prefix
  -- needs escaping here.
  select coalesce(max(substring(code from '[0-9]+$')::integer), 0) + 1
  into v_seq
  from edoshatch360_flocks
  where tenant_id = p_tenant
    and code ~ ('^' || v_prefix || '-[0-9]+$');

  return v_prefix || '-' || lpad(v_seq::text, 3, '0');
end;
$function$;

-- The three-argument form is kept as a wrapper rather than dropped: it is the
-- signature every deployed copy of the app called until now, and a rollback
-- that lands before the new code does must still be able to place a flock.
create or replace function public.edoshatch360_next_flock_code(
  p_tenant    uuid,
  p_farm      uuid,
  p_bird_type edoshatch360_bird_type
)
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select public.edoshatch360_next_flock_code(p_tenant, p_farm, p_bird_type, null::text);
$function$;

revoke all on function public.edoshatch360_next_flock_code(uuid, uuid, edoshatch360_bird_type, text) from public;
grant execute on function public.edoshatch360_next_flock_code(uuid, uuid, edoshatch360_bird_type, text) to authenticated;
