import type { DashboardData } from "@/lib/data/dashboard";
import { computeKpis, daySeries, expenseBreakdown, moneySeries } from "@/lib/data/dashboard";
import type { Flock, FlockMetrics, WeightBenchmark } from "@/lib/database.types";
import { addDays, formatMoney, formatNumber, formatPercent, today } from "@/lib/utils";
import { LIMITS } from "@/lib/data-quality";

/**
 * The farm analysis engine behind edos.ai, EDOS Hatch360's assistant.
 *
 * Everything here is computed from the tenant's own records. Nothing is
 * generated, guessed or phrased by a language model — which is the point:
 * a farmer acting on "House 3 is eating more per bird than House 1" needs
 * that to be arithmetic they could redo by hand, not prose that sounds
 * plausible.
 *
 * Each finding carries the figures it came from, so the interface can show
 * the working. Spec §35 also requires a hard line between a data observation
 * and veterinary advice; `needsVet` marks findings that should end with
 * "call your animal health officer" rather than a recommendation from us.
 */

export type InsightTone = "good" | "watch" | "urgent" | "neutral";

export interface Evidence {
  label: string;
  value: string;
  /** What good looks like, where there is a meaningful benchmark. */
  target?: string;
}

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  body: string;
  evidence: Evidence[];
  /** Suggested next step, where one follows from the data alone. */
  action?: string;
  /** True when the honest next step is a vet, not a suggestion from us. */
  needsVet?: boolean;
  href?: string;
}

export const BENCHMARK = {
  mortalityPct: 5,
  layPct: 85,
  fcr: 1.8,
  brokenPct: 2,
  recordingRate: 80,
} as const;

/* ------------------------------------------------------------ analysis -- */

export interface AnalysisInput {
  data: DashboardData;
  metrics: { flock: Flock; metrics: FlockMetrics | null }[];
  currency: string;
  canSeeMoney: boolean;
  /** Published breed growth curves, for comparing a flock's weight against
   *  what its breed should weigh at its age — see lib/weight-benchmark.ts. */
  weightBenchmarks: WeightBenchmark[];
}

/** Linear trend over a series; returns percent change per day. */
function trendPerDay(values: number[]): number | null {
  const points = values.filter((v) => Number.isFinite(v));
  if (points.length < 5) return null;

  const n = points.length;
  const meanX = (n - 1) / 2;
  const meanY = points.reduce((a, b) => a + b, 0) / n;
  if (meanY === 0) return null;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (points[i] - meanY);
    den += (i - meanX) ** 2;
  }
  if (den === 0) return null;

  return ((num / den) / meanY) * 100;
}

