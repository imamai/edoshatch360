import type { Metadata } from "next";
import Link from "next/link";
import {
  Bird, Coins, Download, Egg, FileSpreadsheet, HeartPulse, Package,
} from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { computeKpis, getDashboardData } from "@/lib/data/dashboard";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatMoney, formatNumber, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

const PERIODS = [30, 90, 180, 365];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 90;

  const data = await getDashboardData(session.tenant.id);
  const kpis = computeKpis(data);
  const showMoney = can(session.role, CAN_SEE_MONEY);
  const currency = session.tenant.currency;

  const REPORTS = [
    {
      key: "production",
      icon: Egg,
      title: "Production report",
      body: "Every daily record: eggs collected, broken and rejected, deaths, culls, feed, water and weights, by flock and date.",
      available: true,
    },
    {
      key: "flocks",
      icon: Bird,
      title: "Flock performance",
      body: "One row per flock with age, birds placed and remaining, mortality, total eggs, feed used and feed conversion.",
      available: true,
    },
    {
      key: "health",
      icon: HeartPulse,
      title: "Health report",
      body: "The vaccination programme with what was given and when, plus every disease incident and its severity.",
      available: true,
    },
    {
      key: "inventory",
      icon: Package,
      title: "Inventory movements",
      body: "Purchases, usage, wastage and corrections across feed, vaccines, medication and equipment.",
      available: true,
    },
    {
      key: "financial",
      icon: Coins,
      title: "Financial report",
      body: "Income and expenses side by side, with paid and outstanding amounts on every sale document.",
      available: showMoney,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Reports
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Export your records as CSV — opens in Excel, Google Sheets or anything else.
          </p>
        </div>

        <div className="flex rounded-lg border border-line-strong p-0.5">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/app/reports?days=${p}`}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                days === p ? "bg-brand text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {p === 365 ? "1 year" : `${p}d`}
            </Link>
          ))}
        </div>
      </div>

      {/* Period summary — what the exports below will contain. */}
      <Card>
        <CardHeader
          title="This period at a glance"
          subtitle={`Last ${days} days`}
          icon={<FileSpreadsheet className="h-4 w-4" />}
        />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
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
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ink-faint">{label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink tnum">{value}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.filter((r) => r.available).map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.key} className="flex flex-col">
              <CardBody className="flex flex-1 flex-col">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-3.5 font-display text-base font-bold text-ink">
                  {report.title}
                </h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">
                  {report.body}
                </p>

                <a
                  href={`/app/reports/export?report=${report.key}&days=${days}`}
                  download
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </a>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Exports contain only the records your account is allowed to see. For a printed
        invoice or receipt, open the document under Sales and use Print — that gives you
        a PDF through your browser&apos;s own print dialogue.
      </p>
    </div>
  );
}
