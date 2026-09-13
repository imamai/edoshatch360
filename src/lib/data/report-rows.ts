import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The rows behind every report, in one place.
 *
 * Both the CSV route and the custom-report screen call this, so what you see
 * on screen and what lands in the file are the same query — they cannot drift.
 * No new figures live here: these are exactly the five reports the app has
 * always exported, now answerable for one farm, one batch or one person
 * instead of only for everything at once.
 *
 * Every query runs under the caller's own session, so RLS decides what comes
 * back. A filter can narrow a report; it can never widen one.
 */

export type ReportKey = "production" | "flocks" | "health" | "inventory" | "financial";

export type Row = Record<string, string | number | null>;

export interface ReportFilters {
  report: ReportKey;
  /** Inclusive, YYYY-MM-DD. */
  from: string;
  to: string;
  farmId?: string | null;
  /** A flock is a batch — the RUI-LAY-KEN-001 code the farmer knows it by. */
  flockId?: string | null;
  /** Who recorded it. */
  byUserId?: string | null;
}

/**
 * Which filters each area can honestly answer, so the screen never offers a
 * control that would silently do nothing.
 *
 *   farm  — the report reaches a farm, directly or through its flocks
 *   flock — the report is per batch
 *   by    — the rows remember who entered them
 */
export interface ReportArea {
  key: ReportKey;
  label: string;
  description: string;
  supports: { farm: boolean; flock: boolean; by: boolean };
}

export const REPORT_AREAS: ReportArea[] = [
  {
    key: "production",
    label: "Production",
    description: "Daily records: eggs, deaths, culls, feed, water and weights.",
    supports: { farm: true, flock: true, by: true },
  },
  {
    key: "flocks",
    label: "Flock performance",
    description: "One row per batch with age, mortality, eggs, feed and FCR.",
    supports: { farm: true, flock: true, by: false },
  },
  {
    key: "health",
    label: "Health",
    description: "The vaccination programme and every disease incident.",
    supports: { farm: true, flock: true, by: false },
  },
  {
    key: "inventory",
    label: "Inventory movements",
    description: "Purchases, usage, wastage and corrections.",
    supports: { farm: false, flock: true, by: true },
  },
  {
    key: "financial",
    label: "Financial",
    description: "Income and expenses, with paid and outstanding amounts.",
    supports: { farm: true, flock: true, by: false },
  },
];

export function isReportKey(value: string | null | undefined): value is ReportKey {
  return REPORT_AREAS.some((a) => a.key === value);
}

export function areaFor(key: ReportKey): ReportArea {
  return REPORT_AREAS.find((a) => a.key === key)!;
}

/**
 * Resolve a farm to its batches, so reports hanging off a flock can still be
 * asked a farm-shaped question. Returns null when no farm filter is set.
 */
async function flockIdsForFarm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  farmId: string | null | undefined,
): Promise<string[] | null> {
  if (!farmId) return null;
  const { data } = await supabase
    .from("edoshatch360_flocks")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("farm_id", farmId);
  return (data ?? []).map((f) => f.id as string);
}

/**
 * Narrow a candidate flock list to the one batch asked for, if any. An empty
 * array means "nothing can match", which is a real answer, not a missing one.
 */
function narrow(ids: string[] | null, flockId: string | null | undefined): string[] | null {
  if (!flockId) return ids;
  if (ids === null) return [flockId];
  return ids.includes(flockId) ? [flockId] : [];
}

