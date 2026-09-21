import type { Metadata } from "next";
import { AlertTriangle, Package, TrendingDown, Wheat } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { getStock } from "@/lib/data/stock";
import { getFlocks } from "@/lib/data/flocks";
import { daySeries, getDashboardData } from "@/lib/data/dashboard";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StockTable } from "@/components/app/stock-table";
import { FeedChart } from "@/components/charts/trend-charts";
import { MovementForm } from "../inventory/stock-forms";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const session = await requireSession();

  const [{ rows, items }, flocks, dashboard] = await Promise.all([
    getStock(session.tenant.id, ["feed"]),
    getFlocks(session.tenant.id),
    getDashboardData(session.tenant.id),
  ]);

  const series = daySeries(dashboard, 30);
  const currency = session.tenant.currency;

  const totalValue = rows.reduce(
    (a, r) => a + Math.round(r.current_stock * r.unit_cost_cents),
    0,
  );
  const lowCount = rows.filter(
    (r) => r.current_stock <= 0 || (r.reorder_level > 0 && r.current_stock <= r.reorder_level),
  ).length;
  const fed7 = series.slice(-7).reduce((a, d) => a + d.kg, 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Feed</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Usually the largest single cost on a poultry farm — so it gets its own screen.
          </p>
        </div>
        {/* Adding a new feed item happens on Inventory, not here — one
            entry point for the same stock ledger, so the same bag of feed
            can't be added twice under two names from two screens. */}
        <ButtonLink href="/app/inventory" variant="secondary" size="sm">
          Add a feed item
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Feed types tracked"
          value={rows.length}
          icon={<Package className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <StatCard
          label="Fed in last 7 days"
          value={formatNumber(fed7, { decimals: 1 })}
          unit="kg"
          icon={<Wheat className="h-4.5 w-4.5" />}
          tone="attention"
        />
        <StatCard
          label="Stock value"
          value={formatMoney(totalValue, { currency, compact: true })}
          icon={<TrendingDown className="h-4.5 w-4.5" />}
          tone="info"
        />
        <StatCard
          label="Needs reordering"
          value={lowCount}
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
          tone={lowCount > 0 ? "critical" : "good"}
        />
      </div>

      <Card>
        <CardHeader
          title="Feed consumption"
          subtitle="Last 30 days, all flocks"
          icon={<Wheat className="h-4 w-4" />}
        />
        <CardBody>
          <FeedChart data={series} height={220} />
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Card>
          <CardHeader
            title="Feed in stock"
            subtitle="Days left uses your own consumption rate"
            icon={<Package className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            {rows.length === 0 ? (
              <EmptyState
                icon={<Wheat className="h-6 w-6" />}
                title="No feed on record"
                description="Add the feed you buy and Hatch360 tracks what is left, how fast it is going, and when to reorder."
              />
            ) : (
              <StockTable rows={rows} currency={currency} />
            )}
          </CardBody>
        </Card>

        <MovementForm items={items} flocks={flocks} />
      </div>
    </div>
  );
}
