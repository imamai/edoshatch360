import type { Metadata } from "next";
import Link from "next/link";
import { Egg, Percent, PieChart, TrendingUp } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import {
  daySeries, flockComparison, getDashboardData,
} from "@/lib/data/dashboard";
import { BIRD_TYPE_LABEL, laysEggs } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { BreakdownDonut, ComparisonBars, EggTrendChart } from "@/components/charts/trend-charts";
import { addDays, formatNumber, formatPercent, today } from "@/lib/utils";

export const metadata: Metadata = { title: "Production" };

export default async function ProductionPage() {
  const session = await requireSession();
  const data = await getDashboardData(session.tenant.id);

  const layingFlocks = data.flocks.filter(laysEggs);
  const series = daySeries(data, 30);
  const byFlock = flockComparison(data, 7);

  const t = today();
  const weekAgo = addDays(t, -7);

  const sum = (field: "eggs_collected" | "eggs_broken" | "eggs_rejected", from?: string) =>
    data.records
      .filter((r) => (from ? r.record_date > from : true))
      .reduce((a, r) => a + (r[field] ?? 0), 0);

  const collectedToday = data.records
    .filter((r) => r.record_date === t)
    .reduce((a, r) => a + (r.eggs_collected ?? 0), 0);

  const collected7 = sum("eggs_collected", weekAgo);
  const broken7 = sum("eggs_broken", weekAgo);
  const rejected7 = sum("eggs_rejected", weekAgo);
  const saleable7 = Math.max(0, collected7 - broken7 - rejected7);

  const layingBirds = layingFlocks.reduce((a, f) => a + f.current_count, 0);
  // Hen-day production: eggs per live bird per day across the week.
  const henDay = layingBirds > 0 ? (collected7 / (layingBirds * 7)) * 100 : null;

  if (layingFlocks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Production
        </h1>
        <Card className="mt-5">
          <CardBody>
            <EmptyState
              icon={<Egg className="h-6 w-6" />}
              title="No laying flocks yet"
              description="Egg production appears here once you have layers, kienyeji, improved kienyeji or breeders on the farm."
              action={<ButtonLink href="/app/flocks/new">Add a flock</ButtonLink>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Production
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {layingFlocks.length} laying flock{layingFlocks.length === 1 ? "" : "s"} ·{" "}
          {formatNumber(layingBirds)} birds
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Eggs today"
          value={formatNumber(collectedToday)}
          icon={<Egg className="h-4.5 w-4.5" />}
          tone="good"
        />
        <StatCard
          label="Hen-day production"
          value={henDay !== null ? formatPercent(henDay) : "—"}
          hint="Last 7 days · target 85%"
          icon={<Percent className="h-4.5 w-4.5" />}
          tone={henDay !== null && henDay >= 80 ? "good" : "attention"}
        />
        <StatCard
          label="Saleable (7 days)"
          value={formatNumber(saleable7)}
          hint={`${formatNumber(broken7)} broken · ${formatNumber(rejected7)} rejected`}
          icon={<TrendingUp className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <StatCard
          label="Loss rate"
          value={collected7 > 0 ? formatPercent(((broken7 + rejected7) / collected7) * 100) : "—"}
          hint="Broken and rejected, last 7 days"
          icon={<PieChart className="h-4.5 w-4.5" />}
          tone={
            collected7 > 0 && (broken7 + rejected7) / collected7 > 0.03 ? "critical" : "neutral"
          }
          higherIsBetter={false}
        />
      </div>

      <Card>
        <CardHeader
          title="Collection trend"
          subtitle="Last 30 days, all laying flocks"
          icon={<Egg className="h-4 w-4" />}
        />
        <CardBody>
          <EggTrendChart data={series} height={260} />
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="By flock"
            subtitle="Eggs collected, last 7 days"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <CardBody>
            <ComparisonBars data={byFlock} unitLabel="eggs" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Quality split"
            subtitle="Last 7 days"
            icon={<PieChart className="h-4 w-4" />}
          />
          <CardBody>
            <BreakdownDonut
              data={[
                { name: "Saleable", value: saleable7 },
                { name: "Broken", value: broken7 },
                { name: "Rejected", value: rejected7 },
              ].filter((d) => d.value > 0)}
              unitLabel="eggs"
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Laying flocks"
          subtitle="Production over the last 7 days"
          icon={<Egg className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Flock</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Birds</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Eggs (7d)</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Hen-day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {layingFlocks.map((flock) => {
                  const eggs = data.records
                    .filter((r) => r.flock_id === flock.id && r.record_date > weekAgo)
                    .reduce((a, r) => a + (r.eggs_collected ?? 0), 0);
                  const rate =
                    flock.current_count > 0 ? (eggs / (flock.current_count * 7)) * 100 : null;

                  return (
                    <tr key={flock.id} className="hover:bg-surface-sunk">
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          href={`/app/flocks/${flock.id}`}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {flock.code}
                        </Link>
                        <span className="block text-xs text-ink-faint">
                          {BIRD_TYPE_LABEL[flock.bird_type]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tnum">
                        {formatNumber(flock.current_count)}
                      </td>
                      <td className="px-3 py-3 text-right tnum">{formatNumber(eggs)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium tnum sm:px-5 ${
                          rate !== null && rate < 60 ? "text-attention" : "text-ink"
                        }`}
                      >
                        {rate !== null ? formatPercent(rate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
