import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, Bird, CheckCircle2, Circle, ClipboardList, Coins, Egg,
  HeartPulse, Layers, Percent, Skull, TrendingUp, Wheat,
} from "lucide-react";

import { requireSession, CAN_SEE_MONEY, CAN_WRITE, can } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import {
  computeAlerts, computeKpis, daySeries, expenseBreakdown, flockComparison,
  flockComposition, getDashboardData, moneySeries,
} from "@/lib/data/dashboard";
import type { FarmHealth } from "@/lib/database.types";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertList } from "@/components/app/alert-list";
import { HealthDial } from "@/components/app/health-dial";
import { OpenDemoButton } from "@/components/app/open-demo-button";
import { ReadOnlyBadge } from "@/components/app/read-only-notice";
import {
  BreakdownDonut, ComparisonBars, EggTrendChart, FeedChart, MortalityChart,
  RevenueExpenseChart,
} from "@/components/charts/trend-charts";
import { formatMoney, formatNumber, formatPercent, relativeDay } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await requireSession();
  const data = await getDashboardData(session.tenant.id);
  const kpis = computeKpis(data);
  const alerts = computeAlerts(data);
  const days = daySeries(data, 14);
  const money = moneySeries(data, 6);
  const expenses = expenseBreakdown(data);
  const byFlock = flockComparison(data, 7);
  const composition = flockComposition(data);

  const showMoney = can(session.role, CAN_SEE_MONEY);
  const canWrite = can(session.role, CAN_WRITE);
  const currency = session.tenant.currency;

  // Farm Health Score for the farm that matters most — the one carrying the
  // most birds, not simply the first alphabetically. On a multi-farm account
  // the rest are compared side by side on /app/farms.
  const supabase = await createClient();
  const birdsPerFarm = new Map<string, number>();
  for (const flock of data.flocks) {
    birdsPerFarm.set(
      flock.farm_id,
      (birdsPerFarm.get(flock.farm_id) ?? 0) + flock.current_count,
    );
  }
  const primaryFarm =
    [...data.farms].sort(
      (a, b) => (birdsPerFarm.get(b.id) ?? 0) - (birdsPerFarm.get(a.id) ?? 0),
    )[0] ?? data.farms[0];
  let health: FarmHealth | null = null;
  if (primaryFarm) {
    const { data: h } = await supabase.rpc("edoshatch360_farm_health", {
      p_farm: primaryFarm.id,
    });
    health = h as FarmHealth | null;
  }

  /* ------------------------------------------------------- empty farm -- */

  if (data.flocks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Welcome to {session.tenant.name}
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Three short steps and this dashboard starts telling you something.
        </p>

        <Card className="mt-6">
          <CardBody>
            <ol className="flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-good" />
                <div>
                  <p className="text-sm font-semibold text-ink">Your farm is created</p>
                  <p className="text-xs text-ink-soft">
                    {primaryFarm?.name ?? session.tenant.name}
                    {primaryFarm?.county ? ` · ${primaryFarm.county}` : ""}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">Add your first flock</p>
                  <p className="text-xs text-ink-soft">
                    How many birds you placed, what type and when. Takes about a minute.
                  </p>
                  <ButtonLink href="/app/flocks/new" size="sm" className="mt-2.5">
                    Add a flock
                    <ArrowRight className="h-3.5 w-3.5" />
                  </ButtonLink>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />
                <div>
                  <p className="text-sm font-semibold text-ink">Record one day</p>
                  <p className="text-xs text-ink-soft">
                    Deaths, eggs and feed. After that, the trends here do the work.
                  </p>
                </div>
              </li>
            </ol>
          </CardBody>
        </Card>

        <EmptyState
          className="mt-4"
          icon={<Bird className="h-6 w-6" />}
          title="No birds on the system yet"
          description="Your dashboard fills in as soon as there is a flock to report on."
        />

        {/* Somewhere to look while this farm is still empty. Joining the demo
            adds it alongside this organisation rather than replacing it. */}
        {!session.tenants.some((t) => t.name.includes("(Demo)")) && (
          <Card className="mt-4">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Want to see a farm with data in it first?
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                  Open Sunrise Poultry — three flocks and ninety days of records, so you
                  can see what every screen looks like filled in. Read-only, and your own
                  farm stays exactly as it is.
                </p>
              </div>
              <OpenDemoButton />
            </CardBody>
          </Card>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- dashboard -- */

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            {session.tenant.name}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {data.farms.length} farm{data.farms.length === 1 ? "" : "s"} ·{" "}
            {kpis.activeFlocks} active flock{kpis.activeFlocks === 1 ? "" : "s"} ·{" "}
            {formatNumber(kpis.totalBirds)} birds
          </p>
        </div>

        {!canWrite ? (
          <Badge tone="neutral" dot>
            Read-only access
          </Badge>
        ) : kpis.recordedToday ? (
          <Badge tone="good" dot>
            Recorded today
          </Badge>
        ) : (
          <ButtonLink href="/app/record" size="sm">
            <ClipboardList className="h-4 w-4" />
            Record today
          </ButtonLink>
        )}
      </div>

      {!canWrite && <ReadOnlyBadge tenantName={session.tenant.name} />}

      {/* ----------------------------------------------------------- KPIs -- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total birds"
          value={formatNumber(kpis.totalBirds)}
          icon={<Bird className="h-4.5 w-4.5" />}
          tone="brand"
          href="/app/flocks"
        />
        <StatCard
          label="Active flocks"
          value={kpis.activeFlocks}
          icon={<Layers className="h-4.5 w-4.5" />}
          tone="info"
          href="/app/flocks"
        />
        <StatCard
          label="Eggs today"
          value={formatNumber(kpis.eggsToday)}
          icon={<Egg className="h-4.5 w-4.5" />}
          tone="good"
          delta={kpis.eggsDelta}
          deltaLabel="vs yesterday"
          higherIsBetter
          href="/app/production"
        />
        <StatCard
          label="Mortality to date"
          value={formatPercent(kpis.mortalityPct)}
          icon={<Skull className="h-4.5 w-4.5" />}
          tone={kpis.mortalityPct > 5 ? "critical" : "neutral"}
          hint="Across all active flocks"
          href="/app/health"
        />

        {showMoney ? (
          <>
            <StatCard
              label="Feed used (7 days)"
              value={formatNumber(kpis.feedKg7, { decimals: 1 })}
              unit="kg"
              icon={<Wheat className="h-4.5 w-4.5" />}
              tone="attention"
              href="/app/feed"
            />
            <StatCard
              label="Revenue this month"
              value={formatMoney(kpis.revenueCents, { currency, compact: true })}
              icon={<TrendingUp className="h-4.5 w-4.5" />}
              tone="good"
              href="/app/finance"
            />
            <StatCard
              label="Expenses this month"
              value={formatMoney(kpis.expensesCents, { currency, compact: true })}
              icon={<Coins className="h-4.5 w-4.5" />}
              tone="attention"
              href="/app/finance"
            />
            <StatCard
              label="Profit this month"
              value={formatMoney(kpis.profitCents, { currency, compact: true })}
              icon={<Percent className="h-4.5 w-4.5" />}
              tone={kpis.profitCents >= 0 ? "good" : "critical"}
              hint={`${formatPercent(kpis.marginPct)} margin`}
              href="/app/finance"
            />
          </>
        ) : (
          <StatCard
            label="Feed used (7 days)"
            value={formatNumber(kpis.feedKg7, { decimals: 1 })}
            unit="kg"
            icon={<Wheat className="h-4.5 w-4.5" />}
            tone="attention"
            href="/app/feed"
          />
        )}
      </div>

      {/* ------------------------------------------- production + health -- */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Egg production"
            subtitle="Last 14 days, all flocks"
            icon={<Egg className="h-4 w-4" />}
            action={
              <Link
                href="/app/production"
                className="text-xs font-semibold text-brand hover:underline"
              >
                Details →
              </Link>
            }
          />
          <CardBody>
            <EggTrendChart data={days} />
          </CardBody>
        </Card>

        {health && primaryFarm ? (
          <HealthDial
            health={health}
            farmName={primaryFarm.name}
            href={`/app/farms/${primaryFarm.id}`}
          />
        ) : (
          <Card>
            <CardBody>
              <EmptyState
                icon={<HeartPulse className="h-6 w-6" />}
                title="No health score yet"
                description="Record a few days and the score appears here."
              />
            </CardBody>
          </Card>
        )}
      </div>

      {/* -------------------------------------------- mortality and feed -- */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Birds lost"
            subtitle="Last 14 days — spikes highlighted"
            icon={<Skull className="h-4 w-4" />}
          />
          <CardBody>
            <MortalityChart data={days} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Feed consumption"
            subtitle="Last 14 days, kilograms"
            icon={<Wheat className="h-4 w-4" />}
          />
          <CardBody>
            <FeedChart data={days} />
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------- money -- */}
      {showMoney && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader
              title="Revenue against expenses"
              subtitle="Last 6 months"
              icon={<Coins className="h-4 w-4" />}
              action={
                <Link
                  href="/app/finance"
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Finance →
                </Link>
              }
            />
            <CardBody>
              <RevenueExpenseChart data={money} currency={currency} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Where the money went"
              subtitle="This month, by category"
              icon={<Percent className="h-4 w-4" />}
            />
            <CardBody>
              <BreakdownDonut data={expenses} currency={currency} />
            </CardBody>
          </Card>
        </div>
      )}

      {/* -------------------------------------------------- comparisons -- */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Eggs by flock"
            subtitle="Last 7 days"
            icon={<Egg className="h-4 w-4" />}
          />
          <CardBody>
            <ComparisonBars data={byFlock} unitLabel="eggs" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Birds by flock"
            subtitle="Live count right now"
            icon={<Bird className="h-4 w-4" />}
          />
          <CardBody>
            <BreakdownDonut data={composition} unitLabel="birds" />
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------- alerts -- */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="mb-3 font-display text-base font-bold text-ink">
            Needs your attention
          </h2>
          <AlertList alerts={alerts} />
        </div>

        <Card>
          <CardHeader
            title="Your flocks"
            subtitle="Newest first"
            icon={<Bird className="h-4 w-4" />}
            action={
              <Link href="/app/flocks" className="text-xs font-semibold text-brand hover:underline">
                All →
              </Link>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {data.flocks.slice(0, 6).map((flock) => {
                const last = data.records.find((r) => r.flock_id === flock.id);
                return (
                  <li key={flock.id}>
                    <Link
                      href={`/app/flocks/${flock.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunk sm:px-5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <Bird className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {flock.code}
                          {flock.name ? ` · ${flock.name}` : ""}
                        </span>
                        <span className="block truncate text-xs text-ink-faint capitalize">
                          {flock.bird_type.replace(/_/g, " ")} ·{" "}
                          {formatNumber(flock.current_count)} birds ·{" "}
                          {last ? relativeDay(last.record_date) : "no records"}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
