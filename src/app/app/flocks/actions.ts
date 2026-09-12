"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { addDays, today } from "@/lib/utils";
import { CYCLE_DAYS } from "@/lib/catalogues";
import { getTenantPlan, getTenantUsage } from "@/lib/data/plan";
import { PLAN_LABEL, withinLimit } from "@/lib/plans";
import type { BirdType, EntryFrequency } from "@/lib/database.types";

export interface FlockFormState {
  error: string | null;
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
