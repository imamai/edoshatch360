"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";
import { addDays, today } from "@/lib/utils";
import type { BirdType } from "@/lib/database.types";

export interface HealthFormState {
  error: string | null;
  ok: string | null;
}

/**
 * Standard Kenyan poultry vaccination programmes, by day of age.
 *
 * These are the common commercial schedules used as a starting point — the
 * farmer edits or removes any dose. Hatch360 schedules and reminds; it does
 * not prescribe, and the UI says so.
 */
const PROGRAMMES: Partial<Record<BirdType, { day: number; vaccine: string; target: string }[]>> = {
  broiler: [
    { day: 7, vaccine: "Newcastle disease (NDV) — Hitchner B1", target: "Newcastle" },
    { day: 14, vaccine: "Infectious bursal disease (Gumboro)", target: "Gumboro" },
    { day: 18, vaccine: "Gumboro booster", target: "Gumboro" },
    { day: 21, vaccine: "Newcastle disease (Lasota) booster", target: "Newcastle" },
  ],
  layer: [
    { day: 7, vaccine: "Newcastle disease (NDV) — Hitchner B1", target: "Newcastle" },
    { day: 14, vaccine: "Infectious bursal disease (Gumboro)", target: "Gumboro" },
    { day: 21, vaccine: "Newcastle disease (Lasota) booster", target: "Newcastle" },
    { day: 28, vaccine: "Infectious bronchitis (IB)", target: "Bronchitis" },
    { day: 42, vaccine: "Fowl pox", target: "Fowl pox" },
    { day: 56, vaccine: "Fowl typhoid", target: "Typhoid" },
    { day: 112, vaccine: "Newcastle disease — pre-lay booster", target: "Newcastle" },
  ],
  kienyeji: [
    { day: 7, vaccine: "Newcastle disease (NDV) — Hitchner B1", target: "Newcastle" },
    { day: 21, vaccine: "Newcastle disease (Lasota) booster", target: "Newcastle" },
    { day: 42, vaccine: "Fowl pox", target: "Fowl pox" },
    { day: 56, vaccine: "Fowl typhoid", target: "Typhoid" },
  ],
};
PROGRAMMES.improved_kienyeji = PROGRAMMES.kienyeji;
PROGRAMMES.pullet = PROGRAMMES.layer;
PROGRAMMES.breeder = PROGRAMMES.layer;
PROGRAMMES.chick = PROGRAMMES.broiler;

export async function applyVaccinationProgramme(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  const supabase = await createClient();
  const flockId = String(form.get("flock_id") ?? "");

  if (!flockId) return { error: "Choose a flock first.", ok: null };

  const { data: flock } = await supabase
    .from("edoshatch360_flocks")
    .select("id, bird_type, placement_date, code")
    .eq("id", flockId)
    .maybeSingle();

  if (!flock) return { error: "That flock could not be found.", ok: null };

  const programme = PROGRAMMES[flock.bird_type as BirdType];
  if (!programme) {
    return {
      error: `There is no standard programme for ${flock.bird_type} birds. Add doses individually below.`,
      ok: null,
    };
  }

  const { data: existing } = await supabase
    .from("edoshatch360_vaccinations")
    .select("day_of_age")
    .eq("flock_id", flockId);

  const taken = new Set((existing ?? []).map((v) => v.day_of_age));
  const rows = programme
    .filter((p) => !taken.has(p.day))
    .map((p) => ({
      tenant_id: session.tenant.id,
      flock_id: flockId,
      vaccine: p.vaccine,
      disease_target: p.target,
      day_of_age: p.day,
      due_date: addDays(flock.placement_date, p.day),
      // A dose whose date has already passed is recorded as overdue, not
      // silently marked done — the farmer decides what actually happened.
      status: addDays(flock.placement_date, p.day) < today() ? "overdue" : "due",
    }));

  if (rows.length === 0) {
    return { error: null, ok: `${flock.code} already has the full programme scheduled.` };
  }

  const { error } = await supabase.from("edoshatch360_vaccinations").insert(rows);
  if (error) return { error: "We couldn't save the schedule. Try again.", ok: null };

  revalidatePath("/app/health");
  return { error: null, ok: `${rows.length} doses scheduled for ${flock.code}.` };
}

