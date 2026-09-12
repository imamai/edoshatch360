import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * A tenant's tax position, as set on Settings → Tax & invoices.
 *
 * The settings have been editable for a while but nothing read them, so a farm
 * could tick "VAT registered" and see no VAT anywhere. This is the reader.
 *
 * Off by default, and that default is deliberate rather than lazy: most
 * Hatch360 farms sell unprocessed produce — eggs, live birds, manure — which
 * is exempt or zero-rated in Kenya, and a farm under the registration
 * threshold must not be charging VAT at all. A farm that is registered says so
 * here, and only then does VAT appear on its documents.
 */

export const TAX_KEY = "tax";

export interface TaxSettings {
  vatRegistered: boolean;
  /** Percent, e.g. 16 for the Kenyan standard rate. */
  vatRate: number;
  /** Whether the prices on the catalogue already contain VAT. */
  pricesIncludeVat: boolean;
  /** Free text printed at the foot of a document — bank details, terms. */
  invoiceFooter: string | null;
}

export const NO_TAX: TaxSettings = {
  vatRegistered: false,
  vatRate: 0,
  pricesIncludeVat: false,
  invoiceFooter: null,
};

export const getTaxSettings = cache(async function getTaxSettings(
  tenantId: string,
): Promise<TaxSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_settings")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("key", TAX_KEY)
    .maybeSingle();

  const value = (data?.value ?? {}) as Record<string, unknown>;
  const rate = Number(value.vat_rate);
  const footer = typeof value.invoice_footer === "string" ? value.invoice_footer.trim() : "";

  return {
    vatRegistered: value.vat_registered === true,
    // A stored rate that is missing, negative or absurd is treated as no rate
    // rather than trusted — this number ends up on a customer's invoice.
    vatRate: Number.isFinite(rate) && rate > 0 && rate <= 100 ? rate : 0,
    pricesIncludeVat: value.prices_include_vat === true,
    invoiceFooter: footer === "" ? null : footer,
  };
});

/**
 * Split a taxable amount into net, VAT and gross.
 *
 * Two modes, because a farm gate price is quoted either way:
 *
 *  - prices exclude VAT — the tax is added on top of what was rung up;
 *  - prices include VAT — the tax is already inside it, and what the customer
 *    pays does not change. The document discloses the VAT content instead of
 *    adding it, which is how an inclusive-priced receipt is normally read.
 *
 * Rounding happens once, on the VAT itself, so net + vat === gross exactly and
 * no document can ever be a cent out.
 */
export function splitVat(
  amountCents: number,
  tax: TaxSettings,
): { netCents: number; vatCents: number; grossCents: number; added: boolean } {
  if (!tax.vatRegistered || tax.vatRate <= 0 || amountCents <= 0) {
    return { netCents: amountCents, vatCents: 0, grossCents: amountCents, added: false };
  }

  if (tax.pricesIncludeVat) {
    const vatCents = Math.round((amountCents * tax.vatRate) / (100 + tax.vatRate));
    return {
      netCents: amountCents - vatCents,
      vatCents,
      grossCents: amountCents,
      added: false,
    };
  }

  const vatCents = Math.round((amountCents * tax.vatRate) / 100);
  return {
    netCents: amountCents,
    vatCents,
    grossCents: amountCents + vatCents,
    added: true,
  };
}

/** "VAT (16%)" — the rate belongs on the document, not just in settings. */
export function vatLabel(tax: TaxSettings): string {
  const rate = Number.isInteger(tax.vatRate) ? tax.vatRate : tax.vatRate.toFixed(2);
  return `VAT (${rate}%)`;
}
