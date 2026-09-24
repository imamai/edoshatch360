"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_SEE_MONEY, CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";
import { today } from "@/lib/utils";
import type { ExpenseCategory, PayMethod, Role } from "@/lib/database.types";

export interface ExpenseFormState {
  error: string | null;
  ok: string | null;
}

export async function addExpense(
  _prev: ExpenseFormState,
  form: FormData,
): Promise<ExpenseFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const description = String(form.get("description") ?? "").trim();
  const amount = Number(form.get("amount") ?? 0);
  const category = String(form.get("category") ?? "other") as ExpenseCategory;
  const date = String(form.get("expense_date") ?? today());

  if (!description) return { error: "What was the money spent on?", ok: null };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount above zero.", ok: null };
  }
  if (date > today()) return { error: "The date cannot be in the future.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("edoshatch360_expenses").insert({
    tenant_id: session.tenant.id,
    farm_id: String(form.get("farm_id") ?? "") || session.farms[0]?.id || null,
    flock_id: String(form.get("flock_id") ?? "") || null,
    category,
    description,
    // Stored in cents; never a floating-point shilling value.
    amount_cents: Math.round(amount * 100),
    expense_date: date,
    vendor: String(form.get("vendor") ?? "").trim() || null,
    payment_method: (String(form.get("payment_method") ?? "") || null) as PayMethod | null,
    reference: String(form.get("reference") ?? "").trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "We couldn't save that expense. Try again.", ok: null };

  revalidatePath("/app/finance");
  revalidatePath("/app");
  return { error: null, ok: "Expense recorded." };
}

/** Correcting or removing an expense is money-adjacent, like a sale. */
function canManageMoney(role: Role): boolean {
  return can(role, CAN_WRITE) && can(role, CAN_SEE_MONEY);
}

/** Correct an expense entered wrong — the amount, the category, the date. */
export async function updateExpense(
  _prev: ExpenseFormState,
  form: FormData,
): Promise<ExpenseFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot change expenses.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const description = String(form.get("description") ?? "").trim();
  const amount = Number(form.get("amount") ?? 0);
  const date = String(form.get("expense_date") ?? today());
  if (!id) return { error: "That expense could not be found.", ok: null };
  if (!description) return { error: "What was the money spent on?", ok: null };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount above zero.", ok: null };
  }
  if (date > today()) return { error: "The date cannot be in the future.", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_expenses")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That expense could not be found.", ok: null };

  const after = {
    description,
    amount_cents: Math.round(amount * 100),
    category: String(form.get("category") ?? "other") as ExpenseCategory,
    expense_date: date,
    vendor: String(form.get("vendor") ?? "").trim() || null,
    payment_method: (String(form.get("payment_method") ?? "") || null) as PayMethod | null,
    reference: String(form.get("reference") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_expenses")
    .update(after)
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "expense.updated",
    entityType: "expense",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/finance");
  revalidatePath("/app");
  return { error: null, ok: "Expense updated." };
}

/** Remove an expense entered twice, or against the wrong farm entirely. */
export async function deleteExpense(
  _prev: ExpenseFormState,
  form: FormData,
): Promise<ExpenseFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot delete expenses.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That expense could not be found.", ok: null };
  if (!reason) return { error: "Say why this is being deleted.", ok: null };

  const supabase = await createClient();

  const { data: record } = await supabase
    .from("edoshatch360_expenses")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!record) return { error: "That expense could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_expenses")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that expense. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "expense.deleted",
    entityType: "expense",
    entityId: id,
    reason,
    before: record,
  });

  revalidatePath("/app/finance");
  revalidatePath("/app");
  return { error: null, ok: "Expense deleted." };
}
