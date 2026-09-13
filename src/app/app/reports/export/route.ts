import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/data/session";
import { addDays, today } from "@/lib/utils";
import { buildReportRows, isReportKey, type Row } from "@/lib/data/report-rows";

/**
 * CSV export for every report (spec §32).
 *
 * The rows come from buildReportRows, the same function the custom-report
 * screen renders from, so the file always matches what was previewed. The
 * query runs under the caller's own session, so RLS decides what lands in the
 * file — an export can never contain a row the user could not already see.
 *
 * Accepts either the standard page's `days`, or an explicit `from`/`to` plus
 * the farm, flock and recorded-by filters the custom screen sets.
 */

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection. */
function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);

  const cell = (value: string | number | null): string => {
    if (value === null || value === undefined) return "";
    let s = String(value);
    // A leading =, +, - or @ is executed as a formula by Excel and Sheets.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => cell(r[h])).join(",")),
  ].join("\r\n");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams;

  const reportParam = q.get("report");
  const report = isReportKey(reportParam) ? reportParam : "production";

  const days = Math.min(365, Math.max(1, Number(q.get("days") ?? 90)));
  const toParam = q.get("to");
  const fromParam = q.get("from");

  const to = toParam && DATE.test(toParam) ? toParam : today();
  const from =
    fromParam && DATE.test(fromParam) ? fromParam : addDays(to, -days);

  const { rows, filename } = await buildReportRows(session.tenant.id, {
    report,
    from,
    to,
    farmId: q.get("farm"),
    flockId: q.get("flock"),
    byUserId: q.get("by"),
  });

  const body = rows.length === 0 ? [{ Note: "No data for these filters" }] : rows;

  const slug = session.tenant.slug;
  // A BOM so Excel opens UTF-8 correctly rather than mangling accented names.
  const csv = `﻿${toCsv(body)}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${filename}-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
