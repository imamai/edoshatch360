import type { Metadata } from "next";
import { AlertTriangle, ArrowDownUp, Boxes, Coins } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { getStock } from "@/lib/data/stock";
import { getFlocks } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { StockTable } from "@/components/app/stock-table";
import { StockMovementRow } from "./stock-movement-row";
import { BreakdownDonut } from "@/components/charts/trend-charts";
import { MovementForm, NewItemForm } from "./stock-forms";
import { formatMoney, formatNumber } from "@/lib/utils";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const session = await requireSession();
  // Hidden in the navigation, but a URL still resolves — so the page
  // itself has to know what the plan carries.
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("inventory")) {
    return <UpgradeNotice what="Inventory" from={featureFrom("inventory")} />;
  }

  const canManage = can(session.role, CAN_WRITE);
  const [{ rows, items, movements }, flocks] = await Promise.all([
    getStock(session.tenant.id, undefined, true),
    getFlocks(session.tenant.id),
  ]);

  const currency = session.tenant.currency;
  const itemName = new Map(items.map((i) => [i.id, i]));
  // Archived items ride along in `rows` so the table can still show and
  // restore them; every other figure on this page describes the farm's
  // active stock, so they are left out of those.
  const activeRows = rows.filter((r) => r.is_active);

  const totalValue = activeRows.reduce(
    (a, r) => a + Math.round(r.current_stock * r.unit_cost_cents),
    0,
  );
  const lowCount = activeRows.filter(
    (r) => r.current_stock <= 0 || (r.reorder_level > 0 && r.current_stock <= r.reorder_level),
  ).length;

  const byCategory = [...
    activeRows.reduce((map, r) => {
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
          value={activeRows.length}
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
                <StockTable rows={rows} currency={currency} canManage={canManage} />
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
                  {movements.slice(0, 25).map((m) => (
                    <StockMovementRow
                      key={m.id}
                      movement={m}
                      itemName={itemName.get(m.item_id)?.name ?? "Item"}
                      itemUnit={itemName.get(m.item_id)?.unit ?? ""}
                      currency={currency}
                      canManage={canManage}
                    />
                  ))}
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
                  {activeRows
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
