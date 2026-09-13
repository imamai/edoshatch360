import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Download, SlidersHorizontal } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { getBrandingWithUrls } from "@/lib/data/branding";
import { BIRD_TYPE_LABEL, FLOCK_STATUS_LABEL } from "@/lib/data/flocks";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { PrintButton } from "@/components/app/print-button";
import { ReportDocument } from "@/components/app/report-document";
import { Card, CardBody } from "@/components/ui/card";
import type { SaleDocumentBusiness } from "@/components/app/sale-document";
import type { BirdType, Flock, FlockStatus } from "@/lib/database.types";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Batch summary" };

const FIELD =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none";

interface Metrics {
  age_days: number;
  placed: number;
  current: number;
  mortality: number;
  culls: number;
  birds_sold: number;
  mortality_pct: number;
  eggs_total: number;
  eggs_saleable: number;
  feed_kg: number;
  water_liters: number;
  avg_weight_g: number | null;
  fcr: number | null;
  lay_pct: number | null;
  days_recorded: number;
  last_record_date: string | null;
}

/** One label/value line, the way the reference summary sets them. */
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-0">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-sm font-medium text-ink tnum">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
        {title}
      </h2>
      <dl className="mt-1.5">{children}</dl>
    </section>
  );
}

/**
 * One batch, on one page.
 *
 * Every other report is a table of many rows. This is the opposite shape: a
 * single flock written out the way a farmer talks about it — what it is, how
 * it is doing, what it has earned — because that is the page that gets shown
 * to a bank, a buyer or a vet.
 *
 * Nothing new is measured. The figures come from edoshatch360_flock_metrics,
 * which the flock screens already use, plus the sales and expenses already
 * tagged to this batch.
 */