/**
 * Records a dose as actually given.
 *
 * A vaccination record is only worth keeping if it says who did it: a
 * withdrawal query, a disease investigation or a buyer's audit all start with
 * "who administered this, and who watched". Both are captured as a system user
 * where there is one and as a plain name where there is not — a visiting vet
 * will not have an account.
 */
export async function recordVaccinationGiven(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const supabase = await createClient();
  const id = String(form.get("id") ?? "");
  if (!id) return { error: "Which dose?", ok: null };

  const administeredBy = String(form.get("administered_by") ?? "");
  const supervisedBy = String(form.get("supervised_by") ?? "");
  const administeredName = String(form.get("administered_name") ?? "").trim();

  if (!administeredBy && !administeredName) {
    return { error: "Who gave this dose? Pick a person or type a name.", ok: null };
  }

  const birds = Number(form.get("birds_covered") ?? 0);
  const cost = Number(form.get("cost") ?? 0);
  const givenOn = String(form.get("administered_on") ?? today());

  if (givenOn > today()) {
    return { error: "A dose cannot be recorded as given in the future.", ok: null };
  }

  const { error } = await supabase
    .from("edoshatch360_vaccinations")
    .update({
      status: "done",
      administered_on: givenOn,
      administered_by: administeredBy || null,
      administered_name: administeredName || null,
      supervised_by: supervisedBy || null,
      supervisor_name: String(form.get("supervisor_name") ?? "").trim() || null,
      route: String(form.get("route") ?? "").trim() || null,
      dose: String(form.get("dose") ?? "").trim() || null,
      manufacturer: String(form.get("manufacturer") ?? "").trim() || null,
      batch_no: String(form.get("batch_no") ?? "").trim() || null,
      expiry_date: String(form.get("expiry_date") ?? "") || null,
      birds_covered: Number.isFinite(birds) && birds > 0 ? Math.round(birds) : null,
      cost_cents: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) : 0,
      reaction_notes: String(form.get("reaction_notes") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { error: "We couldn't save that. Try again.", ok: null };

  revalidatePath("/app/health");
  revalidatePath("/app");
  return { error: null, ok: "Recorded as given." };
}

export async function addVaccination(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const flockId = String(form.get("flock_id") ?? "");
  const vaccine = String(form.get("vaccine") ?? "").trim();
  const dueDate = String(form.get("due_date") ?? "");

  if (!flockId) return { error: "Choose a flock.", ok: null };
  if (!vaccine) return { error: "Which vaccine?", ok: null };
  if (!dueDate) return { error: "When is it due?", ok: null };

  const { error } = await supabase.from("edoshatch360_vaccinations").insert({
    tenant_id: session.tenant.id,
    flock_id: flockId,
    vaccine,
    disease_target: String(form.get("disease_target") ?? "").trim() || null,
    due_date: dueDate,
    route: String(form.get("route") ?? "").trim() || null,
    dose: String(form.get("dose") ?? "").trim() || null,
    manufacturer: String(form.get("manufacturer") ?? "").trim() || null,
    status: dueDate < today() ? "overdue" : "due",
  });

  if (error) return { error: "We couldn't save that. Try again.", ok: null };

  revalidatePath("/app/health");
  return { error: null, ok: `${vaccine} scheduled.` };
}

export async function addHealthIncident(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const flockId = String(form.get("flock_id") ?? "");
  const title = String(form.get("title") ?? "").trim();

  if (!flockId) return { error: "Choose a flock.", ok: null };
  if (!title) return { error: "Give the incident a short title.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("edoshatch360_health_records").insert({
    tenant_id: session.tenant.id,
    flock_id: flockId,
    event_type: "disease_incident",
    occurred_on: String(form.get("occurred_on") ?? today()),
    title,
    symptoms: String(form.get("symptoms") ?? "").trim() || null,
    treatment: String(form.get("treatment") ?? "").trim() || null,
    severity: String(form.get("severity") ?? "medium"),
    birds_affected: Number(form.get("birds_affected") ?? 0) || null,
    recorded_by: user?.id ?? null,
  });

  if (error) return { error: "We couldn't save that. Try again.", ok: null };

  revalidatePath("/app/health");
  revalidatePath("/app");
  return { error: null, ok: "Incident recorded." };
}

/**
 * Correct a dose scheduled or given wrong — the vaccine, the date, who gave
 * it, the batch. Nothing here depends on a vaccination row the way a flock's
 * bird count depends on daily records, so there is no derived figure to keep
 * in step; this is a plain field-by-field correction.
 */
export async function updateVaccination(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const vaccine = String(form.get("vaccine") ?? "").trim();
  const dueDate = String(form.get("due_date") ?? "");
  if (!id) return { error: "That dose could not be found.", ok: null };
  if (!vaccine) return { error: "Which vaccine?", ok: null };
  if (!dueDate) return { error: "When is it due?", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_vaccinations")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That dose could not be found.", ok: null };

  const administeredOn = String(form.get("administered_on") ?? "") || null;
  if (administeredOn && administeredOn > today()) {
    return { error: "A dose cannot be given in the future.", ok: null };
  }

  const cost = Number(form.get("cost") ?? 0);
  const birds = Number(form.get("birds_covered") ?? 0);

  const after = {
    vaccine,
    disease_target: String(form.get("disease_target") ?? "").trim() || null,
    due_date: dueDate,
    route: String(form.get("route") ?? "").trim() || null,
    dose: String(form.get("dose") ?? "").trim() || null,
    manufacturer: String(form.get("manufacturer") ?? "").trim() || null,
    batch_no: String(form.get("batch_no") ?? "").trim() || null,
    administered_on: administeredOn,
    birds_covered: Number.isFinite(birds) && birds > 0 ? Math.round(birds) : null,
    cost_cents: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) : 0,
    reaction_notes: String(form.get("reaction_notes") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_vaccinations")
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
    action: "vaccination.updated",
    entityType: "vaccination",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/health");
  revalidatePath("/app");
  return { error: null, ok: `${vaccine} updated.` };
}

/** Remove a dose entered against the wrong flock, or scheduled twice. */
export async function deleteVaccination(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That dose could not be found.", ok: null };
  if (!reason) return { error: "Say why this is being deleted.", ok: null };

  const supabase = await createClient();

  const { data: record } = await supabase
    .from("edoshatch360_vaccinations")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!record) return { error: "That dose could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_vaccinations")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "vaccination.deleted",
    entityType: "vaccination",
    entityId: id,
    reason,
    before: record,
  });

  revalidatePath("/app/health");
  revalidatePath("/app");
  return { error: null, ok: `${record.vaccine} deleted.` };
}

