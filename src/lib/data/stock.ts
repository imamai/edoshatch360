import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/utils";
import type { InventoryCategory, InventoryItem, InventoryTxn } from "@/lib/database.types";
import type { StockRow } from "@/components/app/stock-table";

export interface StockData {
  rows: StockRow[];
  items: InventoryItem[];
  movements: InventoryTxn[];
}

/**
 * Stock levels plus the farm's own consumption rate.
 *
 * Daily use is measured over the last 30 days of outward movements, so the
 * "days left" figure reflects how this farm actually feeds rather than a
 * table of expected intake.
 */
export async function getStock(
  tenantId: string,
  categories?: InventoryCategory[],
  /** Archived items too, with their own badge — only the management screen wants these. */
  includeInactive = false,
): Promise<StockData> {
  const supabase = await createClient();
  const since = addDays(today(), -30);

  let itemQuery = supabase
    .from("edoshatch360_inventory")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("name");

  if (!includeInactive) itemQuery = itemQuery.eq("is_active", true);

  if (categories?.length) itemQuery = itemQuery.in("category", categories);

  const [itemRes, txnRes] = await Promise.all([
    itemQuery,
    supabase
      .from("edoshatch360_inventory_transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("occurred_on", since)
      .order("occurred_on", { ascending: false }),
  ]);

  const items = (itemRes.data ?? []) as InventoryItem[];
  const movements = (txnRes.data ?? []) as InventoryTxn[];

  const rows: StockRow[] = items.map((item) => {
    const used = movements
      .filter((m) => m.item_id === item.id && m.quantity < 0)
      .reduce((a, m) => a + Math.abs(Number(m.quantity)), 0);

    return { ...item, dailyUse: used / 30 };
  });

  return { rows, items, movements };
}