"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";

import {
  deleteInventoryItem, setInventoryItemActive, updateInventoryItem, type StockFormState,
} from "@/app/app/inventory/actions";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { InventoryCategory } from "@/lib/database.types";
import type { StockRow } from "./stock-table";

const initial: StockFormState = { error: null, ok: null };

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "vaccine", label: "Vaccine" },
  { value: "medication", label: "Medication" },
  { value: "equipment", label: "Equipment" },
  { value: "packaging", label: "Packaging" },
  { value: "cleaning", label: "Cleaning supplies" },
  { value: "spare_parts", label: "Spare parts" },
  { value: "other", label: "Other" },
];

function Feedback({ state }: { state: StockFormState }) {
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

function daysLeft(row: StockRow): number | null {
  if (row.dailyUse <= 0) return null;
  return Math.floor(row.current_stock / row.dailyUse);
}

function statusFor(row: StockRow): { tone: Tone; label: string } {
  if (row.current_stock <= 0) return { tone: "critical", label: "Out of stock" };
  if (row.reorder_level > 0 && row.current_stock <= row.reorder_level) {
    return { tone: "attention", label: "Reorder soon" };
  }
  const left = daysLeft(row);
  if (left !== null && left <= 3) return { tone: "attention", label: `${left} days left` };
  return { tone: "good", label: "In stock" };
}

export function StockItemRow({
  row,
  currency,
  canManage,
}: {
  row: StockRow;
  currency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const status = statusFor(row);
  const left = daysLeft(row);
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [pending, start] = useTransition();
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function toggleActive() {
    start(async () => {
      const result = await setInventoryItemActive(row.id, !row.is_active);
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
            <span className="block font-medium text-ink">{row.name}</span>
            {!row.is_active && <Badge tone="neutral">Archived</Badge>}
          </span>
          <span className="block text-xs text-ink-faint capitalize">
            {row.category.replace(/_/g, " ")}
            {row.supplier ? ` · ${row.supplier}` : ""}
          </span>
        </td>
        <td className="px-3 py-3 text-right tnum">
          {formatNumber(row.current_stock, { decimals: 1 })} <span className="text-ink-faint">{row.unit}</span>
        </td>
        <td className="px-3 py-3 text-right text-ink-soft tnum">
          {row.dailyUse > 0 ? formatNumber(row.dailyUse, { decimals: 1 }) : "—"}
        </td>
        <td className={`px-3 py-3 text-right font-medium tnum ${left !== null && left <= 3 ? "text-critical" : "text-ink"}`}>
          {left !== null ? left : "—"}
        </td>
        <td className="px-3 py-3 text-right text-ink-soft tnum">
          {formatMoney(Math.round(row.current_stock * row.unit_cost_cents), { currency })}
        </td>
        <td className="px-4 py-3 text-right sm:px-5">
          <div className="flex items-center justify-end gap-2">
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {canManage && mode === "view" && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setMode("edit")}
                  aria-label={`Edit ${row.name}`}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={toggleActive}
                  aria-label={row.is_active ? `Archive ${row.name}` : `Restore ${row.name}`}
                  title={row.is_active ? "Take off the list, keep its history" : "Put back on the list"}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-attention"
                >
                  {row.is_active ? <X className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("delete")}
                  aria-label={`Delete ${row.name}`}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {archiveError && <p className="mt-1 text-xs text-critical">{archiveError}</p>}
        </td>
      </tr>

      {mode === "edit" && (
        <tr>
          <td colSpan={6} className="bg-surface-sunk px-4 py-4 sm:px-5">
            <EditForm row={row} onDone={() => setMode("view")} />
          </td>
        </tr>
      )}
      {mode === "delete" && (
        <tr>
          <td colSpan={6} className="bg-critical-soft px-4 py-3 sm:px-5">
            <DeleteConfirm row={row} onCancel={() => setMode("view")} />
          </td>
        </tr>
      )}
    </>
  );
}

function EditForm({ row, onDone }: { row: StockRow; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateInventoryItem, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={row.id} />
      <TextInput label="Name" name="name" required defaultValue={row.name} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput label="Category" name="category" defaultValue={row.category}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectInput>
        <TextInput label="Unit" name="unit" defaultValue={row.unit} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <NumberInput
          label="Warn me below"
          name="reorder_level"
          decimals
          min={0}
          defaultValue={row.reorder_level}
          hint="0 turns the alert off"
        />
        <NumberInput
          label="Cost per unit"
          name="unit_cost"
          unit="KES"
          decimals
          min={0}
          defaultValue={row.unit_cost_cents / 100}
          hint="Applies from now on — past movements keep their own cost."
        />
      </div>

      <TextInput label="Supplier" name="supplier" defaultValue={row.supplier ?? ""} hint="Optional" />

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

function DeleteConfirm({ row, onCancel }: { row: StockRow; onCancel: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteInventoryItem(row.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete {row.name} permanently?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          Every movement recorded against an item is deleted along with it. This is only safe for
          an item with nothing recorded yet — anything with history is refused, with{" "}
          <strong>archiving</strong> offered instead.
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
