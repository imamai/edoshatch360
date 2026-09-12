// Guard: a client component importing anything from here would otherwise fail
// with a confusing "next/headers" error from three modules away. This makes
// the mistake say what it actually is.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/utils";
import type {
  DailyRecord, Expense, Farm, Flock, InventoryItem, Sale, Vaccination,
} from "@/lib/database.types";

export interface DashboardData {
  flocks: Flock[];
  farms: Farm[];
  /** Daily records for the last 60 days, newest first. */
  records: DailyRecord[];
  lowStock: InventoryItem[];
  dueVaccinations: Vaccination[];
  sales: Sale[];
  expenses: Expense[];
}

/**
 * One pass over everything the dashboard needs.
 *
 * The window is deliberately 60 days: enough to compare this week against
 * last and this month against last, and small enough that the aggregation
 * below stays trivial in memory rather than becoming six more round trips.
 */
export async function getDashboardData(tenantId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const since = addDays(today(), -60);
  // Money goes back six months so the revenue-vs-expenses chart has a real
  // trend to show rather than a single bar for the current month.
  const moneySince = monthsAgoStart(5);

  const [flocks, farms, records, inventory, vaccinations, sales, expenses] =
    await Promise.all([
      supabase
        .from("edoshatch360_flocks")
        .select("*")
        .eq("tenant_id", tenantId)
        .not("status", "in", "(closed,harvested)")
        .order("placement_date", { ascending: false }),
      supabase
        .from("edoshatch360_farms")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("edoshatch360_daily_records")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("record_date", since)
        .order("record_date", { ascending: false }),
      supabase
        .from("edoshatch360_inventory")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),
      supabase
        .from("edoshatch360_vaccinations")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("status", ["due", "overdue"])
        .lte("due_date", addDays(today(), 7))
        .order("due_date"),
      supabase
        .from("edoshatch360_sales")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("sale_date", moneySince)
        .neq("status", "cancelled")
        .in("doc_type", ["invoice", "receipt"]),
      supabase
        .from("edoshatch360_expenses")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("expense_date", moneySince),
    ]);

  const items = (inventory.data ?? []) as InventoryItem[];

  return {
    flocks: (flocks.data ?? []) as Flock[],
    farms: (farms.data ?? []) as Farm[],
    records: (records.data ?? []) as DailyRecord[],
    // Reorder level of 0 means "not tracked", not "always low".
    lowStock: items.filter((i) => i.reorder_level > 0 && i.current_stock <= i.reorder_level),
    dueVaccinations: (vaccinations.data ?? []) as Vaccination[],
    sales: (sales.data ?? []) as Sale[],
    expenses: (expenses.data ?? []) as Expense[],
  };
}

export interface Kpis {
  totalBirds: number;
  activeFlocks: number;
  eggsToday: number;
  eggsYesterday: number;
  mortalityPct: number;
  mortalityPctPrev: number;
  feedKg7: number;
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
  marginPct: number;
  eggsDelta: number | null;
  recordedToday: boolean;
}

