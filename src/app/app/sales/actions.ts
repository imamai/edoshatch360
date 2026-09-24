"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_SEE_MONEY, CAN_WRITE, can, requireSession } from "@/lib/data/session";
import type { Role } from "@/lib/database.types";
import { logAudit } from "@/lib/audit";
import { today } from "@/lib/utils";
import type { Customer, CustomerType, DocType, PayMethod } from "@/lib/database.types";

export interface SaleFormState {
  error: string | null;
  ok: string | null;
}

export interface CartLine {
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

/**
 * Creates a sale document with its lines in one go.
 *
 * Totals are NOT sent from the browser: the header is written with zeros and
 * the database trigger sums the lines back into it. A tampered form cannot
 * produce an invoice whose total disagrees with what is on it.
 */
export async function createSale(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const docType = String(form.get("doc_type") ?? "receipt") as DocType;
  const customerId = String(form.get("customer_id") ?? "") || null;
  const saleDate = String(form.get("sale_date") ?? today());
  const paymentMethod = (String(form.get("payment_method") ?? "") || null) as PayMethod | null;
  const amountPaid = Number(form.get("amount_paid") ?? 0);

  let lines: CartLine[] = [];
  try {
    lines = JSON.parse(String(form.get("lines") ?? "[]")) as CartLine[];
  } catch {
    return { error: "Something went wrong reading the items. Try again.", ok: null };
  }

  const valid = lines.filter(
    (l) => l.description.trim() && l.quantity > 0 && l.unitPrice >= 0,
  );
  if (valid.length === 0) {
    return { error: "Add at least one item with a quantity and a price.", ok: null };
  }

  const { data: docNumber, error: numberError } = await supabase.rpc(
    "edoshatch360_next_doc_number",
    { p_tenant: session.tenant.id, p_type: docType },
  );

  if (numberError || !docNumber) {
    return { error: "We couldn't allocate a document number. Try again.", ok: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sale, error } = await supabase
    .from("edoshatch360_sales")
    .insert({
      tenant_id: session.tenant.id,
      farm_id: session.farms[0]?.id ?? null,
      customer_id: customerId,
      doc_type: docType,
      doc_number: docNumber as string,
      sale_date: saleDate,
      due_date: String(form.get("due_date") ?? "") || null,
      payment_method: paymentMethod,
      status: docType === "quotation" ? "sent" : "draft",
      notes: String(form.get("notes") ?? "").trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !sale) {
    return { error: "We couldn't save that sale. Try again.", ok: null };
  }

  const { error: lineError } = await supabase.from("edoshatch360_sale_items").insert(
    valid.map((l, i) => ({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      product_id: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price_cents: Math.round(l.unitPrice * 100),
      discount_cents: Math.round(Math.max(0, l.discount) * 100),
      line_total_cents: Math.round(
        l.quantity * l.unitPrice * 100 - Math.max(0, l.discount) * 100,
      ),
      sort_order: i,
    })),
  );

  if (lineError) {
    // Roll back the orphaned header rather than leave an empty invoice behind.
    await supabase.from("edoshatch360_sales").delete().eq("id", sale.id);
    return { error: "We couldn't save the items on that sale. Try again.", ok: null };
  }

  if (amountPaid > 0 && docType !== "quotation") {
    await supabase.from("edoshatch360_customer_payments").insert({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      amount_cents: Math.round(amountPaid * 100),
      method: paymentMethod ?? "cash",
      reference: String(form.get("payment_reference") ?? "").trim() || null,
      received_by: user?.id ?? null,
    });
  }

  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  revalidatePath("/app");
  redirect(`/app/sales/${sale.id}`);
}

export async function recordPayment(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const saleId = String(form.get("sale_id") ?? "");
  const amount = Number(form.get("amount") ?? 0);

  if (!saleId) return { error: "Which sale is this against?", ok: null };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount above zero.", ok: null };
  }

  const { data: sale } = await supabase
    .from("edoshatch360_sales")
    .select("balance_cents, doc_number")
    .eq("id", saleId)
    .maybeSingle();

  if (!sale) return { error: "That sale could not be found.", ok: null };

  const cents = Math.round(amount * 100);
  if (cents > sale.balance_cents) {
    return {
      error: `That is more than the outstanding balance on ${sale.doc_number}. The balance is ${(sale.balance_cents / 100).toLocaleString()}.`,
      ok: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("edoshatch360_customer_payments").insert({
    tenant_id: session.tenant.id,
    sale_id: saleId,
    amount_cents: cents,
    method: (String(form.get("method") ?? "cash") || "cash") as PayMethod,
    reference: String(form.get("reference") ?? "").trim() || null,
    received_by: user?.id ?? null,
  });

  if (error) return { error: "We couldn't record that payment. Try again.", ok: null };

  revalidatePath(`/app/sales/${saleId}`);
  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  return { error: null, ok: "Payment recorded." };
}

/**
 * Payments touch money owed directly, so correcting one needs both write
 * access and the ability to see the books at all — a worker or supervisor
 * who can enter a sale still cannot rewrite what a customer has paid.
 */
function canManageMoney(role: Role): boolean {
  return can(role, CAN_WRITE) && can(role, CAN_SEE_MONEY);
}

/**
 * Correct a payment entered wrong — the wrong amount, method or reference.
 *
 * The sale's totals and status are never touched here directly:
 * edoshatch360_custpay_rollup recomputes them from every payment on the sale
 * the moment this row changes, the same trigger that fires for
 * recordPayment's insert.
 *
 * Two things a money-handling correction needs that a plain field edit does
 * not: a reason, so "the amount changed" always comes with why, not just
 * what it changed to; and a record of it, because the row itself only ever
 * shows the current amount — without edoshatch360_audit_logs there would be
 * no trace that it was ever anything else.
 */
export async function updatePayment(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot change payments.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const amount = Number(form.get("amount") ?? 0);
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That payment could not be found.", ok: null };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount above zero.", ok: null };
  }
  if (!reason) return { error: "Say why this payment is being changed.", ok: null };

  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("edoshatch360_customer_payments")
    .select("sale_id, amount_cents, method, reference")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!payment) return { error: "That payment could not be found.", ok: null };

  const { data: sale } = await supabase
    .from("edoshatch360_sales")
    .select("total_cents, amount_paid_cents, doc_number")
    .eq("id", payment.sale_id)
    .maybeSingle();
  if (!sale) return { error: "That sale could not be found.", ok: null };

  const cents = Math.round(amount * 100);
  // Room for THIS payment is the total minus everything else already paid —
  // not the current balance, which already has this payment's old amount
  // baked in and would let it grow without bound.
  const paidByOthers = sale.amount_paid_cents - payment.amount_cents;
  const room = sale.total_cents - paidByOthers;
  if (cents > room) {
    return {
      error: `That is more than ${sale.doc_number} comes to. The most this payment can be is ${(room / 100).toLocaleString()}.`,
      ok: null,
    };
  }

  const method = (String(form.get("method") ?? "cash") || "cash") as PayMethod;
  const reference = String(form.get("reference") ?? "").trim() || null;

  const { error } = await supabase
    .from("edoshatch360_customer_payments")
    .update({ amount_cents: cents, method, reference })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "payment.updated",
    entityType: "customer_payment",
    entityId: id,
    reason,
    before: { amount_cents: payment.amount_cents, method: payment.method, reference: payment.reference },
    after: { amount_cents: cents, method, reference, sale_id: payment.sale_id, doc_number: sale.doc_number },
  });

  revalidatePath(`/app/sales/${payment.sale_id}`);
  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  return { error: null, ok: "Payment updated." };
}

