import type { Metadata } from "next";
import { AlertTriangle, ArrowDownUp, Boxes, Coins } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { getStock } from "@/lib/data/stock";
import { getFlocks } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { StockTable } from "@/components/app/stock-table";
import { BreakdownDonut } from "@/components/charts/trend-charts";
import { MovementForm, NewItemForm } from "./stock-forms";
import { formatMoney, formatNumber, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Inventory" };

const MOVEMENT_LABEL: Record<string, string> = {
  opening: "Opening balance",
  purchase: "Bought",
  usage: "Used",
  adjustment: "Correction",
  wastage: "Spoiled",
  transfer: "Transferred",
};

export default async function InventoryPage() {
  const session = await requireSession();

  const [{ rows, items, movements }, flocks] = await Promise.all([
    getStock(session.tenant.id),
    getFlocks(session.tenant.id),
  ]);

  const currency = session.tenant.currency;
  const itemName = new Map(items.map((i) => [i.id, i]));

  const totalValue = rows.reduce(
    (a, r) => a + Math.round(r.current_stock * r.unit_cost_cents),
    0,
  );
  const lowCount = rows.filter(
    (r) => r.current_stock <= 0 || (r.reorder_level > 0 && r.current_stock <= r.reorder_level),
  ).length;

  const byCategory = [...
    rows.reduce((map, r) => {
      const value = Math.round(r.current_stock * r.unit_cost_cents);
      const key = r.category.replace(/_/g, " ");
      map.set(key, (map.get(key) ?? 0) + value);
      return map;
    }, new Map<string, number>())
  ]
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Feed, vaccines, medication, equipment and packaging — with a ledger that
            reconciles.
          </p>
        </div>
        <NewItemForm />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Items tracked"
          value={rows.length}
          icon={<Boxes className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <StatCard
          label="Stock value"
          value={formatMoney(totalValue, { currency, compact: true })}
          icon={<Coins className="h-4.5 w-4.5" />}
          tone="info"
        />
        <StatCard
          label="Needs reordering"
          value={lowCount}
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
          tone={lowCount > 0 ? "critical" : "good"}
        />
        <StatCard
          label="Movements (30 days)"
          value={movements.length}
          icon={<ArrowDownUp className="h-4.5 w-4.5" />}
          tone="neutral"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Everything in stock"
              subtitle="Levels maintained from the movement ledger"
              icon={<Boxes className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {rows.length === 0 ? (
                <EmptyState
                  icon={<Boxes className="h-6 w-6" />}
                  title="Nothing in inventory yet"
                  description="Add what you keep on the farm — feed, vaccines, trays, spare parts — and every purchase and use builds a ledger you can check."
                />
              ) : (
                <StockTable rows={rows} currency={currency} />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recent movements"
              subtitle="Last 30 days"
              icon={<ArrowDownUp className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {movements.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-faint">
                  No stock has moved in the last 30 days.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {movements.slice(0, 25).map((m) => {
                    const item = itemName.get(m.item_id);
                    const inward = Number(m.quantity) > 0;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {item?.name ?? "Item"}
                          </p>
                          <p className="text-xs text-ink-faint">
                            {MOVEMENT_LABEL[m.txn_type] ?? m.txn_type} ·{" "}
                            {relativeDay(m.occurred_on)}
                            {m.reference ? ` · ${m.reference}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-sm font-semibold tnum ${
                              inward ? "text-good" : "text-critical"
                            }`}
                          >
                            {inward ? "+" : ""}
                            {formatNumber(Number(m.quantity), { decimals: 1 })}{" "}
                            <span className="font-normal text-ink-faint">{item?.unit}</span>
                          </p>
                          {m.total_cents > 0 && (
                            <p className="text-xs text-ink-faint tnum">
                              {formatMoney(m.total_cents, { currency })}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <MovementForm items={items} flocks={flocks} />

          {byCategory.length > 0 && (
            <Card>
              <CardHeader
                title="Value by category"
                subtitle="What your stock is worth"
                icon={<Coins className="h-4 w-4" />}
              />
              <CardBody>
                <BreakdownDonut data={byCategory} currency={currency} />
              </CardBody>
            </Card>
          )}

          {lowCount > 0 && (
            <Card>
              <CardHeader
                title="Reorder list"
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <CardBody className="p-0">
                <ul className="divide-y divide-line">
                  {rows
                    .filter(
                      (r) =>
                        r.current_stock <= 0 ||
                        (r.reorder_level > 0 && r.current_stock <= r.reorder_level),
                    )
                    .map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5"
                      >
                        <span className="min-w-0 truncate text-sm text-ink">{r.name}</span>
                        <Badge tone={r.current_stock <= 0 ? "critical" : "attention"} dot>
                          {formatNumber(r.current_stock, { decimals: 1 })} {r.unit}
                        </Badge>
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