/** Percentage change from `prev` to `curr`, or null when there is no base. */
function delta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function computeKpis(data: DashboardData): Kpis {
  const t = today();
  const yesterday = addDays(t, -1);
  const weekAgo = addDays(t, -7);
  const twoWeeksAgo = addDays(t, -14);

  const sumOn = (date: string, field: keyof DailyRecord) =>
    data.records
      .filter((r) => r.record_date === date)
      .reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

  const sumBetween = (from: string, to: string, field: keyof DailyRecord) =>
    data.records
      .filter((r) => r.record_date > from && r.record_date <= to)
      .reduce((acc, r) => acc + (Number(r[field]) || 0), 0);

  const totalBirds = data.flocks.reduce((a, f) => a + f.current_count, 0);
  const placed = data.flocks.reduce((a, f) => a + f.placement_count, 0);

  const deathsAll = data.records.reduce((a, r) => a + r.mortality + r.culls, 0);
  const deathsPrev7 =
    sumBetween(twoWeeksAgo, weekAgo, "mortality") + sumBetween(twoWeeksAgo, weekAgo, "culls");

  const eggsToday = sumOn(t, "eggs_collected");
  const eggsYesterday = sumOn(yesterday, "eggs_collected");

  // data.sales / data.expenses span six months for the charts; the KPI tiles
  // are explicitly "this month", so they are filtered here rather than at
  // fetch time.
  const thisMonth = t.slice(0, 7);
  const revenueCents = data.sales
    .filter((s) => s.sale_date.startsWith(thisMonth))
    .reduce((a, s) => a + s.total_cents, 0);
  const expensesCents = data.expenses
    .filter((e) => e.expense_date.startsWith(thisMonth))
    .reduce((a, e) => a + e.amount_cents, 0);
  const profitCents = revenueCents - expensesCents;

  return {
    totalBirds,
    activeFlocks: data.flocks.length,
    eggsToday,
    eggsYesterday,
    // Cumulative mortality across every flock currently on the farm.
    mortalityPct: placed > 0 ? (deathsAll / placed) * 100 : 0,
    mortalityPctPrev: totalBirds > 0 ? (deathsPrev7 / totalBirds) * 100 : 0,
    feedKg7: sumBetween(weekAgo, t, "feed_consumed_kg"),
    revenueCents,
    expensesCents,
    profitCents,
    marginPct: revenueCents > 0 ? (profitCents / revenueCents) * 100 : 0,
    eggsDelta: delta(eggsToday, eggsYesterday),
    recordedToday: data.records.some((r) => r.record_date === t),
  };
}

export type AlertTone = "critical" | "attention" | "info";

export interface FarmAlert {
  id: string;
  tone: AlertTone;
  title: string;
  body: string;
  href: string;
}

/**
 * Alerts are derived, not stored — they reflect the data as it is right now,
 * so one cannot linger after the situation it described has been resolved.
 * Deliberately few: spec §23 warns against burying farmers in notifications.
 */
export function computeAlerts(data: DashboardData): FarmAlert[] {
  const alerts: FarmAlert[] = [];
  const t = today();
  const weekAgo = addDays(t, -7);

  for (const flock of data.flocks) {
    const flockRecords = data.records.filter((r) => r.flock_id === flock.id);
    const deaths7 = flockRecords
      .filter((r) => r.record_date > weekAgo)
      .reduce((a, r) => a + r.mortality + r.culls, 0);

    // More than 1% of the live flock lost in a week warrants a look.
    if (flock.current_count > 0 && deaths7 / flock.current_count > 0.01) {
      alerts.push({
        id: `mort-${flock.id}`,
        tone: "critical",
        title: `High mortality in ${flock.code}`,
        body: `${deaths7} birds lost in the last 7 days — ${((deaths7 / flock.current_count) * 100).toFixed(1)}% of the flock.`,
        href: `/app/flocks/${flock.id}`,
      });
    }

    const lastRecord = flockRecords[0]?.record_date;
    if (flock.entry_frequency === "daily") {
      const gap = lastRecord ? Number(new Date(`${t}T12:00:00`) > new Date(`${lastRecord}T12:00:00`)) : 0;
      if (!lastRecord) {
        alerts.push({
          id: `norec-${flock.id}`,
          tone: "attention",
          title: `${flock.code} has no records yet`,
          body: "Record one day and the numbers on this dashboard start working.",
          href: `/app/record?flock=${flock.id}`,
        });
      } else if (gap && lastRecord < addDays(t, -2)) {
        alerts.push({
          id: `stale-${flock.id}`,
          tone: "attention",
          title: `${flock.code} not recorded since ${lastRecord}`,
          body: "Gaps make mortality and feed figures unreliable.",
          href: `/app/record?flock=${flock.id}`,
        });
      }
    }
  }

  for (const item of data.lowStock) {
    alerts.push({
      id: `stock-${item.id}`,
      tone: item.current_stock <= 0 ? "critical" : "attention",
      title:
        item.current_stock <= 0
          ? `${item.name} is finished`
          : `${item.name} is below reorder level`,
      body: `${item.current_stock} ${item.unit} left · reorder at ${item.reorder_level} ${item.unit}.`,
      href: "/app/inventory",
    });
  }

  const overdue = data.dueVaccinations.filter((v) => v.due_date < t);
  if (overdue.length > 0) {
    alerts.push({
      id: "vacc-overdue",
      tone: "critical",
      title: `${overdue.length} vaccination${overdue.length > 1 ? "s" : ""} overdue`,
      body: overdue.map((v) => v.vaccine).slice(0, 3).join(", "),
      href: "/app/health",
    });
  }

  const dueSoon = data.dueVaccinations.filter((v) => v.due_date >= t);
  if (dueSoon.length > 0) {
    alerts.push({
      id: "vacc-due",
      tone: "info",
      title: `${dueSoon.length} vaccination${dueSoon.length > 1 ? "s" : ""} due this week`,
      body: dueSoon.map((v) => `${v.vaccine} on ${v.due_date}`).slice(0, 3).join(" · "),
      href: "/app/health",
    });
  }

  const order: Record<AlertTone, number> = { critical: 0, attention: 1, info: 2 };
  return alerts.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
}