/** Correct a health incident logged wrong — the title, symptoms, severity. */
export async function updateHealthIncident(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!id) return { error: "That incident could not be found.", ok: null };
  if (!title) return { error: "Give the incident a short title.", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_health_records")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That incident could not be found.", ok: null };

  const after = {
    title,
    occurred_on: String(form.get("occurred_on") ?? today()),
    symptoms: String(form.get("symptoms") ?? "").trim() || null,
    treatment: String(form.get("treatment") ?? "").trim() || null,
    severity: String(form.get("severity") ?? "medium"),
    birds_affected: Number(form.get("birds_affected") ?? 0) || null,
  };

  const { error } = await supabase
    .from("edoshatch360_health_records")
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
    action: "health_record.updated",
    entityType: "health_record",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/health");
  return { error: null, ok: "Incident updated." };
}

/** Remove an incident logged against the wrong flock, or by mistake. */
export async function deleteHealthIncident(
  _prev: HealthFormState,
  form: FormData,
): Promise<HealthFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That incident could not be found.", ok: null };
  if (!reason) return { error: "Say why this is being deleted.", ok: null };

  const supabase = await createClient();

  const { data: record } = await supabase
    .from("edoshatch360_health_records")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!record) return { error: "That incident could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_health_records")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "health_record.deleted",
    entityType: "health_record",
    entityId: id,
    reason,
    before: record,
  });

  revalidatePath("/app/health");
  return { error: null, ok: "Incident deleted." };
}
