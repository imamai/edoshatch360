"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_ADMIN, can, requireSession } from "@/lib/data/session";
import type { FarmMode } from "@/lib/database.types";

export interface SettingsFormState {
  error: string | null;
  ok: string | null;
}

export async function updateBusiness(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "Only the account owner can change these settings.", ok: null };
  }

  const supabase = await createClient();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "The business needs a name.", ok: null };

  const kraPin = String(form.get("kra_pin") ?? "").trim().toUpperCase();
  // Kenyan PIN format: A letter, nine digits, a letter. Checked so a typo
  // does not end up printed on an invoice.
  if (kraPin && !/^[A-Z]\d{9}[A-Z]$/.test(kraPin)) {
    return {
      error: "That KRA PIN does not look right. It should be a letter, nine digits, then a letter — for example A123456789Z.",
      ok: null,
    };
  }

  const { error } = await supabase
    .from("edoshatch360_tenants")
    .update({
      name,
      phone: String(form.get("phone") ?? "").trim() || null,
      email: String(form.get("email") ?? "").trim() || null,
      address: String(form.get("address") ?? "").trim() || null,
      kra_pin: kraPin || null,
      currency: String(form.get("currency") ?? "KES").trim() || "KES",
      mode: (String(form.get("mode") ?? "simple") || "simple") as FarmMode,
    })
    .eq("id", session.tenant.id);

  if (error) return { error: "We couldn't save those changes. Try again.", ok: null };

  revalidatePath("/app", "layout");
  return { error: null, ok: "Saved." };
}

/**
 * Tenant configuration held as JSON (tax rates, eTIMS credentials, document
 * preferences) so adding a setting is a UI change rather than a migration.
 */
export async function updateSetting(
  key: string,
  value: Record<string, unknown>,
): Promise<SettingsFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "Only the account owner can change these settings.", ok: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("edoshatch360_settings").upsert(
    {
      tenant_id: session.tenant.id,
      key,
      value,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,key" },
  );

  if (error) return { error: "We couldn't save that. Try again.", ok: null };

  revalidatePath("/app/settings");
  return { error: null, ok: "Saved." };
}

export async function updateTax(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const vatRate = Number(form.get("vat_rate") ?? 16);
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return { error: "VAT rate must be between 0 and 100.", ok: null };
  }

  return updateSetting("tax", {
    vat_registered: form.get("vat_registered") === "on",
    vat_rate: vatRate,
    prices_include_vat: form.get("prices_include_vat") === "on",
    invoice_footer: String(form.get("invoice_footer") ?? "").trim(),
  });
}

export async function updateEtims(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const enabled = form.get("etims_enabled") === "on";
  const pin = String(form.get("etims_pin") ?? "").trim().toUpperCase();
  const branch = String(form.get("etims_branch") ?? "").trim();

  if (enabled && !pin) {
    return { error: "eTIMS needs the PIN registered with KRA.", ok: null };
  }
  if (enabled && !branch) {
    return { error: "eTIMS needs the branch ID issued to you (often 00).", ok: null };
  }

  // Credentials are stored, but the device serial is the only secret-ish
  // value here and it is scoped to this tenant by RLS. No key material
  // belonging to a payment provider is ever stored by this app.
  return updateSetting("etims", {
    enabled,
    pin,
    branch_id: branch,
    device_serial: String(form.get("etims_device") ?? "").trim(),
    environment: String(form.get("etims_env") ?? "sandbox"),
  });
}

export async function updateMpesa(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  return updateSetting("mpesa", {
    enabled: form.get("mpesa_enabled") === "on",
    paybill: String(form.get("mpesa_paybill") ?? "").trim(),
    till: String(form.get("mpesa_till") ?? "").trim(),
    account_name: String(form.get("mpesa_account") ?? "").trim(),
  });
}
