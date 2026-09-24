"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";
import { addDays, today } from "@/lib/utils";
import { CYCLE_DAYS } from "@/lib/catalogues";
import { getTenantPlan, getTenantUsage } from "@/lib/data/plan";
import { PLAN_LABEL, withinLimit } from "@/lib/plans";
import type { BirdType, EntryFrequency, FlockStatus } from "@/lib/database.types";

export interface FlockFormState {
  error: string | null;
  ok?: string | null;
}

export async function createFlock(
  _prev: FlockFormState,
  form: FormData,
): Promise<FlockFormState> {
  const session = await requireSession();

  // Say so before the form is filled in rather than failing at the database
  // with a message about batch numbers that explains nothing.
  if (!can(session.role, CAN_WRITE)) {
    return {
      error:
        "Your account has read-only access to this farm, so you cannot add a flock. An owner or manager can.",
    };
  }

  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  const birdType = String(form.get("bird_type") ?? "") as BirdType;
  const breed = String(form.get("breed") ?? "").trim() || null;
  const houseId = String(form.get("house_id") ?? "") || null;
  const farmId = String(form.get("farm_id") ?? "") || session.farms[0]?.id;
  const count = Number(form.get("placement_count") ?? 0);
  const frequency = (String(form.get("entry_frequency") ?? "daily") || "daily") as EntryFrequency;
  const costPerBird = Number(form.get("cost_per_bird") ?? 0);
  const source = String(form.get("source_hatchery") ?? "").trim() || null;

  // The farmer supplies either the date the birds arrived or how old they are
  // now. Age is the easier answer when birds were placed weeks ago.
  const mode = String(form.get("date_mode") ?? "date");
  const placementDate =
    mode === "age"
      ? addDays(today(), -Math.max(0, Number(form.get("age_days") ?? 0)))
      : String(form.get("placement_date") ?? today());

  if (!farmId) return { error: "This organisation has no farm to attach the flock to." };
  if (!name) return { error: "Give the flock a name you will recognise." };
  if (!birdType) return { error: "Choose what kind of birds these are." };
  if (!Number.isFinite(count) || count <= 0) {
    return { error: "How many birds did you place? Enter a number above zero." };
  }
  if (placementDate > today()) {
    return { error: "The placement date cannot be in the future." };
  }

  // Birds are counted live across running flocks, so closed batches never
  // count against the allowance.
  const [plan, usage] = await Promise.all([
    getTenantPlan(session.tenant.id),
    getTenantUsage(session.tenant.id),
  ]);
  if (!withinLimit(usage.birds, plan.limits.birds, Math.round(count))) {
    return {
      error: `The ${PLAN_LABEL[plan.code!]} plan covers ${plan.limits.birds!.toLocaleString()} birds. You have ${usage.birds.toLocaleString()} and this would place ${Math.round(count).toLocaleString()} more. Moving up a plan adds more.`,
    };
  }

  // Batch code is generated, never typed: farm initials + breed + sequence,
  // e.g. RUI-KEN-003. The breed is what tells two batches on one farm apart;
  // the bird type only stands in when no breed was given. Allocated in
  // Postgres under an advisory lock so two people adding a flock at the same
  // moment cannot collide.
  const { data: code, error: codeError } = await supabase.rpc(
    "edoshatch360_next_flock_code",
    { p_tenant: session.tenant.id, p_farm: farmId, p_bird_type: birdType, p_breed: breed },
  );

  if (codeError || !code) {
    return { error: "We couldn't allocate a batch number. Try saving again." };
  }

  const cycle = CYCLE_DAYS[birdType];

  const { data: created, error } = await supabase
    .from("edoshatch360_flocks")
    .insert({
      tenant_id: session.tenant.id,
      farm_id: farmId,
      house_id: houseId,
      code: code as string,
      name,
      bird_type: birdType,
      breed,
      placement_date: placementDate,
      placement_count: Math.round(count),
      source_hatchery: source,
      cost_per_bird_cents: Math.round(costPerBird * 100),
      expected_harvest_date: cycle ? addDays(placementDate, cycle) : null,
      entry_frequency: frequency,
      status: "brooding",
    })
    .select("id")
    .single();

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "A flock with that code already exists. Try saving again."
          : "We couldn't save that flock. Check your connection and try again.",
    };
  }

  // current_count is maintained by trigger from daily records, which start at
  // zero — seed it to the placed count so the flock reads correctly on day one.
  await supabase
    .from("edoshatch360_flocks")
    .update({ current_count: Math.round(count) })
    .eq("id", created.id);

  revalidatePath("/app/flocks");
  revalidatePath("/app");
  redirect(`/app/flocks/${created.id}`);
}

