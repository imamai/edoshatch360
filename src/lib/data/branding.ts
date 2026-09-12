import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * A tenant's logo and authorised signature, as printed on quotations, sales
 * orders, invoices and receipts.
 *
 * The bucket is private. A scanned handwritten signature on a permanent
 * public URL is a forgery risk, so both marks are read through short-lived
 * signed URLs generated per request. That is also why the stored value is a
 * storage *path* rather than a URL — a URL would expire and be wrong the next
 * time anyone opened the document.
 *
 * `edoshatch360_tenants.logo_url` is deliberately left alone: it was designed
 * for a permanent public URL, which this scheme cannot produce.
 */

export const BRANDING_BUCKET = "edoshatch360-branding";
export const BRANDING_KEY = "document_branding";

/** How long a signed URL lives. Long enough to read and print, not to share. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export interface DocumentBranding {
  logoPath: string | null;
  signaturePath: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

export interface BrandingWithUrls extends DocumentBranding {
  logoUrl: string | null;
  signatureUrl: string | null;
}

const EMPTY: DocumentBranding = {
  logoPath: null,
  signaturePath: null,
  signatoryName: null,
  signatoryTitle: null,
};

/** Narrows one field of the settings JSON to a trimmed string, or null. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export const getBranding = cache(async function getBranding(
  tenantId: string,
): Promise<DocumentBranding> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", BRANDING_KEY)
    .maybeSingle();

  const value = (data?.value ?? {}) as Record<string, unknown>;
  return {
    logoPath: str(value.logo_path),
    signaturePath: str(value.signature_path),
    signatoryName: str(value.signatory_name),
    signatoryTitle: str(value.signatory_title),
  };
});

/**
 * The same record with readable URLs attached.
 *
 * Both paths are signed in one round trip. A failure here is deliberately
 * quiet: a document that renders without its logo is still a valid document,
 * whereas a page that 500s because storage hiccuped is not.
 */
export const getBrandingWithUrls = cache(async function getBrandingWithUrls(
  tenantId: string,
): Promise<BrandingWithUrls> {
  const branding = await getBranding(tenantId);
  const paths = [branding.logoPath, branding.signaturePath].filter(
    (p): p is string => p !== null,
  );

  if (paths.length === 0) {
    return { ...branding, logoUrl: null, signatureUrl: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BRANDING_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return { ...branding, logoUrl: null, signatureUrl: null };
  }

  const byPath = new Map(data.map((row) => [row.path, row.signedUrl]));
  return {
    ...branding,
    logoUrl: branding.logoPath ? (byPath.get(branding.logoPath) ?? null) : null,
    signatureUrl: branding.signaturePath
      ? (byPath.get(branding.signaturePath) ?? null)
      : null,
  };
});

export { EMPTY as EMPTY_BRANDING };