/** Remove a payment entered against the wrong sale, or twice by mistake. */
export async function deletePayment(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot delete payments.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That payment could not be found.", ok: null };
  if (!reason) return { error: "Say why this payment is being deleted.", ok: null };

  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("edoshatch360_customer_payments")
    .select("sale_id, amount_cents, method, reference, paid_at")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!payment) return { error: "That payment could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_customer_payments")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that payment. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "payment.deleted",
    entityType: "customer_payment",
    entityId: id,
    reason,
    before: payment,
  });

  revalidatePath(`/app/sales/${payment.sale_id}`);
  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  return { error: null, ok: "Payment deleted." };
}

/**
 * The details of a sale that never affect money — who it's for, when it was
 * raised, when it's due, how it was meant to be paid, what the notes say.
 * Always correctable, even on a settled document: fixing a customer's name
 * or a mistyped date does not change what anyone owes.
 */
export async function updateSaleDetails(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot change sale details.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  if (!id) return { error: "That document could not be found.", ok: null };

  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("edoshatch360_sales")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!sale) return { error: "That document could not be found.", ok: null };
  if (sale.status === "cancelled") {
    return { error: "This document is voided and cannot be changed.", ok: null };
  }

  const { error } = await supabase
    .from("edoshatch360_sales")
    .update({
      customer_id: String(form.get("customer_id") ?? "") || null,
      sale_date: String(form.get("sale_date") ?? today()),
      due_date: String(form.get("due_date") ?? "") || null,
      payment_method: (String(form.get("payment_method") ?? "") || null) as PayMethod | null,
      notes: String(form.get("notes") ?? "").trim() || null,
    })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save those changes. Try again.", ok: null };

  revalidatePath(`/app/sales/${id}`);
  revalidatePath("/app/sales");
  return { error: null, ok: "Details updated." };
}