export async function buildReportRows(
  tenantId: string,
  filters: ReportFilters,
): Promise<{ rows: Row[]; filename: string }> {
  const supabase = await createClient();
  const { report, from, to, farmId, flockId, byUserId } = filters;

  const farmFlocks = await flockIdsForFarm(supabase, tenantId, farmId);
  const flockIds = narrow(farmFlocks, flockId);

  if (report === "production") {
    let q = supabase
      .from("edoshatch360_daily_records")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("record_date", from)
      .lte("record_date", to)
      .order("record_date", { ascending: false });

    if (flockIds !== null) q = q.in("flock_id", flockIds);
    if (byUserId) q = q.eq("recorded_by", byUserId);

    const [{ data: records }, { data: flocks }, { data: people }] = await Promise.all([
      q,
      supabase.from("edoshatch360_flocks").select("id, code").eq("tenant_id", tenantId),
      supabase.from("edoshatch360_users").select("id, full_name, email"),
    ]);

    const code = new Map((flocks ?? []).map((f) => [f.id, f.code]));
    const who = new Map(
      (people ?? []).map((u) => [u.id, (u.full_name as string | null) ?? (u.email as string)]),
    );

    return {
      filename: "production",
      rows: (records ?? []).map((r) => ({
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
        "Recorded by": r.recorded_by ? (who.get(r.recorded_by) ?? "") : "",
        Notes: r.notes,
      })),
    };
  }

  if (report === "flocks") {
    let q = supabase
      .from("edoshatch360_flocks")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("placement_date", { ascending: false });

    if (farmId) q = q.eq("farm_id", farmId);
    if (flockId) q = q.eq("id", flockId);

    const { data: flocks } = await q;

    const rows = await Promise.all(
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
        } as Row;
      }),
    );

    return { filename: "flocks", rows };
  }

  if (report === "health") {
    let vq = supabase
      .from("edoshatch360_vaccinations")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("due_date", from)
      .lte("due_date", to);

    let hq = supabase
      .from("edoshatch360_health_records")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("occurred_on", from)
      .lte("occurred_on", to);

    if (flockIds !== null) {
      vq = vq.in("flock_id", flockIds);
      hq = hq.in("flock_id", flockIds);
    }

    const [{ data: vaccinations }, { data: incidents }, { data: flocks }] = await Promise.all([
      vq,
      hq,
      supabase.from("edoshatch360_flocks").select("id, code").eq("tenant_id", tenantId),
    ]);

    const code = new Map((flocks ?? []).map((f) => [f.id, f.code]));

    const rows: Row[] = [
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

    return { filename: "health", rows };
  }

  if (report === "inventory") {
    let q = supabase
      .from("edoshatch360_inventory_transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false });

    if (flockId) q = q.eq("flock_id", flockId);
    if (byUserId) q = q.eq("created_by", byUserId);

    const [{ data: movements }, { data: items }] = await Promise.all([
      q,
      supabase.from("edoshatch360_inventory").select("*").eq("tenant_id", tenantId),
    ]);

    const byId = new Map((items ?? []).map((i) => [i.id, i]));

    return {
      filename: "inventory",
      rows: (movements ?? []).map((m) => {
        const item = byId.get(m.item_id);
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
      }),
    };
  }

  // financial
  let sq = supabase
    .from("edoshatch360_sales")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("sale_date", from)
    .lte("sale_date", to)
    .order("sale_date", { ascending: false });

  let eq_ = supabase
    .from("edoshatch360_expenses")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false });

  if (farmId) {
    sq = sq.eq("farm_id", farmId);
    eq_ = eq_.eq("farm_id", farmId);
  }
  // Only an expense is tied to a batch; a sale document is not. Asking for one
  // batch therefore asks about its costs, and the income side stays empty
  // rather than being quietly filled with everything.
  if (flockId) eq_ = eq_.eq("flock_id", flockId);

  const [{ data: sales }, { data: expenses }] = await Promise.all([
    flockId ? Promise.resolve({ data: [] as Record<string, never>[] }) : sq,
    eq_,
  ]);

  const rows: Row[] = [
    ...((sales ?? []) as Record<string, string | number>[]).map((s) => ({
      Date: s.sale_date,
      Type: "Income",
      Category: s.doc_type,
      Reference: s.doc_number,
      Description: (s.notes as string | null) ?? "",
      Amount: ((s.total_cents as number) / 100).toFixed(2),
      Paid: ((s.amount_paid_cents as number) / 100).toFixed(2),
      Balance: ((s.balance_cents as number) / 100).toFixed(2),
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

  return { filename: "financial", rows };
}
