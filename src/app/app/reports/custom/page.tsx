import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, SlidersHorizontal } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { PrintButton } from "@/components/app/print-button";
import { ReportDocument } from "@/components/app/report-document";
import { getBrandingWithUrls } from "@/lib/data/branding";
import type { SaleDocumentBusiness } from "@/components/app/sale-document";
import { Card, CardBody } from "@/components/ui/card";
import {
  REPORT_AREAS, areaFor, buildReportRows, isReportKey, type ReportKey,
} from "@/lib/data/report-rows";
import { addDays, formatDate, today } from "@/lib/utils";

export const metadata: Metadata = { title: "Custom report" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const FIELD =
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none";

/**
 * A report built to the question being asked.
 *
 * The standard reports answer "everything, for the last N days". This screen
 * answers "this batch", "this farm", "what Mary recorded", "between these two
 * dates" — the same five reports and the same figures, narrowed. Nothing new
 * is measured here.
 *
 * Filters live in the URL rather than in component state, so a generated
 * report can be bookmarked, sent to somebody, or turned into the CSV of
 * exactly what is on screen.
 */
export default async function CustomReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("reports_export")) {
    return <UpgradeNotice what="Custom reports" from={featureFrom("reports_export")} />;
  }

  const params = await searchParams;
  const showMoney = can(session.role, CAN_SEE_MONEY);

  const areas = REPORT_AREAS.filter((a) => a.key !== "financial" || showMoney);

  const requested = params.area;
  const area: ReportKey =
    isReportKey(requested) && areas.some((a) => a.key === requested)
      ? requested
      : "production";
  if (area === "financial" && !showMoney) notFound();

  const meta = areaFor(area);

  const to = params.to && DATE.test(params.to) ? params.to : today();
  const from = params.from && DATE.test(params.from) ? params.from : addDays(to, -90);

  // A filter the area cannot answer is dropped rather than silently ignored,
  // so the URL and the result always describe the same thing.
  const farmId = meta.supports.farm ? (params.farm || null) : null;
  const flockId = meta.supports.flock ? (params.flock || null) : null;
  const byUserId = meta.supports.by ? (params.by || null) : null;

  const supabase = await createClient();
  const [{ data: farms }, { data: flocks }, { data: members }] = await Promise.all([
    supabase
      .from("edoshatch360_farms")
      .select("id, name")
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("edoshatch360_flocks")
      .select("id, code, name, farm_id")
      .eq("tenant_id", session.tenant.id)
      .order("placement_date", { ascending: false }),
    supabase
      .from("edoshatch360_memberships")
      .select("user_id, edoshatch360_users(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .eq("status", "active"),
  ]);

  const people = (members ?? [])
    .map((m) => {
      const u = m.edoshatch360_users as unknown as {
        id: string; full_name: string | null; email: string;
      } | null;
      return u ? { id: u.id, name: u.full_name ?? u.email } : null;
    })
    .filter((p): p is { id: string; name: string } => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Batches are offered for the chosen farm only, so the two controls cannot
  // be set to a combination that returns nothing.
  const batches = (flocks ?? []).filter((f) => !farmId || f.farm_id === farmId);

  const [{ rows }, branding] = await Promise.all([
    buildReportRows(session.tenant.id, {
      report: area, from, to, farmId, flockId, byUserId,
    }),
    getBrandingWithUrls(session.tenant.id),
  ]);

  // The farm's own details, exactly as they appear on an invoice.
  const business: SaleDocumentBusiness = {
    name: session.tenant.name,
    address: session.tenant.address,
    phone: session.tenant.phone,
    email: session.tenant.email,
    kraPin: session.tenant.kra_pin,
  };

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  // What was asked for, in words. On screen it is implied by the controls; on
  // paper the controls are gone, so a printed page that does not say which
  // batch and which dates it covers is not evidence of anything.
  const farmName = farmId ? ((farms ?? []).find((f) => f.id === farmId)?.name ?? null) : null;
  const batchCode = flockId ? (batches.find((f) => f.id === flockId)?.code ?? null) : null;
  const personName = byUserId ? (people.find((p) => p.id === byUserId)?.name ?? null) : null;

  const applied = [
    `${formatDate(from, "long")} — ${formatDate(to, "long")}`,
    farmName && `Farm: ${farmName}`,
    batchCode && `Batch: ${batchCode}`,
    personName && `Recorded by: ${personName}`,
  ].filter((x): x is string => Boolean(x));

  const csv = new URLSearchParams({ report: area, from, to });
  if (farmId) csv.set("farm", farmId);
  if (flockId) csv.set("flock", flockId);
  if (byUserId) csv.set("by", byUserId);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <nav className="flex items-center gap-1.5 text-sm text-ink-faint print:hidden">
        <Link href="/app/reports" className="hover:text-brand">
          Standard Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="text-ink-soft">{meta.label}</span>
      </nav>

      <div className="print:hidden">
        <h1 className="text-2xl font-semibold text-ink">{meta.label} report</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The same reports, narrowed to the question you are asking — one batch, one
          farm, one person, any dates.
        </p>
      </div>


      {/* GET, so the generated report lives in the URL and can be shared. */}
      <form method="get" className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4 print:hidden">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filters
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-faint">Reporting area</span>
            <select name="area" defaultValue={area} className={FIELD}>
              {areas.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-faint">From</span>
            <input type="date" name="from" defaultValue={from} className={FIELD} />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink-faint">To</span>
            <input type="date" name="to" defaultValue={to} className={FIELD} />
          </label>

          {meta.supports.farm && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Farm</span>
              <select name="farm" defaultValue={farmId ?? ""} className={FIELD}>
                <option value="">All farms</option>
                {(farms ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {meta.supports.flock && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Batch</span>
              <select name="flock" defaultValue={flockId ?? ""} className={FIELD}>
                <option value="">All batches</option>
                {batches.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code}
                    {f.name ? ` — ${f.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          {meta.supports.by && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-faint">Recorded by</span>
              <select name="by" defaultValue={byUserId ?? ""} className={FIELD}>
                <option value="">Anyone</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Generate
          </button>

          <a
            href={`/app/reports/export?${csv.toString()}`}
            download
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download CSV
          </a>

          <PrintButton />

          <p className="text-xs text-ink-faint">{meta.description}</p>
        </div>
      </form>

      {rows.length === 0 ? (
        <div className="empty-frame px-4 py-10 text-center">
          <p className="text-sm font-medium text-ink">Nothing matches those filters.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Try a wider date range, or set the batch back to all batches.
          </p>
        </div>
      ) : (
        <Card className="print-sheet print:border-0 print:shadow-none">
          <CardBody className="sm:p-8">
            <ReportDocument
              title={`${meta.label} report`}
              business={business}
              branding={branding}
              covers={applied}
              recordCount={rows.length}
              clientSignOff={area === "financial"}
            >
              {/* On screen a wide report scrolls sideways in its own box. On
                  paper there is nowhere to scroll to, so the box stops
                  constraining and the table is allowed to fit the page. */}
              <div className="scroll-slim overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-max border-collapse text-sm print:min-w-0 print:text-[9px]">
                  <thead>
                    {/* The column band, same weight as an invoice's.
                        print-color-adjust is load-bearing: browsers drop
                        background colours when printing, and paper is exactly
                        where this is meant to be seen. */}
                    <tr className="border-y border-line-strong bg-brand-band text-left text-xs text-brand-dark [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
                      {columns.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className="px-3 py-2.5 font-semibold print:px-1 print:py-1"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((row, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td
                            key={c}
                            className="px-3 py-2 text-ink tnum print:px-1 print:py-0.5"
                          >
                            {row[c] === null || row[c] === "" ? "—" : String(row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportDocument>

            {/* On paper the letterhead carries the count. */}
            <p className="mt-2.5 text-xs text-ink-faint print:hidden">
              Displaying {rows.length} record{rows.length === 1 ? "" : "s"}.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