/**
 * Correct a flock's own details — a fixed name, the right breed, moved to a
 * different house, a corrected placement count.
 *
 * current_count is normally maintained by edoshatch360_daily_recount, which
 * only fires on the daily records table — a change made here to
 * placement_count would otherwise leave it stale until the next record is
 * saved. The same recompute the trigger does is repeated by hand, the same
 * way createFlock already seeds it on day one.
 */
export async function updateFlock(
  _prev: FlockFormState,
  form: FormData,
): Promise<FlockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm, so you cannot change a flock." };
  }

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const placementCount = Number(form.get("placement_count") ?? 0);
  const placementDate = String(form.get("placement_date") ?? "");
  if (!id) return { error: "That flock could not be found." };
  if (!Number.isFinite(placementCount) || placementCount <= 0) {
    return { error: "How many birds were placed? Enter a number above zero." };
  }
  if (placementDate > today()) return { error: "The placement date cannot be in the future." };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_flocks")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That flock could not be found." };

  const { data: losses } = await supabase
    .from("edoshatch360_daily_records")
    .select("mortality, culls, birds_sold")
    .eq("flock_id", id);
  const lost = (losses ?? []).reduce((a, r) => a + r.mortality + r.culls + r.birds_sold, 0);

  const after = {
    name: name || null,
    breed: String(form.get("breed") ?? "").trim() || null,
    house_id: String(form.get("house_id") ?? "") || null,
    placement_date: placementDate || before.placement_date,
    placement_count: Math.round(placementCount),
    current_count: Math.max(0, Math.round(placementCount) - lost),
    source_hatchery: String(form.get("source_hatchery") ?? "").trim() || null,
    cost_per_bird_cents: Math.round(Math.max(0, Number(form.get("cost_per_bird") ?? 0)) * 100),
    notes: String(form.get("notes") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_flocks")
    .update(after)
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "flock.updated",
    entityType: "flock",
    entityId: id,
    before,
    after,
  });

  revalidatePath(`/app/flocks/${id}`);
  revalidatePath("/app/flocks");
  revalidatePath("/app");
  return { error: null, ok: `${before.code} updated.` };
}

/**
 * Close or reopen a flock — the status transition the flock has never had a
 * way to make outright, only ever inferred from whether recent records exist.
 */
export async function setFlockStatus(
  id: string,
  status: FlockStatus,
): Promise<FlockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm." };
  }

  const supabase = await createClient();
  const closing = status === "closed" || status === "harvested";

  const { data, error } = await supabase
    .from("edoshatch360_flocks")
    .update({ status, closed_at: closing ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .select("code")
    .maybeSingle();

  if (error || !data) return { error: "We couldn't change that flock. Try again." };

  revalidatePath(`/app/flocks/${id}`);
  revalidatePath("/app/flocks");
  revalidatePath("/app");
  return { error: null, ok: `${data.code} marked ${status}.` };
}

/**
 * Delete a flock outright.
 *
 * Blocked the moment it has a single daily record, vaccination, health
 * record or medication logged against it — all four cascade on delete, so
 * removing the flock would take a season's worth of data with it. Sales,
 * expenses and stock movements that mention this flock only lose the link
 * (they are ON DELETE SET NULL), which is not enough reason to block on its
 * own. Only a flock added by mistake, with nothing recorded against it yet,
 * can be removed this way — closing is the option for anything real.
 */
export async function deleteFlock(id: string): Promise<FlockFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm." };
  }

  const supabase = await createClient();

  const [{ data: flock }, daily, vacc, health, meds] = await Promise.all([
    supabase
      .from("edoshatch360_flocks")
      .select("code")
      .eq("id", id)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle(),
    supabase.from("edoshatch360_daily_records").select("id", { count: "exact", head: true }).eq("flock_id", id),
    supabase.from("edoshatch360_vaccinations").select("id", { count: "exact", head: true }).eq("flock_id", id),
    supabase.from("edoshatch360_health_records").select("id", { count: "exact", head: true }).eq("flock_id", id),
    supabase.from("edoshatch360_medications").select("id", { count: "exact", head: true }).eq("flock_id", id),
  ]);

  if (!flock) return { error: "That flock could not be found." };

  const recorded = (daily.count ?? 0) + (vacc.count ?? 0) + (health.count ?? 0) + (meds.count ?? 0);
  if (recorded > 0) {
    return {
      error: `${flock.code} has ${recorded} record${recorded === 1 ? "" : "s"} logged against it — daily entries, vaccinations, health or medication. Deleting it would erase all of that. Close it instead.`,
    };
  }

  const { error } = await supabase
    .from("edoshatch360_flocks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that flock. Try again." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "flock.deleted",
    entityType: "flock",
    entityId: id,
    before: flock,
  });

  revalidatePath("/app/flocks");
  revalidatePath("/app");
  return { error: null, ok: `${flock.code} deleted.` };
}
