"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";
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

  // Feed and Inventory both add stock through this same form (Feed pre-fills
  // the category and Inventory leaves it open), so the same item can be
  // reached from either screen with no way to see it was already added from
  // the other. The same name in the same category is treated as the item
  // that already exists, not a second copy of it — otherwise the same feed
  // silently splits across two rows with two separate stock counts.
  const { data: existing } = await supabase
    .from("edoshatch360_inventory")
    .select("id, name, unit, current_stock")
    .eq("tenant_id", session.tenant.id)
    .eq("category", category)
    .ilike("name", name)
    .maybeSingle();

  if (existing) {
    if (opening > 0) {
      await supabase.from("edoshatch360_inventory_transactions").insert({
        tenant_id: session.tenant.id,
        item_id: existing.id,
        txn_type: "adjustment",
        quantity: opening,
        unit_cost_cents: Math.round(Math.max(0, unitCost) * 100),
        total_cents: Math.round(opening * Math.max(0, unitCost) * 100),
        occurred_on: today(),
        notes: "Added from the stock item form",
      });
    }
    revalidatePath("/app/inventory");
    revalidatePath("/app/feed");
    return {
      error: null,
      ok: opening > 0
        ? `${existing.name} was already tracked — added ${opening} ${existing.unit} to its stock instead of creating a duplicate.`
        : `${existing.name} is already tracked — nothing new to add.`,
    };
  }

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

/** Correct an item's details — name, category, unit, reorder level, cost. */
export async function updateInventoryItem(
  _prev: StockFormState,
  form: FormData,
): Promise<StockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!id) return { error: "That item could not be found.", ok: null };
  if (!name) return { error: "Give the item a name.", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_inventory")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That item could not be found.", ok: null };

  const after = {
    name,
    category: String(form.get("category") ?? before.category) as InventoryCategory,
    unit: String(form.get("unit") ?? "").trim() || "kg",
    reorder_level: Math.max(0, Number(form.get("reorder_level") ?? 0)),
    unit_cost_cents: Math.round(Math.max(0, Number(form.get("unit_cost") ?? 0)) * 100),
    supplier: String(form.get("supplier") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_inventory")
    .update(after)
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  // A cost change applies from now on — past movements keep the unit cost
  // they were recorded at, the same way a product's past sale lines do.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "inventory_item.updated",
    entityType: "inventory_item",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/feed");
  return { error: null, ok: `${name} updated.` };
}

/** Take an item off the stock list without losing its movement history. */
export async function setInventoryItemActive(id: string, active: boolean): Promise<StockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edoshatch360_inventory")
    .update({ is_active: active })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .select("name")
    .maybeSingle();

  if (error || !data) return { error: "We couldn't change that item. Try again.", ok: null };

  revalidatePath("/app/inventory");
  revalidatePath("/app/feed");
  return {
    error: null,
    ok: active ? `${data.name} is back in the stock list.` : `${data.name} archived.`,
  };
}

/**
 * Delete a stock item outright.
 *
 * Blocked the moment it has a single movement recorded:
 * edoshatch360_inventory_transactions.item_id cascades on delete, so
 * removing the item would silently erase every purchase, use and correction
 * ever logged against it — the whole ledger the reorder and cost figures
 * are built from. Archiving is the only option from there; an item added by
 * mistake with nothing recorded against it can be removed cleanly.
 */
export async function deleteInventoryItem(id: string): Promise<StockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const supabase = await createClient();

  const [{ data: item }, { count: txnCount }] = await Promise.all([
    supabase
      .from("edoshatch360_inventory")
      .select("name")
      .eq("id", id)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle(),
    supabase
      .from("edoshatch360_inventory_transactions")
      .select("id", { count: "exact", head: true })
      .eq("item_id", id),
  ]);

  if (!item) return { error: "That item could not be found.", ok: null };
  if ((txnCount ?? 0) > 0) {
    return {
      error: `${item.name} has ${txnCount} movement${txnCount === 1 ? "" : "s"} recorded against it. Deleting would erase that history — archive it instead.`,
      ok: null,
    };
  }

  const { error } = await supabase
    .from("edoshatch360_inventory")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that item. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "inventory_item.deleted",
    entityType: "inventory_item",
    entityId: id,
    before: item,
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/feed");
  return { error: null, ok: `${item.name} deleted.` };
}

/**
 * Remove a stock movement entered wrong — a duplicate, the wrong item, a
 * quantity mistyped. edoshatch360_restock_item does a full recompute of the
 * item's current_stock from every remaining movement, so this can never
 * leave the stock count skewed by whatever the deleted row used to hold.
 *
 * A purchase also records a matching expense when it is entered, with no
 * link back between the two rows — deleting the movement here does not
 * remove that expense. The confirmation says so; removing it from Finance,
 * if it was wrong too, is a separate step.
 */
export async function deleteStockMovement(
  _prev: StockFormState,
  form: FormData,
): Promise<StockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That movement could not be found.", ok: null };
  if (!reason) return { error: "Say why this is being deleted.", ok: null };

  const supabase = await createClient();

  const { data: record } = await supabase
    .from("edoshatch360_inventory_transactions")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!record) return { error: "That movement could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_inventory_transactions")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that movement. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "inventory_transaction.deleted",
    entityType: "inventory_transaction",
    entityId: id,
    reason,
    before: record,
  });

  revalidatePath("/app/inventory");
  revalidatePath("/app/feed");
  revalidatePath("/app");
  return { error: null, ok: "Movement deleted." };
}
