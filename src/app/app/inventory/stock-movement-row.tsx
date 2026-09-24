"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, TriangleAlert } from "lucide-react";

import { deleteStockMovement, type StockFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { formatMoney, formatNumber, relativeDay } from "@/lib/utils";
import type { InventoryTxn } from "@/lib/database.types";

const initial: StockFormState = { error: null, ok: null };

const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Opening balance",
  purchase: "Bought",
  usage: "Used",
  adjustment: "Correction",
  wastage: "Spoiled",
  transfer: "Transferred",
};

export function StockMovementRow({
  movement: m,
  itemName,
  itemUnit,
  currency,
  canManage,
}: {
  movement: InventoryTxn;
  itemName: string;
  itemUnit: string;
  currency: string;
  canManage: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const inward = Number(m.quantity) > 0;

  return (
    <li className="px-4 py-2.5 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{itemName}</p>
          <p className="text-xs text-ink-faint">
            {MOVEMENT_LABEL[m.txn_type] ?? m.txn_type} · {relativeDay(m.occurred_on)}
            {m.reference ? ` · ${m.reference}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className={`text-sm font-semibold tnum ${inward ? "text-good" : "text-critical"}`}>
              {inward ? "+" : ""}
              {formatNumber(Number(m.quantity), { decimals: 1 })}{" "}
              <span className="font-normal text-ink-faint">{itemUnit}</span>
            </p>
            {m.total_cents > 0 && (
              <p className="text-xs text-ink-faint tnum">{formatMoney(m.total_cents, { currency })}</p>
            )}
          </div>
          {canManage && !confirming && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Delete this movement for ${itemName}`}
              className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {confirming && <DeleteForm m={m} onCancel={() => setConfirming(false)} />}
    </li>
  );
}

function DeleteForm({ m, onCancel }: { m: InventoryTxn; onCancel: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteStockMovement, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="mt-2 flex gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5">
      <input type="hidden" name="id" value={m.id} />
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete this movement?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          The item&rsquo;s stock on hand is recalculated from what remains.
          {m.expense_id && (
            <>
              {" "}
              This purchase also recorded an expense in Finance — it is removed along with the
              movement, not left behind.
            </>
          )}
        </p>
        <div className="mt-2">
          <TextInput label="Why is this being deleted?" name="reason" required placeholder="e.g. duplicate entry" autoFocus />
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
