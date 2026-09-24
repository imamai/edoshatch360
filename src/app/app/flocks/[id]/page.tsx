import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Calendar, ChevronLeft, ClipboardList, Droplets, Egg, Scale, Skull,
  Syringe, TrendingUp, Wheat,
} from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import {
  BIRD_TYPE_LABEL, FLOCK_STATUS_LABEL, flockAgeDays, getFlock, getFlockHealth,
  getFlockMetrics, getRecentRecords,
} from "@/lib/data/flocks";
import { getWeightBenchmarks } from "@/lib/data/weight-benchmarks";
import { expectedWeightAt } from "@/lib/weight-benchmark";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EggTrendChart, FeedChart, MortalityChart } from "@/components/charts/trend-charts";
import { DailyRecordRow } from "./daily-record-row";
import { addDays, formatMoney, formatNumber, formatPercent, relativeDay, today } from "@/lib/utils";

export const metadata: Metadata = { title: "Flock" };

/** Life-cycle stages, with the one the flock is currently in marked. */
function timeline(ageDays: number, birdType: string) {
  const layerLike = ["layer", "kienyeji", "improved_kienyeji", "breeder", "pullet"].includes(birdType);

  const stages = layerLike
    ? [
        { label: "Placement", at: 0 },
        { label: "Brooding", at: 1 },
        { label: "Growing", at: 43 },
        { label: "Point of lay", at: 126 },
        { label: "Laying", at: 147 },
      ]
    : [
        { label: "Placement", at: 0 },
        { label: "Brooding", at: 1 },
        { label: "Growing", at: 15 },
        { label: "Finishing", at: 29 },
        { label: "Harvest", at: 35 },
      ];

  const currentIndex = stages.reduce((acc, s, i) => (ageDays >= s.at ? i : acc), 0);
  return stages.map((s, i) => ({
    ...s,
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}

export default async function FlockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const canManage = can(session.role, CAN_WRITE);

  const flock = await getFlock(id);
  if (!flock) notFound();

  const [metrics, records, health, benchmarks] = await Promise.all([
    getFlockMetrics(id),
    getRecentRecords(id, 60),
    getFlockHealth(id),
    getWeightBenchmarks(),
  ]);

  const age = flockAgeDays(flock);
  const stages = timeline(age, flock.bird_type);
  const expectedWeight = expectedWeightAt(benchmarks, flock.bird_type, flock.breed, age);

  // Daily series for the last 14 days, from the records already fetched.
  const series = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today(), -(13 - i));
    const r = records.find((x) => x.record_date === date);
    return {
      date,
      eggs: r?.eggs_collected ?? 0,
      deaths: (r?.mortality ?? 0) + (r?.culls ?? 0),
      kg: Number(r?.feed_consumed_kg ?? 0),
    };
  });

  const upcomingVaccinations = health.vaccinations.filter((v) => v.status !== "done").slice(0, 5);
  const layerLike = ["layer", "kienyeji", "improved_kienyeji", "breeder"].includes(flock.bird_type);

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/app/flocks"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-brand"
      >
        <ChevronLeft className="h-4 w-4" />
        Flocks
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {flock.code}
            </h1>
            <Badge tone="brand" dot>
              {FLOCK_STATUS_LABEL[flock.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {flock.name ? `${flock.name} · ` : ""}
            {BIRD_TYPE_LABEL[flock.bird_type]}
            {flock.breed ? ` · ${flock.breed}` : ""} · day {age}
          </p>
        </div>

        <ButtonLink href={`/app/record?flock=${flock.id}`} size="sm">
          <ClipboardList className="h-4 w-4" />
          Record data
        </ButtonLink>
      </div>

      {/* ------------------------------------------------------- timeline -- */}
      <Card className="mt-5">
        <CardBody>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {stages.map((stage, i) => (
              <li key={stage.label} className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                    stage.state === "current"
                      ? "bg-brand text-white"
                      : stage.state === "done"
                        ? "bg-brand-soft text-brand"
                        : "bg-surface-sunk text-ink-faint"
                  }`}
                >
                  {stage.label}
                  <span className="opacity-70 tnum">d{stage.at}</span>
                </span>
                {i < stages.length - 1 && (
                  <span className="h-px w-4 bg-line-strong" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
          {flock.expected_harvest_date && (
            <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-ink-faint">
              <Calendar className="h-3.5 w-3.5" />
              Expected harvest {flock.expected_harvest_date} (
              {relativeDay(flock.expected_harvest_date)})
            </p>
          )}
        </CardBody>
      </Card>

      {/* ----------------------------------------------------------- KPIs -- */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Live birds"
          value={formatNumber(flock.current_count)}
          hint={`${formatNumber(flock.placement_count)} placed`}
          tone="brand"
        />
        <StatCard
          label="Mortality"
          value={formatPercent(metrics?.mortality_pct ?? 0)}
          hint={`${formatNumber((metrics?.mortality ?? 0) + (metrics?.culls ?? 0))} birds`}
          icon={<Skull className="h-4.5 w-4.5" />}
          tone={(metrics?.mortality_pct ?? 0) > 5 ? "critical" : "neutral"}
        />
        {layerLike ? (
          <StatCard
            label="Laying rate"
            value={metrics?.lay_pct !== null && metrics?.lay_pct !== undefined ? formatPercent(metrics.lay_pct) : "—"}
            hint="Hen-day, last 7 days"
            icon={<Egg className="h-4.5 w-4.5" />}
            tone="good"
          />
        ) : (
          <StatCard
            label="Feed conversion"
            value={metrics?.fcr ?? "—"}
            hint="kg feed per kg live weight"
            icon={<Wheat className="h-4.5 w-4.5" />}
            tone={metrics?.fcr && metrics.fcr <= 1.8 ? "good" : "attention"}
          />
        )}
        <StatCard
          label="Average weight"
          value={metrics?.avg_weight_g ? formatNumber(metrics.avg_weight_g) : "—"}
          unit={metrics?.avg_weight_g ? "g" : undefined}
          hint={metrics?.adg_g ? `${metrics.adg_g} g/day gain` : "Not weighed yet"}
          icon={<Scale className="h-4.5 w-4.5" />}
          tone="info"
        />
      </div>

      {expectedWeight && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
          <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Expected for {flock.breed} at day {age}:{" "}
            <span className="font-medium text-ink-soft tnum">
              {expectedWeight.lowGrams === expectedWeight.highGrams
                ? `${formatNumber(expectedWeight.lowGrams)} g`
                : `${formatNumber(expectedWeight.lowGrams)}–${formatNumber(expectedWeight.highGrams)} g`}
            </span>
            {expectedWeight.extrapolated && " (nearest published age)"} — Source: {expectedWeight.source}
          </span>
        </p>
      )}

      {/* --------------------------------------------------------- charts -- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {layerLike && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Egg collection"
              subtitle="Last 14 days"
              icon={<Egg className="h-4 w-4" />}
            />
            <CardBody>
              <EggTrendChart data={series} />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Birds lost"
            subtitle="Last 14 days"
            icon={<Skull className="h-4 w-4" />}
          />
          <CardBody>
            <MortalityChart data={series} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Feed consumption"
            subtitle="Last 14 days"
            icon={<Wheat className="h-4 w-4" />}
          />
          <CardBody>
            <FeedChart data={series} />
          </CardBody>
        </Card>
      </div>

      {/* ----------------------------------------------- totals and health -- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title="Since placement"
            subtitle={`${metrics?.days_recorded ?? 0} days recorded`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              {[
                ["Eggs collected", formatNumber(metrics?.eggs_total ?? 0), <Egg key="e" className="h-4 w-4" />],
                ["Saleable eggs", formatNumber(metrics?.eggs_saleable ?? 0), <Egg key="s" className="h-4 w-4" />],
                ["Feed used", `${formatNumber(metrics?.feed_kg ?? 0, { decimals: 1 })} kg`, <Wheat key="f" className="h-4 w-4" />],
                ["Water used", `${formatNumber(metrics?.water_liters ?? 0, { decimals: 0 })} L`, <Droplets key="w" className="h-4 w-4" />],
                ["Birds sold", formatNumber(metrics?.birds_sold ?? 0), null],
                ["Cost per bird", formatMoney(flock.cost_per_bird_cents), null],
              ].map(([label, value, icon]) => (
                <div key={String(label)}>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
                    {icon}
                    {label as string}
                  </dt>
                  <dd className="mt-0.5 text-lg font-semibold text-ink tnum">
                    {value as string}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-faint">
              Record-keeping: {metrics?.recording_rate ?? 0}% of days since placement.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Vaccinations"
            subtitle="Due and upcoming"
            icon={<Syringe className="h-4 w-4" />}
            action={
              <Link href="/app/health" className="text-xs font-semibold text-brand hover:underline">
                Health →
              </Link>
            }
          />
          <CardBody className="p-0">
            {upcomingVaccinations.length === 0 ? (
              <EmptyState
                icon={<Syringe className="h-6 w-6" />}
                title="No vaccinations scheduled"
                description="Add the programme for this flock and Hatch360 will remind you before each dose is due."
                action={
                  <ButtonLink href={`/app/health?flock=${flock.id}`} size="sm" variant="secondary">
                    Set up schedule
                  </ButtonLink>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {upcomingVaccinations.map((v) => {
                  const overdue = v.due_date < today();
                  return (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{v.vaccine}</p>
                        <p className="text-xs text-ink-faint">
                          {v.day_of_age !== null ? `Day ${v.day_of_age} · ` : ""}
                          {relativeDay(v.due_date)}
                        </p>
                      </div>
                      <Badge tone={overdue ? "critical" : "attention"} dot>
                        {overdue ? "Overdue" : "Due"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* -------------------------------------------------- recent records -- */}
      <Card className="mt-5">
        <CardHeader
          title="Recorded days"
          subtitle="Most recent first"
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          {records.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="Nothing recorded yet"
              description="One entry and every number on this page starts working."
              action={
                <ButtonLink href={`/app/record?flock=${flock.id}`} size="sm">
                  Record the first day
                </ButtonLink>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Date</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Deaths</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Culls</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Eggs</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Feed (kg)</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Weight (g)</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Range (g)</th>
                    {canManage && <th scope="col" className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {records.slice(0, 20).map((r) => (
                    <DailyRecordRow key={r.id} record={r} flock={flock} canManage={canManage} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
