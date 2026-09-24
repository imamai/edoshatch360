"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, TriangleAlert } from "lucide-react";

import { deleteExpense, updateExpense, type ExpenseFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { formatMoney, relativeDay, today } from "@/lib/utils";
import type { Expense, ExpenseCategory } from "@/lib/database.types";

const initial: ExpenseFormState = { error: null, ok: null };

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "chicks", label: "Chicks / stock" },
  { value: "vaccines", label: "Vaccines" },
  { value: "medication", label: "Medication" },
  { value: "labour", label: "Labour" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "transport", label: "Transport" },
  { value: "repairs", label: "Repairs" },
  { value: "equipment", label: "Equipment" },
  { value: "rent", label: "Rent" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

function Feedback({ state }: { state: ExpenseFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-sm text-good">{state.ok}</p>;
  return null;
}

export function ExpenseRow({
  expense: e,
  currency,
  canManage,
}: {
  expense: Expense;
  currency: string;
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{e.description}</p>
          <p className="text-xs text-ink-faint">
            {relativeDay(e.expense_date)}
            {e.vendor ? ` · ${e.vendor}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Badge tone="neutral">{e.category.replace(/_/g, " ")}</Badge>
          <span className="text-sm font-semibold text-ink tnum">
            {formatMoney(e.amount_cents, { currency })}
          </span>
          {canManage && mode === "view" && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-label={`Edit ${e.description}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode("delete")}
                aria-label={`Delete ${e.description}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "edit" && <EditForm e={e} onDone={() => setMode("view")} />}
      {mode === "delete" && <DeleteForm e={e} onCancel={() => setMode("view")} />}
    </li>
  );
}

function EditForm({ e, onDone }: { e: Expense; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateExpense, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-surface-sunk p-3">
      <input type="hidden" name="id" value={e.id} />
      <TextInput label="What was it for?" name="description" required defaultValue={e.description} />

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput label="Amount" name="amount" unit="KES" decimals required min={0} defaultValue={e.amount_cents / 100} />
        <SelectInput label="Category" name="category" defaultValue={e.category}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectInput>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Date" name="expense_date" type="date" defaultValue={e.expense_date} max={today()} />
        <SelectInput label="Paid how?" name="payment_method" defaultValue={e.payment_method ?? "cash"}>
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
          <option value="bank">Bank</option>
          <option value="cheque">Cheque</option>
          <option value="credit">On credit</option>
          <option value="other">Other</option>
        </SelectInput>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Paid to" name="vendor" defaultValue={e.vendor ?? ""} hint="Optional" />
        <TextInput label="Reference" name="reference" defaultValue={e.reference ?? ""} hint="Optional" />
      </div>

      <Feedback state={state} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteForm({ e, onCancel }: { e: Expense; onCancel: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteExpense, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="mt-3 flex gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5">
      <input type="hidden" name="id" value={e.id} />
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete this expense?</p>
        <div className="mt-2">
          <TextInput
            label="Why is this being deleted?"
            name="reason"
            required
            placeholder="e.g. entered twice by mistake"
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
