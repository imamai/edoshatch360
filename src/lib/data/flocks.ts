import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/utils";
import type {
  DailyRecord, Flock, FlockMetrics, HealthRecord, House, Medication, Vaccination,
} from "@/lib/database.types";

export async function getFlocks(
  tenantId: string,
  opts: { includeClosed?: boolean } = {},
): Promise<Flock[]> {
  const supabase = await createClient();
  let query = supabase
    .from("edoshatch360_flocks")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("placement_date", { ascending: false });

  if (!opts.includeClosed) query = query.not("status", "in", "(closed,harvested)");

  const { data } = await query;
  return (data ?? []) as Flock[];
}

export async function getFlock(flockId: string): Promise<Flock | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_flocks")
    .select("*")
    .eq("id", flockId)
    .maybeSingle();
  return (data as Flock) ?? null;
}

export async function getFlockMetrics(flockId: string): Promise<FlockMetrics | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("edoshatch360_flock_metrics", { p_flock: flockId });
  return (data as FlockMetrics) ?? null;
}

export async function getRecordForDate(
  flockId: string,
  date: string,
): Promise<DailyRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_daily_records")
    .select("*")
    .eq("flock_id", flockId)
    .eq("record_date", date)
    .maybeSingle();
  return (data as DailyRecord) ?? null;
}

export async function getRecentRecords(
  flockId: string,
  limit = 60,
): Promise<DailyRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_daily_records")
    .select("*")
    .eq("flock_id", flockId)
    .order("record_date", { ascending: false })
    .limit(limit);
  return (data ?? []) as DailyRecord[];
}

export async function getHouses(
  tenantId: string,
  /** Archived houses too — only the farms management screen wants these. */
  includeInactive = false,
): Promise<House[]> {
  const supabase = await createClient();
  let query = supabase.from("edoshatch360_houses").select("*").eq("tenant_id", tenantId).order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data } = await query;
  return (data ?? []) as House[];
}

export interface FlockHealthBundle {
  vaccinations: Vaccination[];
  medications: Medication[];
  incidents: HealthRecord[];
}

export async function getFlockHealth(flockId: string): Promise<FlockHealthBundle> {
  const supabase = await createClient();
  const [vaccinations, medications, incidents] = await Promise.all([
    supabase.from("edoshatch360_vaccinations").select("*").eq("flock_id", flockId).order("due_date"),
    supabase.from("edoshatch360_medications").select("*").eq("flock_id", flockId).order("started_on", { ascending: false }),
    supabase.from("edoshatch360_health_records").select("*").eq("flock_id", flockId).order("occurred_on", { ascending: false }),
  ]);

  return {
    vaccinations: (vaccinations.data ?? []) as Vaccination[],
    medications: (medications.data ?? []) as Medication[],
    incidents: (incidents.data ?? []) as HealthRecord[],
  };
}

/**
 * Consecutive days of recording, counting back from today.
 *
 * A streak survives "not recorded yet today" — it only breaks once yesterday
 * is also missed. Punishing someone at 9am for not having recorded a day that
 * is still in progress would make the number useless.
 */
export function computeStreak(records: Pick<DailyRecord, "record_date">[]): number {
  if (records.length === 0) return 0;

  const dates = [...new Set(records.map((r) => r.record_date))].sort().reverse();
  const t = today();
  const yesterday = addDays(t, -1);

  if (dates[0] !== t && dates[0] !== yesterday) return 0;

  let streak = 1;
  let cursor = dates[0];
  for (let i = 1; i < dates.length; i++) {
    const expected = addDays(cursor, -1);
    if (dates[i] === expected) {
      streak++;
      cursor = expected;
    } else {
      break;
    }
  }
  return streak;
}

/** Days since the flock was placed. */
export function flockAgeDays(flock: Flock, on = today()): number {
  const a = new Date(`${flock.placement_date}T12:00:00`).getTime();
  const b = new Date(`${on}T12:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Does this bird type lay eggs worth recording? */
export function laysEggs(flock: Flock): boolean {
  return ["layer", "kienyeji", "improved_kienyeji", "breeder"].includes(flock.bird_type);
}

export const BIRD_TYPE_LABEL: Record<Flock["bird_type"], string> = {
  broiler: "Broiler",
  layer: "Layer",
  kienyeji: "Kienyeji",
  improved_kienyeji: "Improved kienyeji",
  breeder: "Breeder",
  chick: "Chicks",
  pullet: "Pullet",
  turkey: "Turkey",
  other: "Other",
};

export const FLOCK_STATUS_LABEL: Record<Flock["status"], string> = {
  planned: "Planned",
  brooding: "Brooding",
  growing: "Growing",
  laying: "Laying",
  finishing: "Finishing",
  harvested: "Harvested",
  closed: "Closed",
};