/**
 * Replace a sale's line items outright — the actual correction for "wrong
 * item, wrong quantity, wrong price" rather than a workaround.
 *
 * Restricted to a document nothing has been paid against yet: the moment a
 * payment exists it was accepted against a specific total, and rewriting the
 * items out from under it would leave that amount meaning something
 * different than it did when it was received. Voiding is the correction
 * once a document has reached that point.
 */
export async function updateSaleItems(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot change sale items.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  if (!id) return { error: "That document could not be found.", ok: null };

  let lines: CartLine[] = [];
  try {
    lines = JSON.parse(String(form.get("lines") ?? "[]")) as CartLine[];
  } catch {
    return { error: "Something went wrong reading the items. Try again.", ok: null };
  }
  const valid = lines.filter(
    (l) => l.description.trim() && l.quantity > 0 && l.unitPrice >= 0,
  );
  if (valid.length === 0) {
    return { error: "Keep at least one item with a quantity and a price.", ok: null };
  }

  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("edoshatch360_sales")
    .select("doc_number, status, amount_paid_cents")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!sale) return { error: "That document could not be found.", ok: null };
  if (sale.status === "cancelled") {
    return { error: "This document is voided and cannot be changed.", ok: null };
  }
  if (sale.amount_paid_cents > 0) {
    return {
      error: "A payment has already been recorded against this document, so its items are locked. Void it and raise a new one instead.",
      ok: null,
    };
  }

  const { data: before } = await supabase
    .from("edoshatch360_sale_items")
    .select("description, quantity, unit_price_cents, discount_cents")
    .eq("sale_id", id);

  const { error: deleteError } = await supabase
    .from("edoshatch360_sale_items")
    .delete()
    .eq("sale_id", id)
    .eq("tenant_id", session.tenant.id);
  if (deleteError) return { error: "We couldn't save those items. Try again.", ok: null };

  const { error: insertError } = await supabase.from("edoshatch360_sale_items").insert(
    valid.map((l, i) => ({
      tenant_id: session.tenant.id,
      sale_id: id,
      product_id: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price_cents: Math.round(l.unitPrice * 100),
      discount_cents: Math.round(Math.max(0, l.discount) * 100),
      line_total_cents: Math.round(
        l.quantity * l.unitPrice * 100 - Math.max(0, l.discount) * 100,
      ),
      sort_order: i,
    })),
  );
  if (insertError) return { error: "We couldn't save those items. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "sale.items_updated",
    entityType: "sale",
    entityId: id,
    before: { doc_number: sale.doc_number, items: before ?? [] },
    after: { items: valid },
  });

  revalidatePath(`/app/sales/${id}`);
  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  return { error: null, ok: "Items updated." };
}

