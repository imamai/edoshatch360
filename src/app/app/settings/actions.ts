"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_ADMIN, can, requireSession } from "@/lib/data/session";
import {
  ACCEPTED_IMAGE_TYPES, BRANDING_BUCKET, BRANDING_KEY, LOGO_MAX_BYTES,
  getBranding,
} from "@/lib/data/branding";
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

/* ------------------------------------------------------ document branding -- */

type BrandingAsset = "logo" | "signature";

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const LABEL: Record<BrandingAsset, string> = {
  logo: "logo",
  signature: "signature",
};

/**
 * Validates an uploaded mark and puts it in the tenant's storage folder.
 *
 * Returns the new path, or an error message fit to show a person. The file
 * name carries a timestamp so a replacement never collides with a cached copy
 * of the old one.
 */
async function putAsset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  asset: BrandingAsset,
  file: File,
): Promise<{ path?: string; error?: string }> {
  if (file.size > LOGO_MAX_BYTES) {
    return {
      error: `That ${LABEL[asset]} is ${(file.size / 1024 / 1024).toFixed(1)}MB. Keep it under 2MB.`,
    };
  }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { error: `The ${LABEL[asset]} must be a PNG, JPG or WEBP image.` };
  }

  const path = `${tenantId}/${asset}-${Date.now()}.${EXTENSION[file.type]}`;
  const { error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return { error: `We couldn't upload the ${LABEL[asset]}. Try again.` };
  }
  return { path };
}

/**
 * Saves the logo, the signature and who the signature belongs to.
 *
 * One form and one save, because they are one decision: what a customer sees
 * at the top and bottom of a document. Files are optional on every save — a
 * tenant changing only the signatory's title should not have to re-upload
 * two images.
 */
export async function updateBranding(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "Only the account owner can change these settings.", ok: null };
  }

  const supabase = await createClient();
  const tenantId = session.tenant.id;
  const current = await getBranding(tenantId);

  let logoPath = current.logoPath;
  let signaturePath = current.signaturePath;
  const superseded: string[] = [];

  for (const asset of ["logo", "signature"] as const) {
    const existing = asset === "logo" ? current.logoPath : current.signaturePath;
    const file = form.get(asset);
    const remove = form.get(`remove_${asset}`) === "on";

    // A removal and a replacement in the same save: the new file wins, since
    // uploading one is the more deliberate act.
    if (file instanceof File && file.size > 0) {
      const result = await putAsset(supabase, tenantId, asset, file);
      if (result.error) return { error: result.error, ok: null };
      if (existing) superseded.push(existing);
      if (asset === "logo") logoPath = result.path!;
      else signaturePath = result.path!;
    } else if (remove && existing) {
      superseded.push(existing);
      if (asset === "logo") logoPath = null;
      else signaturePath = null;
    }
  }

  const { error } = await supabase.from("edoshatch360_settings").upsert(
    {
      tenant_id: tenantId,
      key: BRANDING_KEY,
      value: {
        logo_path: logoPath,
        signature_path: signaturePath,
        signatory_name: String(form.get("signatory_name") ?? "").trim(),
        signatory_title: String(form.get("signatory_title") ?? "").trim(),
      },
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,key" },
  );

  if (error) return { error: "We couldn't save that. Try again.", ok: null };

  // Only now that the record points elsewhere. Doing this first would leave
  // documents pointing at a file that no longer exists if the save failed.
  if (superseded.length > 0) {
    await supabase.storage.from(BRANDING_BUCKET).remove(superseded);
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/sales", "layout");
  return { error: null, ok: "Saved. It will appear on your next document." };
}
