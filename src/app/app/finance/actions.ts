"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";
import { today } from "@/lib/utils";
import type { ExpenseCategory, PayMethod } from "@/lib/database.types";

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
