"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, TriangleAlert } from "lucide-react";

import { deleteDailyRecord, type RecordFormState } from "../../record/actions";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { formatNumber } from "@/lib/utils";
import type { DailyRecord, Flock } from "@/lib/database.types";

const initial: RecordFormState = { error: null, ok: null };

/** One row of the flock's recorded-days table, with a delete of its own. */
export function DailyRecordRow({
  record: r,
  flock,
  canManage,
}: {
  record: DailyRecord;
  flock: Flock;
  canManage: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteDailyRecord, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <>
      <tr className="hover:bg-surface-sunk">
        <td className="px-4 py-2.5 sm:px-5">
          <Link
            href={`/app/record?flock=${flock.id}&date=${r.record_date}`}
            className="font-medium text-ink hover:text-brand"
          >
            {r.record_date}
          </Link>
        </td>
        <td className="px-3 py-2.5 text-right tnum">{r.mortality || "—"}</td>
        <td className="px-3 py-2.5 text-right tnum">{r.culls || "—"}</td>
        <td className="px-3 py-2.5 text-right tnum">
          {r.eggs_collected !== null ? formatNumber(r.eggs_collected) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right tnum">
          {r.feed_consumed_kg !== null ? formatNumber(Number(r.feed_consumed_kg), { decimals: 1 }) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right tnum">
          {r.avg_weight_grams !== null ? formatNumber(Number(r.avg_weight_grams)) : "—"}
        </td>
        <td className="px-4 py-2.5 text-right tnum sm:px-5">
          {r.weight_lowest_grams !== null && r.weight_highest_grams !== null
            ? `${formatNumber(Number(r.weight_lowest_grams))}–${formatNumber(Number(r.weight_highest_grams))}`
            : "—"}
        </td>
        {canManage && (
          <td className="px-3 py-2.5 text-right">
            <button
              type="button"
              onClick={() => setConfirming((v) => !v)}
              aria-label={`Delete the entry for ${r.record_date}`}
              className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </td>
        )}
      </tr>

      {confirming && (
        <tr>
          <td colSpan={canManage ? 8 : 7} className="bg-critical-soft px-4 py-3 sm:px-5">
            <form action={action} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={r.id} />
              <TriangleAlert className="mt-2 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
              <div className="min-w-[14rem] flex-1">
                <p className="text-xs leading-relaxed text-ink-soft">
                  Deletes {r.record_date} entirely. {flock.code}&rsquo;s live bird count is
                  recalculated from what remains — this cannot be undone.
                </p>
              </div>
              <div className="w-full sm:w-64">
                <TextInput
                  label="Why is this being deleted?"
                  name="reason"
                  required
                  placeholder="e.g. duplicate entry"
                />
              </div>
              {state.error && (
                <p role="alert" className="w-full text-xs text-critical">
                  {state.error}
                </p>
              )}
              <div className="flex gap-2 pb-0.5">
                <Button type="submit" variant="danger" size="sm" busy={pending}>
                  Delete
                </Button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-sm font-semibold text-ink-faint hover:text-ink"
                >
                  Keep it
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
