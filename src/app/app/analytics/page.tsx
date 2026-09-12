import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3, Bird, Coins, Egg, PieChart, Scale, Skull, TrendingUp, Wheat,
} from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import {
  computeKpis, daySeries, expenseBreakdown, flockComparison, flockComposition,
  getDashboardData, moneySeries,
} from "@/lib/data/dashboard";
import { BIRD_TYPE_LABEL } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  BreakdownDonut, ComparisonBars, EggTrendChart, FeedChart, MortalityChart,
  RevenueExpenseChart,
} from "@/components/charts/trend-charts";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { FlockMetrics } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await requireSession();
  // Hidden in the navigation, but a URL still resolves — so the page
  // itself has to know what the plan carries.
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("benchmarking")) {
    return <UpgradeNotice what="Analytics" from={featureFrom("benchmarking")} />;
  }
  const params = await searchParams;
  const range = RANGES.find((r) => String(r.days) === params.range)?.days ?? 30;

  const data = await getDashboardData(session.tenant.id);
  const kpis = computeKpis(data);
  const series = daySeries(data, range);
  const money = moneySeries(data, 6);
  const expenses = expenseBreakdown(data);
  const byFlock = flockComparison(data, range);
  const composition = flockComposition(data);
  const showMoney = can(session.role, CAN_SEE_MONEY);
  const currency = session.tenant.currency;

  // Per-flock performance from the shared Postgres metrics function, so
  // benchmarking cannot drift from what each flock's own page reports.
  const supabase = await createClient();
  const flockMetrics = await Promise.all(
    data.flocks.map(async (f) => {
      const { data: m } = await supabase.rpc("edoshatch360_flock_metrics", { p_flock: f.id });
      return { flock: f, metrics: m as FlockMetrics | null };
    }),
  );

  const totalEggs = series.reduce((a, d) => a + d.eggs, 0);
  const totalDeaths = series.reduce((a, d) => a + d.deaths, 0);
  const totalFeed = series.reduce((a, d) => a + d.kg, 0);

  // Feed per egg is the cleanest single efficiency number a layer farm has.
  const feedPerEgg = totalEggs > 0 ? (totalFeed * 1000) / totalEggs : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            The trends behind the daily numbers, and how your flocks compare.
          </p>
        </div>

        <div className="flex rounded-lg border border-line-strong p-0.5">
          {RANGES.map((r) => (
            <Link
              key={r.days}
              href={`/app/analytics?range=${r.days}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range === r.days ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Eggs (${range} days)`}
          value={formatNumber(totalEggs, { compact: true })}
          icon={<Egg className="h-4.5 w-4.5" />}
          tone="good"
        />
        <StatCard
          label={`Birds lost (${range} days)`}
          value={formatNumber(totalDeaths)}
          icon={<Skull className="h-4.5 w-4.5" />}
          tone={totalDeaths > 0 ? "attention" : "good"}
          higherIsBetter={false}
        />
        <StatCard
          label={`Feed (${range} days)`}
          value={formatNumber(totalFeed, { decimals: 0 })}
          unit="kg"
          icon={<Wheat className="h-4.5 w-4.5" />}
          tone="attention"
        />
        <StatCard
          label="Feed per egg"
          value={feedPerEgg !== null ? formatNumber(feedPerEgg, { decimals: 0 }) : "—"}
          unit={feedPerEgg !== null ? "g" : undefined}
          hint="Grams of feed per egg collected"
          icon={<Scale className="h-4.5 w-4.5" />}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader
          title="Egg production"
          subtitle={`Last ${range} days`}
          icon={<Egg className="h-4 w-4" />}
        />
        <CardBody>
          <EggTrendChart data={series} height={260} />
        </CardBody>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Mortality"
            subtitle={`Last ${range} days — spikes highlighted`}
            icon={<Skull className="h-4 w-4" />}
          />
          <CardBody>
            <MortalityChart data={series} height={200} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Feed consumption"
            subtitle={`Last ${range} days`}
            icon={<Wheat className="h-4 w-4" />}
          />
          <CardBody>
            <FeedChart data={series} height={200} />
          </CardBody>
        </Card>
      </div>

      {showMoney && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader
              title="Revenue against expenses"
              subtitle="Last 6 months"
              icon={<Coins className="h-4 w-4" />}
            />
            <CardBody>
              <RevenueExpenseChart data={money} currency={currency} height={240} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Cost breakdown"
              subtitle="This month"
              icon={<PieChart className="h-4 w-4" />}
            />
            <CardBody>
              <BreakdownDonut data={expenses} currency={currency} height={240} />
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Eggs by flock"
            subtitle={`Last ${range} days`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <CardBody>
            <ComparisonBars data={byFlock} unitLabel="eggs" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Flock composition"
            subtitle="Live birds now"
            icon={<Bird className="h-4 w-4" />}
          />
          <CardBody>
            <BreakdownDonut data={composition} unitLabel="birds" />
          </CardBody>
        </Card>
      </div>

      {/* -------------------------------------------------- benchmarking -- */}
      <Card>
        <CardHeader
          title="Flock performance"
          subtitle="Measured against the standard for each bird type"
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-faint">
                  <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Flock</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Age</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Birds</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Mortality</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Lay rate</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">FCR</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Records</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {flockMetrics.map(({ flock, metrics }) => (
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
                    <td className="px-3 py-3 text-right text-ink-soft tnum">
                      {metrics?.age_days ?? 0}d
                    </td>
                    <td className="px-3 py-3 text-right tnum">
                      {formatNumber(flock.current_count)}
                    </td>
                    <td className="px-3 py-3 text-right tnum">
                      <span
                        className={
                          (metrics?.mortality_pct ?? 0) > 5 ? "text-critical" : "text-ink"
                        }
                      >
                        {formatPercent(metrics?.mortality_pct ?? 0)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tnum">
                      {metrics?.lay_pct !== null && metrics?.lay_pct !== undefined
                        ? formatPercent(metrics.lay_pct)
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tnum">
                      {metrics?.fcr ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Badge
                        tone={
                          (metrics?.recording_rate ?? 0) >= 80
                            ? "good"
                            : (metrics?.recording_rate ?? 0) >= 50
                              ? "attention"
                              : "critical"
                        }
                      >
                        {metrics?.recording_rate ?? 0}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-faint sm:px-5">
            Benchmarks used: 5% cumulative mortality, 85% hen-day production, 1.8 feed
            conversion. A dash means there is not enough recorded data to calculate that
            figure yet — {formatPercent(kpis.mortalityPct)} is the mortality across all
            active flocks.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
