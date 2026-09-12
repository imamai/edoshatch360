"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";

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