/**
 * Voiding, not deleting, is the normal way back from a mistaken sale once
 * anything has happened against it. The document and its number stay on
 * record — the reason it was voided is folded into its notes, since there is
 * nowhere else on this record to keep it — and edoshatch360_resum_sale
 * settles it out of every "owed to you" figure the moment its status flips.
 */
export async function voidSale(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot void a sale.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That document could not be found.", ok: null };
  if (!reason) return { error: "Say why this is being voided.", ok: null };

  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("edoshatch360_sales")
    .select("doc_number, status, notes")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!sale) return { error: "That document could not be found.", ok: null };
  if (sale.status === "cancelled") return { error: "This document is already voided.", ok: null };

  const notes = sale.notes ? `${sale.notes}\n\nVoided: ${reason}` : `Voided: ${reason}`;

  const { error } = await supabase
    .from("edoshatch360_sales")
    .update({ status: "cancelled", notes })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't void that document. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "sale.voided",
    entityType: "sale",
    entityId: id,
    reason,
    before: { status: sale.status, doc_number: sale.doc_number },
    after: { status: "cancelled" },
  });

  revalidatePath(`/app/sales/${id}`);
  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  revalidatePath("/app");
  return { error: null, ok: `${sale.doc_number} voided.` };
}

/**
 * A real delete, for a document that should never have existed at all — a
 * duplicate, a test, something raised against the wrong customer and caught
 * before any money moved. Blocked the moment a payment exists; void is the
 * correction from there, so a receipt of money is never the thing that
 * disappears.
 */
export async function deleteSale(id: string): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot delete a sale.", ok: null };
  }

  const supabase = await createClient();

  const [{ data: sale }, { data: items }] = await Promise.all([
    supabase
      .from("edoshatch360_sales")
      .select("doc_number, doc_type, sale_date, customer_id, amount_paid_cents")
      .eq("id", id)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle(),
    supabase
      .from("edoshatch360_sale_items")
      .select("description, quantity, unit_price_cents")
      .eq("sale_id", id),
  ]);
  if (!sale) return { error: "That document could not be found.", ok: null };
  if (sale.amount_paid_cents > 0) {
    return {
      error: "A payment has already been recorded against this document. Void it instead of deleting it.",
      ok: null,
    };
  }

  const { error } = await supabase
    .from("edoshatch360_sales")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that document. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "sale.deleted",
    entityType: "sale",
    entityId: id,
    before: { ...sale, items: items ?? [] },
  });

  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  revalidatePath("/app");
  return { error: null, ok: `${sale.doc_number} deleted.` };
}

export async function createCustomer(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "What is the customer called?", ok: null };

  const { error } = await supabase.from("edoshatch360_customers").insert({
    tenant_id: session.tenant.id,
    name,
    phone: String(form.get("phone") ?? "").trim() || null,
    email: String(form.get("email") ?? "").trim() || null,
    location: String(form.get("location") ?? "").trim() || null,
    customer_type: (String(form.get("customer_type") ?? "individual") ||
      "individual") as CustomerType,
    credit_limit_cents: Math.round(Number(form.get("credit_limit") ?? 0) * 100),
    notes: String(form.get("notes") ?? "").trim() || null,
  });

  if (error) return { error: "We couldn't save that customer. Try again.", ok: null };

  revalidatePath("/app/customers");
  revalidatePath("/app/sales");
  return { error: null, ok: `${name} added.` };
}

