"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";
import { today } from "@/lib/utils";
import type { ExpenseCategory, InventoryCategory, StockTxn } from "@/lib/database.types";

/** Which expense bucket a purchase of each stock category belongs in. */
const EXPENSE_FOR: Record<InventoryCategory, ExpenseCategory> = {
  feed: "feed",
  vaccine: "vaccines",
  medication: "medication",
  equipment: "equipment",
  packaging: "other",
  cleaning: "other",
  spare_parts: "repairs",
  other: "other",
};

export interface StockFormState {
  error: string | null;
  ok: string | null;
}

export async function createInventoryItem(
  _prev: StockFormState,
  form: FormData,
): Promise<StockFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "feed") as InventoryCategory;
  const unit = String(form.get("unit") ?? "kg").trim() || "kg";
  const reorder = Number(form.get("reorder_level") ?? 0);
  const opening = Number(form.get("opening_stock") ?? 0);
  const unitCost = Number(form.get("unit_cost") ?? 0);

  if (!name) return { error: "Give the item a name.", ok: null };

  const { data: item, error } = await supabase
    .from("edoshatch360_inventory")
    .insert({
      tenant_id: session.tenant.id,
      farm_id: session.farms[0]?.id ?? null,
      category,
      name,
      unit,
      reorder_level: Math.max(0, reorder),
      unit_cost_cents: Math.round(Math.max(0, unitCost) * 100),
      supplier: String(form.get("supplier") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error) return { error: "We couldn't save that item. Try again.", ok: null };

  // Opening stock is a transaction, not a typed-in balance — that way
  // current_stock always equals the sum of its movements.
  if (opening > 0) {
    await supabase.from("edoshatch360_inventory_transactions").insert({
      tenant_id: session.tenant.id,
      item_id: item.id,
      txn_type: "opening",
      quantity: opening,
      unit_cost_cents: Math.round(Math.max(0, unitCost) * 100),
      total_cents: Math.round(opening * Math.max(0, unitCost) * 100),
      occurred_on: today(),
      notes: "Opening balance",
    });
  }

  revalidatePath("/app/inventory");
  revalidatePath("/app/feed");
  return { error: null, ok: `${name} added.` };
}

export async function recordStockMovement(
  _prev: StockFormState,
  form: FormData,
): Promise<StockFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const itemId = String(form.get("item_id") ?? "");
  const type = String(form.get("txn_type") ?? "purchase") as StockTxn;
  const rawQty = Number(form.get("quantity") ?? 0);
  const unitCost = Number(form.get("unit_cost") ?? 0);

  if (!itemId) return { error: "Choose an item.", ok: null };
  if (!Number.isFinite(rawQty) || rawQty <= 0) {
    return { error: "How much? Enter a quantity above zero.", ok: null };
  }

  const { data: item } = await supabase
    .from("edoshatch360_inventory")
    .select("id, name, unit, current_stock, category")
    .eq("id", itemId)
    .maybeSingle();

  if (!item) return { error: "That item could not be found.", ok: null };

  // Usage and wastage reduce stock, so they are stored negative. The sign is
  // applied here rather than trusted from the form.
  const outward = type === "usage" || type === "wastage";
  const quantity = outward ? -Math.abs(rawQty) : Math.abs(rawQty);

  if (outward && Math.abs(quantity) > item.current_stock) {
    return {
      error: `You only have ${item.current_stock} ${item.unit} of ${item.name} on record. Record a purchase first, or adjust the stock.`,
      ok: null,
    };
  }

  const { error } = await supabase.from("edoshatch360_inventory_transactions").insert({
    tenant_id: session.tenant.id,
    item_id: itemId,
    txn_type: type,
    quantity,
    unit_cost_cents: Math.round(Math.max(0, unitCost) * 100),
    total_cents: Math.round(Math.abs(quantity) * Math.max(0, unitCost) * 100),
    reference: String(form.get("reference") ?? "").trim() || null,
    flock_id: String(form.get("flock_id") ?? "") || null,
    occurred_on: String(form.get("occurred_on") ?? today()),
    notes: String(form.get("notes") ?? "").trim() || null,
  });

  if (error) return { error: "We couldn't record that movement. Try again.", ok: null };

  // A purchase is money out — mirror it into expenses so the finance figures
  // include feed bought, without the farmer entering it twice.
  //
  // RLS refuses this insert for operational roles (worker, supervisor, vet),
  // which is intended: they can record that stock was bought without the
  // purchase price entering the books under their name. The stock movement
  // itself has already been saved, so the failure is ignored rather than
  // surfaced as an error the person can do nothing about.
  if (type === "purchase" && unitCost > 0) {
    await supabase.from("edoshatch360_expenses").insert({
      tenant_id: session.tenant.id,
      farm_id: session.farms[0]?.id ?? null,
      category: EXPENSE_FOR[item.category as InventoryCategory] ?? "other",
      description: `${item.name} — ${Math.abs(quantity)} ${item.unit}`,
      amount_cents: Math.round(Math.abs(quantity) * unitCost * 100),
      expense_date: String(form.get("occurred_on") ?? today()),
      vendor: String(form.get("reference") ?? "").trim() || null,
    });
    revalidatePath("/app/finance");
  }

  revalidatePath("/app/inventory");
  revalidatePath("/app/feed");
  revalidatePath("/app");
  return { error: null, ok: "Recorded." };
}
