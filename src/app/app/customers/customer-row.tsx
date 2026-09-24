"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, Pencil, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";

import {
  deleteCustomer, setCustomerActive, updateCustomer, type SaleFormState,
} from "../sales/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";
import type { Customer, CustomerType } from "@/lib/database.types";

const initial: SaleFormState = { error: null, ok: null };

const TYPES: { value: CustomerType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "retailer", label: "Retailer / shop" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "school", label: "School / institution" },
  { value: "distributor", label: "Distributor" },
  { value: "other", label: "Other" },
];

function Feedback({ state }: { state: SaleFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="mt-2 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-xs text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="mt-2 text-xs text-good">{state.ok}</p>;
  return null;
}

export function CustomerRow({
  customer: c,
  currency,
  orders,
  spent,
  owed,
  over,
  canManage,
}: {
  customer: Customer;
  currency: string;
  orders: number;
  spent: number;
  owed: number;
  over: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [pending, start] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function toggleActive() {
    start(async () => {
      const result = await setCustomerActive(c.id, !c.is_active);
      if (result.error) setArchiveError(result.error);
      else {
        setArchiveError(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <tr className="hover:bg-surface-sunk">
        <td className="px-4 py-3 sm:px-5">
          <span className="flex items-center gap-2">
            <span className="block font-medium text-ink">{c.name}</span>
            {!c.is_active && <Badge tone="neutral">Archived</Badge>}
          </span>
          {c.phone && (
            <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-brand">
              <Phone className="h-3 w-3" />
              {c.phone}
            </a>
          )}
        </td>
        <td className="px-3 py-3">
          <Badge tone="neutral">{c.customer_type.replace(/_/g, " ")}</Badge>
        </td>
        <td className="px-3 py-3 text-right text-ink-soft tnum">{orders}</td>
        <td className="px-3 py-3 text-right font-medium tnum">{formatMoney(spent, { currency })}</td>
        <td className="px-4 py-3 text-right sm:px-5">
          {owed > 0 ? (
            <span className={`font-medium tnum ${over ? "text-critical" : "text-attention"}`}>
              {formatMoney(owed, { currency })}
              {over && <span className="ml-1 text-[0.6875rem]">over limit</span>}
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </td>
        {canManage && (
          <td className="px-3 py-3 text-right">
            <div className="inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMode(mode === "edit" ? "view" : "edit")}
                aria-label={`Edit ${c.name}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={toggleActive}
                aria-label={c.is_active ? `Archive ${c.name}` : `Restore ${c.name}`}
                title={c.is_active ? "Take out of the picker, keep their history" : "Put back in the picker"}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-attention"
              >
                {c.is_active ? <X className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMode(mode === "delete" ? "view" : "delete")}
                aria-label={`Delete ${c.name}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {archiveError && <p className="mt-1 text-xs text-critical">{archiveError}</p>}
          </td>
        )}
      </tr>

      {mode === "edit" && (
        <tr>
          <td colSpan={canManage ? 6 : 5} className="bg-surface-sunk px-4 py-4 sm:px-5">
            <EditForm customer={c} onDone={() => setMode("view")} />
          </td>
        </tr>
      )}
      {mode === "delete" && (
        <tr>
          <td colSpan={canManage ? 6 : 5} className="bg-critical-soft px-4 py-3 sm:px-5">
            <DeleteConfirm customer={c} orders={orders} onCancel={() => setMode("view")} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditForm({ customer: c, onDone }: { customer: Customer; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateCustomer, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={c.id} />
      <TextInput label="Name" name="name" required defaultValue={c.name} />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Phone" name="phone" type="tel" defaultValue={c.phone ?? ""} />
        <SelectInput label="What kind of customer?" name="customer_type" defaultValue={c.customer_type}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectInput>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Location" name="location" defaultValue={c.location ?? ""} hint="Optional" />
        <TextInput label="Email" name="email" type="email" defaultValue={c.email ?? ""} hint="Optional" />
      </div>

      <NumberInput
        label="Credit limit"
        name="credit_limit"
        unit="KES"
        decimals
        min={0}
        defaultValue={c.credit_limit_cents / 100}
        hint="The most you are willing to let them owe. 0 means cash only."
      />

      <TextArea label="Notes" name="notes" rows={2} defaultValue={c.notes ?? ""} />

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

function DeleteConfirm({
  customer: c,
  orders,
  onCancel,
}: {
  customer: Customer;
  orders: number;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteCustomer(c.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete {c.name} permanently?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          {orders > 0 ? (
            <>
              {c.name} has {orders} document{orders === 1 ? "" : "s"} on record. Sales only keep a
              link to this customer, not their name — deleting would leave those documents with no
              customer at all. <strong>Archiving instead</strong> takes them out of the picker and
              keeps everything intact.
            </>
          ) : (
            <>They have never bought anything, so nothing else refers to them.</>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-xs text-critical">
            {error}
          </p>
        )}
        <div className="mt-2.5 flex gap-2">
          <Button variant="danger" size="sm" busy={pending} onClick={remove}>
            Delete for good
          </Button>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}
