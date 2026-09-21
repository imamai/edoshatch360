import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Info, Lightbulb, TrendingUp } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { ReadOnlyNotice } from "@/components/app/read-only-notice";
import {
  computeStreak, flockAgeDays, getFlocks, getRecentRecords, getRecordForDate,
  laysEggs, BIRD_TYPE_LABEL,
} from "@/lib/data/flocks";
import { getWeightBenchmarks } from "@/lib/data/weight-benchmarks";
import { expectedWeightAt } from "@/lib/weight-benchmark";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordForm } from "@/components/app/record-form";
import { RecordContextBar } from "@/components/app/record-context-bar";
import { formatNumber, relativeDay, today } from "@/lib/utils";
import { Bird } from "lucide-react";

export const metadata: Metadata = { title: "Record data" };

/** Age-appropriate guidance. Husbandry practice, never medical advice. */
function bestPractices(birdType: string, ageDays: number): string[] {
  const tips: string[] = [];

  if (ageDays <= 7) {
    tips.push("Brooder temperature around 33–35 °C in week one, dropping ~3 °C each week.");
    tips.push("Chicks should be spread evenly. Huddling means cold; edges mean too hot.");
    tips.push("Check crops in the evening — a full crop means they have found the feed.");
  } else if (ageDays <= 21) {
    tips.push("Widen the brooder guard and give more floor space as they feather out.");
    tips.push("Keep litter dry. Wet litter is where coccidiosis starts.");
    tips.push("Weigh a sample weekly — catching a growth lag early is the whole point.");
  } else if (birdType === "broiler") {
    tips.push("Watch feed conversion now; this is where most of the batch cost lands.");
    tips.push("Make sure feeder and drinker space keeps up with body size.");
    tips.push("Record weights before deciding a harvest date, not after.");
  } else {
    tips.push("Collect eggs at least twice a day to cut breakages and dirty shells.");
    tips.push("A sudden drop in laying usually shows in water intake first.");
    tips.push("Keep nest boxes clean — rejected eggs are lost revenue, not a small thing.");
  }

  tips.push("Record on the same round every day. Consistent data is what makes the trends real.");
  return tips;
}

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ flock?: string; date?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;

  // This page exists only to write. A read-only account is told so here
  // rather than after filling the form in.
  if (!can(session.role, CAN_WRITE)) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Record data
        </h1>
        <div className="mt-5">
          <ReadOnlyNotice what="Recording daily data" tenantName={session.tenant.name} />
        </div>
      </div>
    );
  }

  const flocks = await getFlocks(session.tenant.id);

  if (flocks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
          Record data
        </h1>
        <Card className="mt-5">
          <CardBody>
            <EmptyState
              icon={<Bird className="h-6 w-6" />}
              title="There is no flock to record yet"
              description="Add the birds you have and this becomes a sixty-second job every morning."
              action={<ButtonLink href="/app/flocks/new">Add your first flock</ButtonLink>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  // Fall back to the first flock if the URL names one this user cannot see —
  // RLS already filtered the list, so an unknown id is simply not theirs.
  const flock = flocks.find((f) => f.id === params.flock) ?? flocks[0];
  const date =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today()
      ? params.date
      : today();

  const [existing, recent, benchmarks] = await Promise.all([
    getRecordForDate(flock.id, date),
    getRecentRecords(flock.id, 60),
    getWeightBenchmarks(),
  ]);

  const streak = computeStreak(recent);
  const age = flockAgeDays(flock, date);
  const expectedWeight = expectedWeightAt(benchmarks, flock.bird_type, flock.breed, age);
  const tips = bestPractices(flock.bird_type, age);
  const lastSeven = recent.slice(0, 7);

  // The most recent weighing before the day being recorded, so the form can
  // say "down 12% since the last weighing" rather than just accepting it.
  const previousWeight =
    recent.find((r) => r.record_date < date && r.avg_weight_grams !== null)
      ?.avg_weight_grams ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Record data
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {BIRD_TYPE_LABEL[flock.bird_type]} · day {age} ·{" "}
            {formatNumber(flock.current_count)} birds
          </p>
        </div>

        {streak > 0 && (
          <Badge tone="attention">
            <Flame className="h-3.5 w-3.5" />
            {streak}-day streak
          </Badge>
        )}
      </div>

      <div className="mt-4">
        <RecordContextBar flocks={flocks} flockId={flock.id} date={date} />
      </div>

      {existing && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-info/25 bg-info-soft px-3 py-2.5 text-sm text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {flock.code} is already recorded for this day. Anything you save here
            replaces those figures.
          </span>
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <RecordForm
          tenantId={session.tenant.id}
          flock={flock}
          date={date}
          existing={existing}
          laysEggs={laysEggs(flock)}
          previousWeight={previousWeight}
          expectedWeight={expectedWeight}
          ageDays={age}
        />

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Last 7 entries"
              subtitle={`${flock.code}`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {lastSeven.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-ink-faint">
                  Nothing recorded yet. This fills in from your first entry.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {lastSeven.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5"
                    >
                      <span className="text-ink-soft">{relativeDay(r.record_date)}</span>
                      <span className="flex shrink-0 items-center gap-3 text-xs tnum">
                        {r.eggs_collected !== null && (
                          <span className="text-ink">{formatNumber(r.eggs_collected)} eggs</span>
                        )}
                        {r.mortality + r.culls > 0 && (
                          <span className="text-critical">−{r.mortality + r.culls}</span>
                        )}
                        {r.feed_consumed_kg !== null && (
                          <span className="text-ink-faint">
                            {formatNumber(Number(r.feed_consumed_kg), { decimals: 1 })} kg
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Worth checking today"
              subtitle={`Day ${age} · ${BIRD_TYPE_LABEL[flock.bird_type]}`}
              icon={<Lightbulb className="h-4 w-4" />}
            />
            <CardBody>
              <ul className="flex flex-col gap-2.5">
                {tips.map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                    <span
                      className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gold"
                      aria-hidden="true"
                    />
                    {tip}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
                General husbandry guidance based on flock type and age. It is not
                veterinary advice — for a sick flock, call your animal health
                officer.
              </p>
            </CardBody>
          </Card>

          <Link
            href={`/app/flocks/${flock.id}`}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-brand hover:border-brand"
          >
            Open {flock.code} in full →
          </Link>
        </aside>
      </div>
    </div>
  );
}