/** Correct a customer's details — a wrong phone number, a renamed business. */
export async function updateCustomer(
  _prev: SaleFormState,
  form: FormData,
): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot change customers.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!id) return { error: "That customer could not be found.", ok: null };
  if (!name) return { error: "What is the customer called?", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_customers")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That customer could not be found.", ok: null };

  const after = {
    name,
    phone: String(form.get("phone") ?? "").trim() || null,
    email: String(form.get("email") ?? "").trim() || null,
    location: String(form.get("location") ?? "").trim() || null,
    customer_type: (String(form.get("customer_type") ?? "individual") ||
      "individual") as CustomerType,
    credit_limit_cents: Math.round(Number(form.get("credit_limit") ?? 0) * 100),
    notes: String(form.get("notes") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_customers")
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
    action: "customer.updated",
    entityType: "customer",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/customers");
  revalidatePath("/app/sales");
  return { error: null, ok: `${name} updated.` };
}

/** Take a customer out of the picker without losing what they have bought. */
export async function setCustomerActive(id: string, active: boolean): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot change customers.", ok: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edoshatch360_customers")
    .update({ is_active: active })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .select("name")
    .maybeSingle();

  if (error || !data) return { error: "We couldn't change that customer. Try again.", ok: null };

  revalidatePath("/app/customers");
  revalidatePath("/app/sales");
  return {
    error: null,
    ok: active ? `${data.name} is back in the customer list.` : `${data.name} archived.`,
  };
}

/**
 * Delete a customer outright.
 *
 * Blocked the moment they have a single sale on record: edoshatch360_sales
 * only ever stores customer_id, never a name or phone captured at the time —
 * unlike a deleted product, whose past lines keep their own description and
 * price, deleting a customer with sales would leave those documents with no
 * trace of who they were for at all. Archiving is the only option from
 * there; a customer who has never bought anything can be removed cleanly.
 */
export async function deleteCustomer(id: string): Promise<SaleFormState> {
  const session = await requireSession();
  if (!canManageMoney(session.role)) {
    return { error: "Your account cannot delete customers.", ok: null };
  }

  const supabase = await createClient();

  const [{ data: customer }, { count: saleCount }] = await Promise.all([
    supabase
      .from("edoshatch360_customers")
      .select("name")
      .eq("id", id)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle(),
    supabase
      .from("edoshatch360_sales")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id),
  ]);

  if (!customer) return { error: "That customer could not be found.", ok: null };
  if ((saleCount ?? 0) > 0) {
    return {
      error: `${customer.name} has ${saleCount} document${saleCount === 1 ? "" : "s"} on record. Deleting would leave them with no customer at all — archive instead.`,
      ok: null,
    };
  }

  const { error } = await supabase
    .from("edoshatch360_customers")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that customer. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "customer.deleted",
    entityType: "customer",
    entityId: id,
    before: customer,
  });

  revalidatePath("/app/customers");
  return { error: null, ok: `${customer.name} deleted.` };
}

/* ------------------------------------------------------------- counter -- */

export interface CounterLine {
  productId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
}

export interface IssueSaleInput {
  docType: DocType;
  customerId: string | null;
  dueDate: string | null;
  paymentMethod: PayMethod | null;
  amountPaidCents: number;
  paymentReference: string | null;
  notes: string | null;
  /** A discount on the whole sale, on top of any discount on a line. */
  discountCents: number;
  /**
   * VAT added on top of the subtotal. Zero for a farm that is not registered,
   * and zero when its prices already include VAT — in that case the tax is
   * inside the line prices and adding it here would charge it twice.
   */
  taxCents: number;
  lines: CounterLine[];
}

export interface IssueSaleResult {
  error: string | null;
  saleId?: string;
  docNumber?: string;
}

/**
 * The Counter's version of createSale: it returns the new document instead of
 * redirecting to it, so the till can show the issued receipt in place and take
 * the next customer without a page load.
 *
 * Amounts arrive already in cents. The Counter works in integers throughout —
 * a till that rounds is a till that loses money.
 *
 * The document number is allocated HERE and not when the screen opens, so an
 * abandoned cart never burns a number out of a tax-invoice sequence.
 */
