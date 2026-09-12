import { Badge, type Tone } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { InventoryItem } from "@/lib/database.types";

export interface StockRow extends InventoryItem {
  /** Average daily consumption over the recent window, in stock units. */
  dailyUse: number;
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

/**
 * Stock levels with a days-remaining figure derived from the farm's own
 * consumption rate rather than a guess — "6.9 days" is actionable in a way
 * that "1,240 kg" alone is not.
 */
export function StockTable({ rows, currency }: { rows: StockRow[]; currency: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-faint">
            <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Item</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">In stock</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Daily use</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Days left</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">Value</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const status = statusFor(row);
            const left = daysLeft(row);
            return (
              <tr key={row.id} className="hover:bg-surface-sunk">
                <td className="px-4 py-3 sm:px-5">
                  <span className="block font-medium text-ink">{row.name}</span>
                  <span className="block text-xs text-ink-faint capitalize">
                    {row.category.replace(/_/g, " ")}
                    {row.supplier ? ` · ${row.supplier}` : ""}
                  </span>
                </td>
                <td className="px-3 py-3 text-right tnum">
                  {formatNumber(row.current_stock, { decimals: 1 })}{" "}
                  <span className="text-ink-faint">{row.unit}</span>
                </td>
                <td className="px-3 py-3 text-right text-ink-soft tnum">
                  {row.dailyUse > 0 ? formatNumber(row.dailyUse, { decimals: 1 }) : "—"}
                </td>
                <td
                  className={`px-3 py-3 text-right font-medium tnum ${
                    left !== null && left <= 3 ? "text-critical" : "text-ink"
                  }`}
                >
                  {left !== null ? left : "—"}
                </td>
                <td className="px-3 py-3 text-right text-ink-soft tnum">
                  {formatMoney(Math.round(row.current_stock * row.unit_cost_cents), { currency })}
                </td>
                <td className="px-4 py-3 text-right sm:px-5">
                  <Badge tone={status.tone} dot>
                    {status.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