export default async function BatchSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ flock?: string }>;
}) {
  const session = await requireSession();
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("reports_export")) {
    return <UpgradeNotice what="Batch summary" from={featureFrom("reports_export")} />;
  }

  const params = await searchParams;
  const showMoney = can(session.role, CAN_SEE_MONEY);
  const supabase = await createClient();
  const currency = session.tenant.currency;

  const { data: flockRows } = await supabase
    .from("edoshatch360_flocks")
    .select("*")
    .eq("tenant_id", session.tenant.id)
    .order("placement_date", { ascending: false });

  const flocks = (flockRows ?? []) as Flock[];
  const chosen = params.flock ? flocks.find((f) => f.id === params.flock) : undefined;

  let metrics: Metrics | null = null;
  let records: Record<string, unknown>[] = [];
  let revenueCents = 0;
  let expenseCents = 0;
  let branding = null as Awaited<ReturnType<typeof getBrandingWithUrls>> | null;

  if (chosen) {
    const [m, r, sale, exp, b] = await Promise.all([
      supabase.rpc("edoshatch360_flock_metrics", { p_flock: chosen.id }),
      supabase
        .from("edoshatch360_daily_records")
        .select("record_date, eggs_collected, mortality, culls, feed_consumed_kg")
        .eq("flock_id", chosen.id)
        .order("record_date", { ascending: false })
        .limit(14),
      showMoney
        ? supabase
            .from("edoshatch360_sale_items")
            .select("line_total_cents")
            .eq("tenant_id", session.tenant.id)
            .eq("flock_id", chosen.id)
        : Promise.resolve({ data: [] }),
      showMoney
        ? supabase
            .from("edoshatch360_expenses")
            .select("amount_cents")
            .eq("tenant_id", session.tenant.id)
            .eq("flock_id", chosen.id)
        : Promise.resolve({ data: [] }),
      getBrandingWithUrls(session.tenant.id),
    ]);

    metrics = m.data as Metrics | null;
    records = (r.data ?? []) as Record<string, unknown>[];
    revenueCents = ((sale.data ?? []) as { line_total_cents: number }[])
      .reduce((s, x) => s + x.line_total_cents, 0);
    expenseCents = ((exp.data ?? []) as { amount_cents: number }[])
      .reduce((s, x) => s + x.amount_cents, 0);
    branding = b;
  }

  const business: SaleDocumentBusiness = {
    name: session.tenant.name,
    address: session.tenant.address,
    phone: session.tenant.phone,
    email: session.tenant.email,
    kraPin: session.tenant.kra_pin,
  };

  // Feed per bird per day, from the feed already recorded and the days it was
  // recorded over — arithmetic on existing figures, not a new measurement.
  const feedPerBirdPerDay =
    metrics && metrics.current > 0 && metrics.days_recorded > 0
      ? (metrics.feed_kg * 1000) / (metrics.current * metrics.days_recorded)
      : null;

  const csv = chosen
    ? `/app/reports/export?report=production&flock=${chosen.id}&from=${chosen.placement_date}&to=${new Date().toLocaleDateString("en-CA")}`
    : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <nav className="flex items-center gap-1.5 text-sm text-ink-faint print:hidden">
        <Link href="/app/reports" className="hover:text-brand">
          Standard Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-ink-soft">Batch summary</span>
      </nav>

      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-ink">Batch summary</h1>
        <p className="mt-1 text-sm text-ink-soft">
          One batch written out on a single page — what it is, how it is doing and
          what it has earned.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4 print:hidden"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Choose a batch
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-faint">Batch</span>
            <select name="flock" defaultValue={chosen?.id ?? ""} className={FIELD}>
              <option value="" disabled>
                Pick a batch
              </option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                  {f.name ? ` — ${f.name}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            View summary
          </button>

          {csv && (
            <a
              href={csv}
              download
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download CSV
            </a>
          )}

          {chosen && <PrintButton size="md" />}
        </div>
      </form>

      {!chosen ? (
        <div className="empty-frame px-4 py-10 text-center print:hidden">
          <p className="text-sm font-medium text-ink">
            {flocks.length === 0 ? "There are no batches yet." : "Pick a batch above."}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {flocks.length === 0
              ? "Add a flock and record a day or two, and its summary will appear here."
              : "Its details, production, money and recent records appear here."}
          </p>
        </div>
      ) : (
        <Card className="print-sheet print:border-0 print:shadow-none">
          <CardBody className="sm:p-8">
            <ReportDocument
              title={`Flock summary — ${chosen.code}`}
              business={business}
              branding={
                branding ?? {
                  logoUrl: null, signatureUrl: null,
                  signatoryName: null, signatoryTitle: null,
                }
              }
              covers={[
                `Batch ${chosen.code}`,
                `Placed ${formatDate(chosen.placement_date, "long")}`,
                FLOCK_STATUS_LABEL[chosen.status as FlockStatus],
              ]}
              recordCount={metrics?.days_recorded ?? 0}
            >
              {/* On screen the letterhead is hidden, so the batch names itself. */}
              <h2 className="text-lg font-semibold text-ink print:hidden">
                Flock summary — {chosen.code}
                {chosen.name ? ` · ${chosen.name}` : ""}
              </h2>

              <div className="mt-4 grid gap-x-8 sm:grid-cols-2 print:mt-0">
                <div>
                  <Section title="Batch details">
                    <Line
                      label="Poultry type"
                      value={BIRD_TYPE_LABEL[chosen.bird_type as BirdType]}
                    />
                    <Line label="Breed" value={chosen.breed || "—"} />
                    <Line label="Hatchery" value={chosen.source_hatchery || "—"} />
                    <Line
                      label="Date received"
                      value={formatDate(chosen.placement_date, "long")}
                    />
                    <Line
                      label="Age"
                      value={`${formatNumber(metrics?.age_days ?? 0)} days`}
                    />
                    <Line
                      label="Status"
                      value={FLOCK_STATUS_LABEL[chosen.status as FlockStatus]}
                    />
                  </Section>

                  {showMoney && (
                    <Section title="Financial summary">
                      <Line
                        label="Total revenue"
                        value={formatMoney(revenueCents, { currency })}
                      />
                      <Line
                        label="Total expenses"
                        value={formatMoney(expenseCents, { currency })}
                      />
                      <Line
                        label="Estimated profit"
                        value={formatMoney(revenueCents - expenseCents, { currency })}
                      />
                    </Section>
                  )}
                </div>

                <div>
                  <Section title="Production summary">
                    <Line
                      label="Started with"
                      value={`${formatNumber(metrics?.placed ?? 0)} birds`}
                    />
                    <Line
                      label="Alive now"
                      value={`${formatNumber(metrics?.current ?? 0)} birds`}
                    />
                    <Line
                      label="Mortality"
                      value={`${formatNumber(metrics?.mortality_pct ?? 0, { decimals: 2 })}%`}
                    />
                    <Line label="Total eggs" value={formatNumber(metrics?.eggs_total ?? 0)} />
                    <Line
                      label="Total feed used"
                      value={`${formatNumber(metrics?.feed_kg ?? 0, { decimals: 1 })} kg`}
                    />
                    <Line
                      label="Feed per bird per day"
                      value={
                        feedPerBirdPerDay === null
                          ? "—"
                          : `${formatNumber(feedPerBirdPerDay, { decimals: 0 })} g`
                      }
                    />
                    <Line
                      label="Feed conversion (kg feed / kg live weight)"
                      value={
                        metrics?.fcr === null || metrics?.fcr === undefined
                          ? "—"
                          : formatNumber(metrics.fcr, { decimals: 2 })
                      }
                    />
                    <Line
                      label="Days recorded"
                      value={formatNumber(metrics?.days_recorded ?? 0)}
                    />
                  </Section>
                </div>
              </div>

              <section className="mt-6">
                <h2 className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                  Recent daily records
                </h2>

                {records.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">
                    Nothing has been recorded for this batch yet.
                  </p>
                ) : (
                  <div className="scroll-slim mt-2 overflow-x-auto print:overflow-visible">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-y border-line-strong bg-brand-band text-left text-xs text-brand-dark [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
                          <th scope="col" className="px-3 py-2.5 font-semibold">Date</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Eggs</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Deaths</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Culls</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Feed (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {records.map((d) => (
                          <tr key={String(d.record_date)}>
                            <td className="px-3 py-2 text-ink">
                              {formatDate(String(d.record_date), "long")}
                            </td>
                            <td className="px-3 py-2 text-right text-ink tnum">
                              {d.eggs_collected === null ? "—" : formatNumber(Number(d.eggs_collected))}
                            </td>
                            <td className="px-3 py-2 text-right text-ink tnum">
                              {formatNumber(Number(d.mortality ?? 0))}
                            </td>
                            <td className="px-3 py-2 text-right text-ink tnum">
                              {formatNumber(Number(d.culls ?? 0))}
                            </td>
                            <td className="px-3 py-2 text-right text-ink tnum">
                              {d.feed_consumed_kg === null
                                ? "—"
                                : formatNumber(Number(d.feed_consumed_kg), { decimals: 1 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-2 text-xs text-ink-faint">
                  {records.length === 14
                    ? "The fourteen most recent days. Download the CSV for every record."
                    : `${records.length} day${records.length === 1 ? "" : "s"} recorded.`}
                </p>
              </section>
            </ReportDocument>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
