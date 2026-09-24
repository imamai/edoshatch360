"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan, getTenantUsage } from "@/lib/data/plan";
import { PLAN_LABEL, withinLimit } from "@/lib/plans";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";

export interface FarmFormState {
  error: string | null;
  ok: string | null;
}

export async function createFarm(
  _prev: FarmFormState,
  form: FormData,
): Promise<FarmFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "What is the farm called?", ok: null };

  // The plan's own number, quoted back. A limit that says "upgrade" without
  // saying what the limit is leaves someone guessing what they bought.
  const [plan, usage] = await Promise.all([
    getTenantPlan(session.tenant.id),
    getTenantUsage(session.tenant.id),
  ]);
  if (!withinLimit(usage.farms, plan.limits.farms)) {
    return {
      error: `The ${PLAN_LABEL[plan.code!]} plan covers ${plan.limits.farms} farm${plan.limits.farms === 1 ? "" : "s"}, and you have ${usage.farms}. Moving up a plan adds more.`,
      ok: null,
    };
  }

  const { error } = await supabase.from("edoshatch360_farms").insert({
    tenant_id: session.tenant.id,
    name,
    location: String(form.get("location") ?? "").trim() || null,
    county: String(form.get("county") ?? "").trim() || null,
  });

  if (error) return { error: "We couldn't add that farm. Try again.", ok: null };

  revalidatePath("/app/farms");
  revalidatePath("/app", "layout");
  return { error: null, ok: `${name} added.` };
}

export async function createHouse(
  _prev: FarmFormState,
  form: FormData,
): Promise<FarmFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const name = String(form.get("name") ?? "").trim();
  const farmId = String(form.get("farm_id") ?? "");
  const capacity = Number(form.get("capacity") ?? 0);

  if (!farmId) return { error: "Which farm is this house on?", ok: null };
  if (!name) return { error: "Give the house a name or number.", ok: null };

  const [plan, usage] = await Promise.all([
    getTenantPlan(session.tenant.id),
    getTenantUsage(session.tenant.id),
  ]);
  if (!withinLimit(usage.houses, plan.limits.houses)) {
    return {
      error: `The ${PLAN_LABEL[plan.code!]} plan covers ${plan.limits.houses} houses, and you have ${usage.houses}. Moving up a plan adds more.`,
      ok: null,
    };
  }

  const { error } = await supabase.from("edoshatch360_houses").insert({
    tenant_id: session.tenant.id,
    farm_id: farmId,
    name,
    code: String(form.get("code") ?? "").trim() || null,
    capacity: Number.isFinite(capacity) && capacity > 0 ? Math.round(capacity) : null,
    house_type: String(form.get("house_type") ?? "").trim() || null,
  });

  if (error) return { error: "We couldn't add that house. Try again.", ok: null };

  revalidatePath("/app/farms");
  return { error: null, ok: `${name} added.` };
}

/** Correct a farm's details — a renamed site, a fixed location. */
export async function updateFarm(
  _prev: FarmFormState,
  form: FormData,
): Promise<FarmFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!id) return { error: "That farm could not be found.", ok: null };
  if (!name) return { error: "What is the farm called?", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_farms")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That farm could not be found.", ok: null };

  const after = {
    name,
    location: String(form.get("location") ?? "").trim() || null,
    county: String(form.get("county") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_farms")
    .update(after)
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "farm.updated",
    entityType: "farm",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/farms");
  revalidatePath("/app", "layout");
  return { error: null, ok: `${name} updated.` };
}

/**
 * Delete a farm outright.
 *
 * Blocked the moment it has a single house or flock on it: a farm cascades
 * to its houses, and a flock cascades further still to every daily record,
 * vaccination, health record and medication logged against it — deleting a
 * farm that has ever been used could silently erase a season's worth of
 * data several tables away from the one being deleted. Only a farm added by
 * mistake, with nothing built on it yet, can be removed this way.
 */
export async function deleteFarm(id: string): Promise<FarmFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const supabase = await createClient();

  const [{ data: farm }, { count: houseCount }, { count: flockCount }] = await Promise.all([
    supabase
      .from("edoshatch360_farms")
      .select("name")
      .eq("id", id)
      .eq("tenant_id", session.tenant.id)
      .maybeSingle(),
    supabase.from("edoshatch360_houses").select("id", { count: "exact", head: true }).eq("farm_id", id),
    supabase.from("edoshatch360_flocks").select("id", { count: "exact", head: true }).eq("farm_id", id),
  ]);

  if (!farm) return { error: "That farm could not be found.", ok: null };
  if ((houseCount ?? 0) > 0 || (flockCount ?? 0) > 0) {
    return {
      error: `${farm.name} has ${flockCount ?? 0} flock${flockCount === 1 ? "" : "s"} and ${houseCount ?? 0} house${houseCount === 1 ? "" : "s"} on it. Deleting it would take all of that with it — move or close them first.`,
      ok: null,
    };
  }

  const { error } = await supabase
    .from("edoshatch360_farms")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that farm. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "farm.deleted",
    entityType: "farm",
    entityId: id,
    before: farm,
  });

  revalidatePath("/app/farms");
  revalidatePath("/app", "layout");
  return { error: null, ok: `${farm.name} deleted.` };
}

/** Correct a house's details — a renamed shed, a corrected capacity. */
export async function updateHouse(
  _prev: FarmFormState,
  form: FormData,
): Promise<FarmFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!id) return { error: "That house could not be found.", ok: null };
  if (!name) return { error: "Give the house a name or number.", ok: null };

  const capacity = Number(form.get("capacity") ?? 0);
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_houses")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That house could not be found.", ok: null };

  const after = {
    name,
    code: String(form.get("code") ?? "").trim() || null,
    capacity: Number.isFinite(capacity) && capacity > 0 ? Math.round(capacity) : null,
    house_type: String(form.get("house_type") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_houses")
    .update(after)
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "house.updated",
    entityType: "house",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/farms");
  return { error: null, ok: `${name} updated.` };
}

/** Take a house off the active list without touching the flocks in it. */
export async function setHouseActive(id: string, active: boolean): Promise<FarmFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edoshatch360_houses")
    .update({ is_active: active })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .select("name")
    .maybeSingle();

  if (error || !data) return { error: "We couldn't change that house. Try again.", ok: null };

  revalidatePath("/app/farms");
  return {
    error: null,
    ok: active ? `${data.name} is back on the list.` : `${data.name} archived.`,
  };
}

/**
 * Delete a house outright.
 *
 * Safe even with flocks currently housed there: edoshatch360_flocks.house_id
 * is ON DELETE SET NULL, so those flocks simply show no house afterwards
 * rather than losing anything — unlike a farm, a house is not where a
 * flock's own records live.
 */
export async function deleteHouse(id: string): Promise<FarmFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const supabase = await createClient();

  const { data: house } = await supabase
    .from("edoshatch360_houses")
    .select("name")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!house) return { error: "That house could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_houses")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that house. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "house.deleted",
    entityType: "house",
    entityId: id,
    before: house,
  });

  revalidatePath("/app/farms");
  return { error: null, ok: `${house.name} deleted.` };
}
