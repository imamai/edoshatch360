"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";
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
