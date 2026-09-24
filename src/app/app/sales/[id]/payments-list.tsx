"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Trash2, TriangleAlert } from "lucide-react";

import { deletePayment, updatePayment, type SaleFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { formatDate, formatMoney } from "@/lib/utils";
import type { CustomerPayment } from "@/lib/database.types";

const initial: SaleFormState = { error: null, ok: null };

/**
 * Payments received against a sale, correctable in place.
 *
 * A wrong amount or the wrong sale entirely used to be permanent — this is
 * the first place either can be fixed. The sale's total, balance and status
 * are never touched by hand here: the database recomputes all three from
 * scratch the moment a payment row changes underneath it.
 */
export function PaymentsList({
  payments,
  currency,
  canManage,
}: {
  payments: CustomerPayment[];
  currency: string;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (payments.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-ink-faint">
        Nothing received against this document yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {payments.map((p) =>
        editing === p.id ? (
          <li key={p.id} className="bg-surface-sunk px-4 py-4 sm:px-5">
            <EditForm payment={p} currency={currency} onDone={() => setEditing(null)} />
          </li>
        ) : (
          <PaymentRow
            key={p.id}
            payment={p}
            currency={currency}
            canManage={canManage}
            confirming={confirming === p.id}
            onEdit={() => setEditing(p.id)}
            onConfirm={() => setConfirming(p.id)}
            onCancelConfirm={() => setConfirming(null)}
          />
        ),
      )}
    </ul>
  );
}

function PaymentRow({
  payment,
  currency,
  canManage,
  confirming,
  onEdit,
  onConfirm,
  onCancelConfirm,
}: {
  payment: CustomerPayment;
  currency: string;
  canManage: boolean;
  confirming: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink capitalize">{payment.method}</p>
          <p className="text-xs text-ink-faint">
            {formatDate(payment.paid_at)}
            {payment.reference ? ` · ${payment.reference}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-good tnum">
            {formatMoney(payment.amount_cents, { currency })}
          </span>
          {canManage && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit this payment"
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onConfirm}
                aria-label="Delete this payment"
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <DeleteForm payment={payment} currency={currency} onCancel={onCancelConfirm} />
      )}
    </li>
  );
}

function DeleteForm({
  payment,
  currency,
  onCancel,
}: {
  payment: CustomerPayment;
  currency: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deletePayment, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="mt-3 flex gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5">
      <input type="hidden" name="id" value={payment.id} />
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete this payment?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          The balance owed on this document goes back up by{" "}
          {formatMoney(payment.amount_cents, { currency })}.
        </p>
        <div className="mt-2">
          <TextInput
            label="Why is this being deleted?"
            name="reason"
            required
            placeholder="e.g. recorded against the wrong document"
            autoFocus
          />
        </div>
        {state.error && (
          <p role="alert" className="mt-2 text-xs text-critical">
            {state.error}
          </p>
        )}
        <div className="mt-2.5 flex gap-2">
          <Button type="submit" variant="danger" size="sm" busy={pending}>
            Delete
          </Button>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
            Keep it
          </button>
        </div>
      </div>
    </form>
  );
}

function EditForm({
  payment,
  currency,
  onDone,
}: {
  payment: CustomerPayment;
  currency: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updatePayment, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    // Held a beat behind the refresh so the confirmation is seen rather than
    // flashing past — the data is already on its way.
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={payment.id} />
      <NumberInput
        label="Amount received"
        name="amount"
        unit={currency}
        decimals
        required
        min={0}
        defaultValue={payment.amount_cents / 100}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput label="How?" name="method" defaultValue={payment.method}>
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
          <option value="bank">Bank transfer</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </SelectInput>
        <TextInput
          label="Reference"
          name="reference"
          defaultValue={payment.reference ?? ""}
          placeholder="M-Pesa code"
          hint="Optional"
        />
      </div>
      <TextInput
        label="Why is this being changed?"
        name="reason"
        required
        placeholder="e.g. the amount was typed wrong"
      />

      {state.error && (
        <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="flex items-center gap-2 rounded-lg border border-good/25 bg-good-soft px-3 py-2 text-sm text-good">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {state.ok}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-semibold text-ink-faint hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