export function analyseFarm(input: AnalysisInput): Insight[] {
  const { data, metrics, currency, canSeeMoney } = input;
  const out: Insight[] = [];
  const kpis = computeKpis(data);
  const t = today();

  /* ----------------------------------------------------- no data yet -- */

  if (data.flocks.length === 0) {
    return [{
      id: "no-flocks",
      tone: "neutral",
      title: "There is nothing to analyse yet",
      body: "Add a flock and record a few days, and this page starts telling you where your birds, feed and money are actually going.",
      evidence: [],
      action: "Add your first flock",
      href: "/app/flocks/new",
    }];
  }

  /* -------------------------------------------------- per-flock checks -- */

  for (const { flock, metrics: m } of metrics) {
    if (!m) continue;
    const flockRecords = data.records.filter((r) => r.flock_id === flock.id);

    // Mortality against the benchmark for the bird type.
    if (m.days_recorded > 3 && m.mortality_pct > BENCHMARK.mortalityPct) {
      out.push({
        id: `mortality-${flock.id}`,
        tone: m.mortality_pct > BENCHMARK.mortalityPct * 1.5 ? "urgent" : "watch",
        title: `${flock.code} has lost ${formatPercent(m.mortality_pct)} of the birds placed`,
        body: `That is above the ${BENCHMARK.mortalityPct}% you would normally accept across a cycle. ${formatNumber(m.mortality + m.culls)} of ${formatNumber(m.placed)} birds are gone.`,
        evidence: [
          { label: "Cumulative mortality", value: formatPercent(m.mortality_pct), target: `${BENCHMARK.mortalityPct}%` },
          { label: "Birds lost", value: formatNumber(m.mortality + m.culls) },
          { label: "Birds placed", value: formatNumber(m.placed) },
          { label: "Age", value: `${m.age_days} days` },
        ],
        needsVet: true,
        href: `/app/flocks/${flock.id}`,
      });
    }

    // A sudden cluster of deaths matters more than the running total.
    const last7 = flockRecords.filter((r) => r.record_date > addDays(t, -7));
    const deaths7 = last7.reduce((a, r) => a + r.mortality + r.culls, 0);
    if (flock.current_count > 0 && deaths7 / flock.current_count > 0.015) {
      out.push({
        id: `spike-${flock.id}`,
        tone: "urgent",
        title: `${flock.code} lost ${formatNumber(deaths7)} birds in the last week`,
        body: `That is ${formatPercent((deaths7 / flock.current_count) * 100)} of the live flock in seven days. A rate like that is usually disease, feed, water or temperature — not ordinary attrition.`,
        evidence: [
          { label: "Lost in 7 days", value: formatNumber(deaths7) },
          { label: "Share of flock", value: formatPercent((deaths7 / flock.current_count) * 100), target: "under 1%" },
          { label: "Live birds", value: formatNumber(flock.current_count) },
        ],
        needsVet: true,
        href: `/app/flocks/${flock.id}`,
      });
    }

    // Laying rate, and whether it is drifting down.
    if (m.lay_pct !== null && m.eggs_last_7 > 0) {
      const daily = Array.from({ length: 14 }, (_, i) => {
        const date = addDays(t, -(13 - i));
        return flockRecords.find((r) => r.record_date === date)?.eggs_collected ?? 0;
      });
      const slope = trendPerDay(daily);

      if (m.lay_pct < BENCHMARK.layPct * 0.75) {
        out.push({
          id: `lay-${flock.id}`,
          tone: "watch",
          title: `${flock.code} is laying at ${formatPercent(m.lay_pct)}`,
          body: `A healthy flock of this type sits near ${BENCHMARK.layPct}%. Production this far below target is usually feed quality, day length, water, or the flock simply being past peak.`,
          evidence: [
            { label: "Hen-day production", value: formatPercent(m.lay_pct), target: `${BENCHMARK.layPct}%` },
            { label: "Eggs in 7 days", value: formatNumber(m.eggs_last_7) },
            { label: "Live birds", value: formatNumber(m.current) },
            { label: "Flock age", value: `${m.age_days} days` },
          ],
          action: "Check feed intake per bird and water supply before anything else.",
          href: `/app/flocks/${flock.id}`,
        });
      }

      if (slope !== null && slope < -1.2) {
        out.push({
          id: `lay-trend-${flock.id}`,
          tone: "urgent",
          title: `Egg production in ${flock.code} is falling`,
          body: `Collection has dropped about ${Math.abs(slope).toFixed(1)}% a day over the last fortnight. A steady slide like this rarely reverses on its own.`,
          evidence: [
            { label: "Trend", value: `${slope.toFixed(1)}% per day`, target: "flat or rising" },
            { label: "Eggs in 7 days", value: formatNumber(m.eggs_last_7) },
            { label: "Current rate", value: formatPercent(m.lay_pct), target: `${BENCHMARK.layPct}%` },
          ],
          action: "Compare feed consumption over the same days — if intake fell first, start there.",
          href: "/app/production",
        });
      }
    }

    // Feed conversion for meat birds.
    if (m.fcr !== null && m.fcr > BENCHMARK.fcr * 1.15) {
      out.push({
        id: `fcr-${flock.id}`,
        tone: "watch",
        title: `${flock.code} is converting feed at ${m.fcr}`,
        body: `You are using ${m.fcr} kg of feed for every kilo of live weight, against a target of ${BENCHMARK.fcr}. On ${formatNumber(m.current)} birds that gap is real money.`,
        evidence: [
          { label: "Feed conversion", value: String(m.fcr), target: String(BENCHMARK.fcr) },
          { label: "Feed used", value: `${formatNumber(m.feed_kg, { decimals: 0 })} kg` },
          { label: "Average weight", value: m.avg_weight_g ? `${formatNumber(m.avg_weight_g)} g` : "not weighed" },
        ],
        action: "Check for feed spillage at the feeders and confirm the ration matches the birds' age.",
        href: `/app/flocks/${flock.id}`,
      });
    }

    // Egg breakage is quiet, recoverable revenue.
    if (m.eggs_total > 200) {
      const lossPct = ((m.eggs_broken + m.eggs_rejected) / m.eggs_total) * 100;
      if (lossPct > BENCHMARK.brokenPct) {
        out.push({
          id: `breakage-${flock.id}`,
          tone: "watch",
          title: `${formatPercent(lossPct)} of eggs from ${flock.code} are not saleable`,
          body: `${formatNumber(m.eggs_broken + m.eggs_rejected)} eggs broken or rejected out of ${formatNumber(m.eggs_total)}. Above about ${BENCHMARK.brokenPct}% this is usually collection frequency, nest box condition, or handling.`,
          evidence: [
            { label: "Loss rate", value: formatPercent(lossPct), target: `${BENCHMARK.brokenPct}%` },
            { label: "Broken", value: formatNumber(m.eggs_broken) },
            { label: "Rejected", value: formatNumber(m.eggs_rejected) },
          ],
          action: "Collect more often and check nest box bedding.",
          href: "/app/production",
        });
      }
    }

    // Data you cannot trust is worth flagging before conclusions are drawn.
    if (m.age_days > 14 && m.recording_rate < BENCHMARK.recordingRate) {
      out.push({
        id: `records-${flock.id}`,
        tone: "neutral",
        title: `${flock.code} has records for only ${m.recording_rate}% of its days`,
        body: "Gaps make mortality rates, feed conversion and production averages unreliable — the figures above are calculated from the days you did record.",
        evidence: [
          { label: "Days recorded", value: `${m.days_recorded} of ${m.age_days}` },
          { label: "Coverage", value: `${m.recording_rate}%`, target: `${BENCHMARK.recordingRate}%` },
        ],
        action: "Record on the same round every day, even when nothing has changed.",
        href: `/app/record?flock=${flock.id}`,
      });
    }
  }

  /* --------------------------------------------------------- feed runway -- */

  const days = daySeries(data, 30);
  const dailyFeed = days.reduce((a, d) => a + d.kg, 0) / Math.max(1, days.filter((d) => d.kg > 0).length);

  // Why running out of each thing actually matters — generic "order more"
  // advice on a vaccine and on egg trays would be equally useless.
  const STOCK_CONSEQUENCE: Partial<Record<string, string>> = {
    feed: "Order before you run out — birds off feed lose more in growth than the feed would have cost.",
    vaccine: "Order now and check the cold chain. A dose missed at the right age cannot be made up later.",
    medication: "Restock before you need it — a treatment that starts two days late is a treatment that half works.",
    packaging: "Without trays or crates you cannot move stock, however much you have produced.",
    cleaning: "Biosecurity lapses are cheap to prevent and expensive to fix.",
    equipment: "Replace before it fails rather than during a brooding week.",
    spare_parts: "Keep the part on hand — a broken drinker line on a hot day costs birds.",
  };

  for (const item of data.lowStock) {
    const runway =
      dailyFeed > 0 && item.category === "feed"
        ? Math.floor(item.current_stock / dailyFeed)
        : null;

    out.push({
      id: `stock-${item.id}`,
      tone: item.current_stock <= 0 ? "urgent" : "watch",
      title:
        item.current_stock <= 0
          ? `${item.name} has run out`
          : `${item.name} is down to ${formatNumber(item.current_stock, { decimals: 0 })} ${item.unit}`,
      body:
        runway !== null
          ? `At your current rate of about ${formatNumber(dailyFeed, { decimals: 0 })} ${item.unit} a day, that is roughly ${runway} day${runway === 1 ? "" : "s"} left.`
          : `You set a reorder level of ${formatNumber(item.reorder_level, { decimals: 0 })} ${item.unit} and stock is at or below it.`,
      evidence: [
        { label: "In stock", value: `${formatNumber(item.current_stock, { decimals: 1 })} ${item.unit}` },
        { label: "Reorder at", value: `${formatNumber(item.reorder_level, { decimals: 1 })} ${item.unit}` },
        ...(runway !== null ? [{ label: "Days remaining", value: String(runway) }] : []),
      ],
      action:
        STOCK_CONSEQUENCE[item.category] ??
        "Restock before it holds up the work that depends on it.",
      href: item.category === "feed" ? "/app/feed" : "/app/inventory",
    });
  }

  /* ------------------------------------------------------- vaccinations -- */

  const overdue = data.dueVaccinations.filter((v) => v.due_date < t);
  if (overdue.length > 0) {
    out.push({
      id: "vacc-overdue",
      tone: "urgent",
      title: `${overdue.length} vaccination${overdue.length > 1 ? "s are" : " is"} overdue`,
      body: overdue.map((v) => `${v.vaccine} (due ${v.due_date})`).join(", ") + ".",
      evidence: overdue.slice(0, 4).map((v) => ({ label: v.vaccine, value: `due ${v.due_date}` })),
      needsVet: true,
      href: "/app/health",
    });
  }

  /* ------------------------------------------------------------- money -- */

  if (canSeeMoney) {
    const money = moneySeries(data, 6);
    const thisMonth = money[money.length - 1];
    const lastMonth = money[money.length - 2];

    if (kpis.revenueCents > 0) {
      const marginTone: InsightTone =
        kpis.marginPct < 0 ? "urgent" : kpis.marginPct < 10 ? "watch" : "good";

      out.push({
        id: "margin",
        tone: marginTone,
        title:
          kpis.marginPct < 0
            ? "You are spending more than you are taking in this month"
            : `Your margin this month is ${formatPercent(kpis.marginPct)}`,
        body:
          kpis.marginPct < 0
            ? "That is normal mid-cycle for a meat batch that has not been sold yet — but not if it persists across a full cycle."
            : "A poultry operation running healthily usually sits somewhere between 15% and 30% once feed is accounted for.",
        evidence: [
          { label: "Revenue", value: formatMoney(kpis.revenueCents, { currency }) },
          { label: "Expenses", value: formatMoney(kpis.expensesCents, { currency }) },
          { label: "Profit", value: formatMoney(kpis.profitCents, { currency }) },
          { label: "Margin", value: formatPercent(kpis.marginPct), target: "15–30%" },
        ],
        href: "/app/finance",
      });
    }

    // Feed share of cost is the single most useful ratio on a poultry farm.
    const breakdown = expenseBreakdown(data);
    const totalExpense = breakdown.reduce((a, b) => a + b.value, 0);
    const feed = breakdown.find((b) => b.name.toLowerCase() === "feed");
    if (feed && totalExpense > 0) {
      const share = (feed.value / totalExpense) * 100;
      out.push({
        id: "feed-share",
        tone: share > 75 ? "watch" : "neutral",
        title: `Feed is ${formatPercent(share)} of what you spent this month`,
        body:
          share > 75
            ? "Feed above about three quarters of total cost usually means either a price rise worth negotiating or waste worth finding."
            : "That is within the normal range for a poultry operation, where feed typically runs 60–70% of cost.",
        evidence: [
          { label: "Feed cost", value: formatMoney(feed.value, { currency }) },
          { label: "Total expenses", value: formatMoney(totalExpense, { currency }) },
          { label: "Feed share", value: formatPercent(share), target: "60–70%" },
        ],
        href: "/app/finance",
      });
    }

    if (thisMonth && lastMonth && lastMonth.revenue > 0) {
      const change = ((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100;
      if (Math.abs(change) > 15) {
        out.push({
          id: "revenue-change",
          tone: change > 0 ? "good" : "watch",
          title: `Revenue is ${change > 0 ? "up" : "down"} ${formatPercent(Math.abs(change))} on last month`,
          body: `${formatMoney(thisMonth.revenue, { currency })} so far this month against ${formatMoney(lastMonth.revenue, { currency })} last month.`,
          evidence: [
            { label: "This month", value: formatMoney(thisMonth.revenue, { currency }) },
            { label: "Last month", value: formatMoney(lastMonth.revenue, { currency }) },
          ],
          href: "/app/finance",
        });
      }
    }

    // Money already earned but not collected.
    const owed = data.sales
      .filter((s) => s.balance_cents > 0 && s.doc_type !== "quotation")
      .reduce((a, s) => a + s.balance_cents, 0);
    if (owed > 0) {
      const overdueInvoices = data.sales.filter(
        (s) => s.balance_cents > 0 && s.due_date && s.due_date < t,
      );
      out.push({
        id: "receivables",
        tone: overdueInvoices.length > 0 ? "watch" : "neutral",
        title: `${formatMoney(owed, { currency })} is owed to you`,
        body:
          overdueInvoices.length > 0
            ? `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s are" : " is"} past the due date. Credit that is never chased becomes a loss quietly.`
            : "Nothing is past its due date yet.",
        evidence: [
          { label: "Outstanding", value: formatMoney(owed, { currency }) },
          { label: "Past due", value: String(overdueInvoices.length) },
        ],
        href: "/app/sales",
      });
    }
  }

  /* ------------------------------------------- records worth doubting -- */

  // Everything above asks what the farm is doing. This asks whether the
  // figures can be trusted at all — a conclusion drawn from a mistyped record
  // is worse than no conclusion, because it looks like a finding.
  //
  // Only records already saved are examined. The entry form blocks the
  // impossible and warns about the unusual, but records predate that form,
  // arrive from the offline queue, or were simply saved anyway.
  const suspect = findSuspectRecords(input);
  if (suspect.length > 0) {
    const worst = suspect.slice(0, 4);
    out.push({
      id: "data-quality",
      tone: "watch",
      title:
        suspect.length === 1
          ? "One record does not look right"
          : `${suspect.length} records do not look right`,
      body:
        "These are figures the farm probably did not have. Worth correcting, because every average on this page is computed from them — a single mistyped day can move a month's feed cost.",
      evidence: worst.map((r) => ({ label: r.label, value: r.value })),
      action: "Open the day and correct it",
      href: "/app/production",
    });
  }

  /* ------------------------------------------------ nothing to report -- */

  if (out.length === 0) {
    out.push({
      id: "all-clear",
      tone: "good",
      title: "Nothing in your records needs attention",
      body: `Mortality is within target, no stock is below its reorder level, and no vaccination is overdue. ${formatNumber(kpis.totalBirds)} birds across ${kpis.activeFlocks} flock${kpis.activeFlocks === 1 ? "" : "s"}.`,
      evidence: [
        { label: "Birds", value: formatNumber(kpis.totalBirds) },
        { label: "Mortality to date", value: formatPercent(kpis.mortalityPct), target: `${BENCHMARK.mortalityPct}%` },
      ],
    });
  }

  const order: Record<InsightTone, number> = { urgent: 0, watch: 1, neutral: 2, good: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

/* ----------------------------------------------------- data quality -- */

interface SuspectRecord {
  label: string;
  value: string;
}

/**
 * Saved records whose numbers do not hold together.
 *
 * Deliberately conservative: each test is something that is either arithmetic
 * nonsense or so far outside normal husbandry that a typo is the likeliest
 * explanation. Anything merely poor — high mortality, a bad lay rate — is a
 * farming finding and is reported by the checks above, not here.
 */
function findSuspectRecords(input: AnalysisInput): SuspectRecord[] {
  const { data, metrics } = input;
  const out: SuspectRecord[] = [];
  const flockById = new Map(metrics.map((m) => [m.flock.id, m.flock]));

  // Weighings that go backwards, per flock, need the series in date order.
  const lastWeight = new Map<string, { date: string; grams: number }>();
  const ordered = [...data.records].sort((a, b) => a.record_date.localeCompare(b.record_date));

  for (const r of ordered) {
    const flock = flockById.get(r.flock_id);
    if (!flock) continue;
    const where = `${flock.code} · ${r.record_date}`;

    const birds = flock.current_count;

    if (r.record_date < flock.placement_date) {
      out.push({ label: where, value: "dated before the birds arrived" });
    }

    if (r.record_date > today()) {
      out.push({ label: where, value: "dated in the future" });
    }

    const collected = r.eggs_collected ?? 0;
    if (collected > 0 && birds > 0 && collected > birds) {
      out.push({
        label: where,
        value: `${formatNumber(collected)} eggs from ${formatNumber(birds)} birds`,
      });
    }

    if ((r.eggs_broken ?? 0) + (r.eggs_rejected ?? 0) > collected && collected > 0) {
      out.push({ label: where, value: "more broken and rejected eggs than were collected" });
    }

    if (r.feed_consumed_kg !== null && birds > 0) {
      const perBird = Number(r.feed_consumed_kg) / birds;
      if (perBird > LIMITS.feedKgPerBirdHigh) {
        out.push({
          label: where,
          value: `${perBird.toFixed(2)} kg of feed per bird in a day`,
        });
      }
    }

    if (r.water_consumed_liters !== null && birds > 0) {
      const perBird = Number(r.water_consumed_liters) / birds;
      if (perBird > LIMITS.waterLPerBirdHigh) {
        out.push({
          label: where,
          value: `${perBird.toFixed(2)} litres of water per bird in a day`,
        });
      }
    }

    if (r.avg_weight_grams !== null) {
      const grams = Number(r.avg_weight_grams);
      const prev = lastWeight.get(r.flock_id);
      if (grams > LIMITS.weightGramsMax) {
        out.push({ label: where, value: `average bird weight of ${formatNumber(grams)} g` });
      } else if (prev && prev.grams > 0) {
        const drop = ((prev.grams - grams) / prev.grams) * 100;
        if (drop > LIMITS.weightDropPctWarn) {
          out.push({
            label: where,
            value: `weight down ${drop.toFixed(0)}% since ${prev.date}`,
          });
        }
      }
      if (grams > 0 && grams <= LIMITS.weightGramsMax) {
        lastWeight.set(r.flock_id, { date: r.record_date, grams });
      }
    }
  }

  return out;
}
