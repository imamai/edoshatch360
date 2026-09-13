import type { Metadata } from "next";
import Link from "next/link";
import {
  Bird, ChevronRight, Coins, Egg, HeartPulse, Package,
} from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { computeKpis, getDashboardData } from "@/lib/data/dashboard";

import { formatMoney, formatNumber, formatPercent } from "@/lib/utils";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";

export const metadata: Metadata = { title: "Reports" };

const PERIODS = [30, 90, 180, 365];

/**
 * Reports, laid out as a directory rather than a wall of cards.
 *
 * The five exports are unchanged — same keys, same CSV route, same period.
 * What changed is how they are found: an area tab narrows the list, a heading
 * names the area, and each report is one scannable row instead of a card the
 * height of a paragraph. At five reports a card grid already filled the
 * screen; a directory still reads the same way at twenty.
 */

type AreaKey = "all" | "flock" | "health" | "stock" | "money";

const AREAS: { key: AreaKey; label: string; heading: string }[] = [
  { key: "all", label: "All reports", heading: "All Reports" },
  { key: "flock", label: "Flock & production", heading: "Flock & Production Reports" },
  { key: "health", label: "Health", heading: "Health Reports" },
  { key: "stock", label: "Stock", heading: "Stock Reports" },
  { key: "money", label: "Financial", heading: "Financial Reports" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; area?: string }>;
}) {
  const session = await requireSession();
  // Hidden in the navigation, but a URL still resolves — so the page
  // itself has to know what the plan carries.
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("reports_export")) {
    return <UpgradeNotice what="Reports" from={featureFrom("reports_export")} />;
  }
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 90;

  const data = await getDashboardData(session.tenant.id);
  const kpis = computeKpis(data);
  const showMoney = can(session.role, CAN_SEE_MONEY);
  const currency = session.tenant.currency;

  const REPORTS = [
    {
      key: "production",
      area: "flock" as AreaKey,
      icon: Egg,
      title: "Production report",
      body: "Every daily record: eggs collected, broken and rejected, deaths, culls, feed, water and weights, by flock and date.",
      available: true,
    },
    {
      key: "flocks",
      area: "flock" as AreaKey,
      icon: Bird,
      title: "Flock performance",
      body: "One row per flock with age, birds placed and remaining, mortality, total eggs, feed used and feed conversion.",
      available: true,
    },
    {
      key: "health",
      area: "health" as AreaKey,
      icon: HeartPulse,
      title: "Health report",
      body: "The vaccination programme with what was given and when, plus every disease incident and its severity.",
      available: true,
    },
    {
      key: "inventory",
      area: "stock" as AreaKey,
      icon: Package,
      title: "Inventory movements",
      body: "Purchases, usage, wastage and corrections across feed, vaccines, medication and equipment.",
      available: true,
    },
    {
      key: "financial",
      area: "money" as AreaKey,
      icon: Coins,
      title: "Financial report",
      body: "Income and expenses side by side, with paid and outstanding amounts on every sale document.",
      available: showMoney,
    },
  ].filter((r) => r.available);

  // An area tab is only offered when something lives under it, so the row of
  // tabs never promises a page that turns out to be empty.
  const present = new Set(REPORTS.map((r) => r.area));
  const tabs = AREAS.filter((a) => a.key === "all" || present.has(a.key));

  const requested = (params.area ?? "all") as AreaKey;
  const active = tabs.some((t) => t.key === requested) ? requested : "all";
  const heading = tabs.find((t) => t.key === active)!.heading;

  const shown = active === "all" ? REPORTS : REPORTS.filter((r) => r.area === active);

  // Grouped under their area even on a single-area tab, so the page keeps one
  // shape however it is entered.
  const groups = AREAS.filter((a) => a.key !== "all")
    .map((a) => ({ ...a, items: shown.filter((r) => r.area === a.key) }))
    .filter((g) => g.items.length > 0);

  const summary: [string, string][] = [
    ["Birds on farm", formatNumber(kpis.totalBirds)],
    ["Active flocks", String(kpis.activeFlocks)],
    ["Mortality to date", formatPercent(kpis.mortalityPct)],
    ["Feed used (7d)", `${formatNumber(kpis.feedKg7, { decimals: 0 })} kg`],
    ...(showMoney
      ? ([
          ["Revenue this month", formatMoney(kpis.revenueCents, { currency, compact: true })],
          ["Expenses this month", formatMoney(kpis.expensesCents, { currency, compact: true })],
          ["Profit this month", formatMoney(kpis.profitCents, { currency, compact: true })],
          ["Margin", formatPercent(kpis.marginPct)],
        ] as [string, string][])
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Standard Reports</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Export your records as CSV — opens in Excel, Google Sheets or anything else.
        </p>
      </div>

      {/* Areas. Plain underlined tabs: the active one is named by the heading
          directly beneath, so the two always agree. */}
      <div className="scroll-slim -mb-px flex gap-6 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={`/app/reports?area=${t.key}&days=${days}`}
              aria-current={on ? "page" : undefined}
              className={`shrink-0 border-b-2 px-0.5 pb-2.5 text-sm transition-colors ${
                on
                  ? "border-brand font-semibold text-brand"
                  : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">{heading}</h2>

        {/* The range every download below is cut to. */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-faint">Period</span>
          <div className="flex rounded-lg border border-line-strong p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p}
                href={`/app/reports?area=${active}&days=${p}`}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  days === p ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {p === 365 ? "1 year" : `${p}d`}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2.5">
          <h3 className="text-sm font-medium text-ink-soft">{group.label}</h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((report) => {
              const Icon = report.icon;
              return (
                <a
                  key={report.key}
                  href={`/app/reports/export?report=${report.key}&days=${days}`}
                  download
                  title={report.body}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sunk px-3 py-2.5 transition-colors hover:border-brand hover:bg-brand-soft"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="truncate text-sm text-ink">{report.title}</span>
                  </span>
                  {/* The chevron is the reference pattern's affordance. It reads as
                      "go", so the action it actually performs is spelled out for
                      anyone not going by the glyph. */}
                  <span className="sr-only">— download CSV</span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand"
                    aria-hidden="true"
                  />
                </a>
              );
            })}
          </div>
        </section>
      ))}

      {/* Period summary — what the exports above will contain. */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-sm font-medium text-ink-soft">Last {days} days at a glance</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 rounded-lg border border-line bg-surface px-4 py-3.5 sm:grid-cols-4">
          {summary.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-ink-faint">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-ink tnum">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="border-t border-line pt-4 text-center text-sm text-ink-soft">
        Need one batch, one farm or one person instead of everything?{" "}
        <Link href="/app/reports/custom" className="font-medium text-brand hover:underline">
          Build a custom report
        </Link>
      </p>

      <p className="text-xs leading-relaxed text-ink-faint">
        Exports contain only the records your account is allowed to see. For a printed
        invoice or receipt, open the document under Sales and use Print — that gives you
        a PDF through your browser&apos;s own print dialogue.
      </p>
    </div>
  );
}