/* --------------------------------------------------------- chart series --

   Every series below is built from the single 60-day / 6-month payload
   already fetched above, so adding a chart to the dashboard costs no extra
   database round trips.                                                     */

/** First day of the month `n` months before the current one, as YYYY-MM-01. */
function monthsAgoStart(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.toLocaleDateString("en-CA").slice(0, 7)}-01`;
}

export interface DaySeriesPoint {
  date: string;
  eggs: number;
  deaths: number;
  kg: number;
}

/** Per-day totals for the last `days` days, oldest first. */
export function daySeries(data: DashboardData, days = 14): DaySeriesPoint[] {
  const out: DaySeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today(), -i);
    const rows = data.records.filter((r) => r.record_date === date);
    out.push({
      date,
      eggs: rows.reduce((a, r) => a + (r.eggs_collected ?? 0), 0),
      deaths: rows.reduce((a, r) => a + r.mortality + r.culls, 0),
      kg: rows.reduce((a, r) => a + Number(r.feed_consumed_kg ?? 0), 0),
    });
  }
  return out;
}

/** Revenue and expenses per calendar month, oldest first. */
export function moneySeries(data: DashboardData, months = 6) {
  const out: { label: string; month: string; revenue: number; expenses: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const month = d.toLocaleDateString("en-CA").slice(0, 7);
    out.push({
      month,
      label: d.toLocaleDateString("en-KE", { month: "short" }),
      revenue: data.sales
        .filter((s) => s.sale_date.startsWith(month))
        .reduce((a, s) => a + s.total_cents, 0),
      expenses: data.expenses
        .filter((e) => e.expense_date.startsWith(month))
        .reduce((a, e) => a + e.amount_cents, 0),
    });
  }
  return out;
}

/** Expense totals by category for the current month, largest first. */
export function expenseBreakdown(data: DashboardData) {
  const month = today().slice(0, 7);
  const totals = new Map<string, number>();

  for (const e of data.expenses) {
    if (!e.expense_date.startsWith(month)) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount_cents);
  }

  return [...totals.entries()]
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

/** Eggs collected per flock over the last `days` days — the house comparison. */
export function flockComparison(data: DashboardData, days = 7) {
  const from = addDays(today(), -days);

  return data.flocks
    .map((flock) => ({
      name: flock.code,
      value: data.records
        .filter((r) => r.flock_id === flock.id && r.record_date > from)
        .reduce((a, r) => a + (r.eggs_collected ?? 0), 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

/** Live birds per flock — the composition of the farm right now. */
export function flockComposition(data: DashboardData) {
  return data.flocks
    .filter((f) => f.current_count > 0)
    .map((f) => ({ name: f.code, value: f.current_count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}
