-- The vaccine, egg trays and disinfectant were given reorder levels but no
-- opening stock, so the demo farm read as "everything has run out". Give them
-- realistic balances, leaving one item genuinely low so the reorder alert
-- still has something true to show.

do $$
declare
  v_tenant uuid;
  v_item   record;
begin
  select id into v_tenant from edoshatch360_tenants where slug = 'sunrise-poultry-demo';
  if v_tenant is null then return; end if;

  for v_item in
    select i.id, i.name, i.unit, i.unit_cost_cents, i.category
    from edoshatch360_inventory i
    where i.tenant_id = v_tenant
      and i.category <> 'feed'
      and not exists (
        select 1 from edoshatch360_inventory_transactions t where t.item_id = i.id
      )
  loop
    declare
      v_qty numeric := case v_item.category
        when 'vaccine'   then 8      -- vials
        when 'packaging' then 900    -- trays
        when 'cleaning'  then 4      -- litres, deliberately below reorder
        else 10 end;
    begin
      insert into edoshatch360_inventory_transactions
        (tenant_id, item_id, txn_type, quantity, unit_cost_cents, total_cents, occurred_on, reference)
      values (
        v_tenant, v_item.id, 'opening', v_qty, v_item.unit_cost_cents,
        (v_qty * v_item.unit_cost_cents)::bigint, current_date - 45, 'Opening balance'
      );

      -- Some of it has been used since, so the ledger is not a flat line.
      if v_item.category in ('vaccine', 'packaging') then
        insert into edoshatch360_inventory_transactions
          (tenant_id, item_id, txn_type, quantity, unit_cost_cents, total_cents, occurred_on, reference)
        values (
          v_tenant, v_item.id, 'usage', -round(v_qty * 0.35, 2), v_item.unit_cost_cents,
          (round(v_qty * 0.35, 2) * v_item.unit_cost_cents)::bigint,
          current_date - 6, 'Used on the farm'
        );
      end if;
    end;
  end loop;
end $$;
