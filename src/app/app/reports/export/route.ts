import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/session";
import { addDays, today } from "@/lib/utils";

/**
 * CSV export for every report (spec §32).
 *
 * The query runs under the caller's own session, so RLS decides what lands in
 * the file — an export can never contain a row the user could not already see
 * on screen.
 */

type Row = Record<string, string | number | null>;

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

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const report = request.nextUrl.searchParams.get("report") ?? "production";
  const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 90)));
  const from = addDays(today(), -days);

  const supabase = await createClient();
  const tenantId = session.tenant.id;

  let rows: Row[] = [];
  let filename = "hatch360-report";

  if (report === "production") {
    const [{ data: records }, { data: flocks }] = await Promise.all([
      supabase
        .from("edoshatch360_daily_records")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("record_date", from)
        .order("record_date", { ascending: false }),
      supabase.from("edoshatch360_flocks").select("id, code, name").eq("tenant_id", tenantId),
    ]);

    const code = new Map((flocks ?? []).map((f) => [f.id, f.code]));
    rows = (records ?? []).map((r) => ({
      Date: r.record_date,
      Flock: code.get(r.flock_id) ?? "",
      Deaths: r.mortality,
      Culls: r.culls,
      "Birds sold": r.birds_sold,
      "Eggs collected": r.eggs_collected,
      "Eggs broken": r.eggs_broken,
      "Eggs rejected": r.eggs_rejected,
      "Feed (kg)": r.feed_consumed_kg,
      "Water (L)": r.water_consumed_liters,
      "Avg weight (g)": r.avg_weight_grams,
      Notes: r.notes,
    }));
    filename = "production";
  }

  if (report === "financial") {
    const [{ data: sales }, { data: expenses }] = await Promise.all([
      supabase
        .from("edoshatch360_sales")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("sale_date", from)
        .order("sale_date", { ascending: false }),
      supabase
        .from("edoshatch360_expenses")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("expense_date", from)
        .order("expense_date", { ascending: false }),
    ]);

    rows = [
      ...(sales ?? []).map((s) => ({
        Date: s.sale_date,
        Type: "Income",
        Category: s.doc_type,
        Reference: s.doc_number,
        Description: s.notes ?? "",
        Amount: (s.total_cents / 100).toFixed(2),
        Paid: (s.amount_paid_cents / 100).toFixed(2),
        Balance: (s.balance_cents / 100).toFixed(2),
      })),
      ...(expenses ?? []).map((e) => ({
        Date: e.expense_date,
        Type: "Expense",
        Category: e.category,
        Reference: e.reference ?? "",
        Description: e.description,
        Amount: (e.amount_cents / 100).toFixed(2),
        Paid: "",
        Balance: "",
      })),
    ].sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
    filename = "financial";
  }

  if (report === "health") {
    const [{ data: vaccinations }, { data: incidents }, { data: flocks }] = await Promise.all([
      supabase.from("edoshatch360_vaccinations").select("*").eq("tenant_id", tenantId),
      supabase
        .from("edoshatch360_health_records")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("occurred_on", from),
      supabase.from("edoshatch360_flocks").select("id, code").eq("tenant_id", tenantId),
    ]);

    const code = new Map((flocks ?? []).map((f) => [f.id, f.code]));
    rows = [
      ...(vaccinations ?? []).map((v) => ({
        Date: v.due_date,
        Flock: code.get(v.flock_id) ?? "",
        Type: "Vaccination",
        Detail: v.vaccine,
        Status: v.status,
        "Given on": v.administered_on ?? "",
        Severity: "",
        "Birds affected": "",
      })),
      ...(incidents ?? []).map((h) => ({
        Date: h.occurred_on,
        Flock: code.get(h.flock_id) ?? "",
        Type: "Health incident",
        Detail: h.title,
        Status: h.event_type,
        "Given on": "",
        Severity: h.severity ?? "",
        "Birds affected": h.birds_affected ?? "",
      })),
    ].sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
    filename = "health";
  }

  if (report === "inventory") {
    const [{ data: items }, { data: movements }] = await Promise.all([
      supabase.from("edoshatch360_inventory").select("*").eq("tenant_id", tenantId),
      supabase
        .from("edoshatch360_inventory_transactions")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("occurred_on", from)
        .order("occurred_on", { ascending: false }),
    ]);

    const name = new Map((items ?? []).map((i) => [i.id, i]));
    rows = (movements ?? []).map((m) => {
      const item = name.get(m.item_id);
      return {
        Date: m.occurred_on,
        Item: item?.name ?? "",
        Category: item?.category ?? "",
        Movement: m.txn_type,
        Quantity: m.quantity,
        Unit: item?.unit ?? "",
        Value: (m.total_cents / 100).toFixed(2),
        Reference: m.reference ?? "",
      };
    });
    filename = "inventory";
  }

  if (report === "flocks") {
    const { data: flocks } = await supabase
      .from("edoshatch360_flocks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("placement_date", { ascending: false });

    rows = await Promise.all(
      (flocks ?? []).map(async (f) => {
        const { data: m } = await supabase.rpc("edoshatch360_flock_metrics", { p_flock: f.id });
        const metrics = m as Record<string, string | number | null> | null;
        return {
          Code: f.code,
          Name: f.name ?? "",
          Type: f.bird_type,
          Breed: f.breed ?? "",
          Placed: f.placement_date,
          "Birds placed": f.placement_count,
          "Birds now": f.current_count,
          "Age (days)": metrics?.age_days ?? "",
          "Mortality %": metrics?.mortality_pct ?? "",
          "Eggs total": metrics?.eggs_total ?? "",
          "Feed (kg)": metrics?.feed_kg ?? "",
          FCR: metrics?.fcr ?? "",
          Status: f.status,
        };
      }),
    );
    filename = "flocks";
  }

  if (rows.length === 0) {
    rows = [{ Note: "No data in this period" }];
  }

  const slug = session.tenant.slug;
  // A BOM so Excel opens UTF-8 correctly rather than mangling accented names.
  const body = `﻿${toCsv(rows)}`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-${filename}-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