export async function issueSale(input: IssueSaleInput): Promise<IssueSaleResult> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account can view sales but not record them." };
  }

  const lines = input.lines.filter(
    (l) => l.description.trim() && l.quantity > 0 && l.unitPriceCents >= 0,
  );
  if (lines.length === 0) {
    return { error: "Add at least one item before completing the sale." };
  }

  const supabase = await createClient();

  const { data: docNumber, error: numberError } = await supabase.rpc(
    "edoshatch360_next_doc_number",
    { p_tenant: session.tenant.id, p_type: input.docType },
  );
  if (numberError || !docNumber) {
    return { error: "We couldn't allocate a document number. Try again." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sale, error } = await supabase
    .from("edoshatch360_sales")
    .insert({
      tenant_id: session.tenant.id,
      farm_id: session.farms[0]?.id ?? null,
      customer_id: input.customerId,
      doc_type: input.docType,
      doc_number: docNumber as string,
      sale_date: today(),
      due_date: input.dueDate,
      // edoshatch360_resum_sale recomputes the total as
      // subtotal - discount_cents + tax_cents, so both of these are honoured
      // the moment the line items land.
      discount_cents: Math.max(0, Math.round(input.discountCents)),
      tax_cents: Math.max(0, Math.round(input.taxCents)),
      payment_method: input.paymentMethod,
      status: input.docType === "quotation" ? "sent" : "draft",
      notes: input.notes?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select("id, doc_number")
    .single();

  if (error || !sale) {
    return { error: "We couldn't save that sale. Try again." };
  }

  const { error: lineError } = await supabase.from("edoshatch360_sale_items").insert(
    lines.map((l, i) => ({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      product_id: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price_cents: l.unitPriceCents,
      discount_cents: Math.max(0, l.discountCents),
      line_total_cents: Math.max(
        0,
        Math.round(l.quantity * l.unitPriceCents) - Math.max(0, l.discountCents),
      ),
      sort_order: i,
    })),
  );

  if (lineError) {
    // Roll back the orphaned header rather than leave an empty invoice behind.
    await supabase.from("edoshatch360_sales").delete().eq("id", sale.id);
    return { error: "We couldn't save the items on that sale. Try again." };
  }

  if (input.amountPaidCents > 0 && input.docType !== "quotation") {
    await supabase.from("edoshatch360_customer_payments").insert({
      tenant_id: session.tenant.id,
      sale_id: sale.id,
      amount_cents: input.amountPaidCents,
      method: input.paymentMethod ?? "cash",
      reference: input.paymentReference?.trim() || null,
      received_by: user?.id ?? null,
    });
  }

  revalidatePath("/app/sales");
  revalidatePath("/app/finance");
  revalidatePath("/app");

  return { error: null, saleId: sale.id, docNumber: sale.doc_number as string };
}

/**
 * Add a customer from the till, without leaving the sale.
 *
 * Deliberately narrower than createCustomer: a name and a phone number are
 * what somebody standing at a counter actually knows, and everything else on
 * the customer record has a sensible default. The full form on /app/customers
 * remains the place to fill in the rest.
 *
 * Returns the new row so the Counter can select it immediately — the reason
 * this exists rather than reusing the form action, which returns only a
 * message.
 */
export async function quickAddCustomer(input: {
  name: string;
  phone: string | null;
}): Promise<{ error: string | null; customer?: Customer }> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "This account cannot add customers." };
  }

  const name = input.name.trim();
  if (!name) return { error: "What is the customer called?" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edoshatch360_customers")
    .insert({
      tenant_id: session.tenant.id,
      name,
      phone: input.phone?.trim() || null,
      customer_type: "individual" as CustomerType,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "We couldn't save that customer. Try again." };
  }

  revalidatePath("/app/customers");
  return { error: null, customer: data as Customer };
}
