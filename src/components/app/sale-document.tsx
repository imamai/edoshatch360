import { LogoMark } from "@/components/brand/logo";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import type { DocType } from "@/lib/database.types";

/**
 * The printed face of a sale: quotation, sales order, invoice or receipt.
 *
 * It takes a plain model rather than database rows, so the same component
 * renders a saved sale on `/app/sales/[id]` and an unsaved cart in the
 * Counter's preview. Before this existed the layout lived inside the sale
 * page, and any change to an invoice would have had to be made twice.
 *
 * Deliberately not a client component and deliberately free of data access:
 * it is pure presentation, so either side of the boundary can use it.
 */

export const DOC_TITLE: Record<DocType, string> = {
  quotation: "QUOTATION",
  order: "SALES ORDER",
  invoice: "TAX INVOICE",
  receipt: "RECEIPT",
};

export interface SaleDocumentParty {
  name: string;
  phone?: string | null;
  location?: string | null;
  email?: string | null;
}

export interface SaleDocumentLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface SaleDocumentModel {
  docType: DocType;
  docNumber: string;
  saleDate: string;
  dueDate: string | null;
  customer: SaleDocumentParty | null;
  lines: SaleDocumentLine[];
  subtotalCents: number;
  discountCents: number;
  /** VAT added on top of the subtotal. Zero when prices already include it. */
  taxCents: number;
  /**
   * VAT already contained in the total, for a farm whose prices include it.
   * Disclosed rather than added — the customer pays the same either way.
   */
  taxIncludedCents?: number;
  /** "VAT (16%)" — the rate as configured, so the document states it. */
  taxLabel?: string;
  totalCents: number;
  amountPaidCents: number;
  balanceCents: number;
  notes: string | null;
}

export interface SaleDocumentBusiness {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  kraPin: string | null;
}

export interface SaleDocumentBranding {
  logoUrl: string | null;
  signatureUrl: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
}

export function SaleDocument({
  model,
  business,
  branding,
  currency,
  badge,
  footer,
}: {
  model: SaleDocumentModel;
  business: SaleDocumentBusiness;
  branding: SaleDocumentBranding;
  currency: string;
  /** Status pill — page chrome, never printed. */
  badge?: React.ReactNode;
  /** Bank details or terms, from Settings → Tax & invoices. */
  footer?: string | null;
}) {
  const isQuotation = model.docType === "quotation";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* An uploaded logo is usually a wide lockup, so it gets the full left
            column and the business details sit beneath it. The default mark is
            a small square, which reads better beside the name than stacked
            above it. */}
        <div
          className={
            branding.logoUrl
              ? "flex max-w-[22rem] flex-col items-start gap-3"
              : "flex items-start gap-3"
          }
        >
          {branding.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element --
               a short-lived signed URL; next/image would cache a URL that
               expires, and this has to survive being sent to a printer. */
            <img
              src={branding.logoUrl}
              alt={`${business.name} logo`}
              className="max-h-20 w-auto max-w-[15rem] object-contain object-left"
            />
          ) : (
            <LogoMark className="h-9 w-9 text-brand" />
          )}
          <div>
            {/* Same colour as the document title, so the two things a customer
                reads first are visibly a pair. */}
            <p className="font-display text-lg font-extrabold text-brand">{business.name}</p>
            <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              {business.address && <p>{business.address}</p>}
              {business.phone && <p>{business.phone}</p>}
              {business.email && <p>{business.email}</p>}
              {business.kraPin && <p>KRA PIN: {business.kraPin}</p>}
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="font-display text-xl font-extrabold tracking-tight text-brand">
            {DOC_TITLE[model.docType]}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink tnum">{model.docNumber}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{formatDate(model.saleDate, "long")}</p>
          {badge && <div className="mt-2 flex justify-end print:hidden">{badge}</div>}
        </div>
      </div>

      <div className="mt-7 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Billed to
          </p>
          {model.customer ? (
            <div className="mt-1.5 text-sm leading-relaxed text-ink">
              <p className="font-semibold">{model.customer.name}</p>
              {model.customer.phone && <p className="text-ink-soft">{model.customer.phone}</p>}
              {model.customer.location && (
                <p className="text-ink-soft">{model.customer.location}</p>
              )}
              {model.customer.email && <p className="text-ink-soft">{model.customer.email}</p>}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-ink-soft">Walk-in customer</p>
          )}
        </div>

        {model.dueDate && (
          <div className="sm:text-right">
            <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
              {isQuotation ? "Valid until" : "Payment due"}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-ink">
              {formatDate(model.dueDate, "long")}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            {/* The column band carries the brand tint. print-color-adjust is
                load-bearing: browsers drop background colours when printing,
                and a printed invoice is exactly where this is meant to be
                seen. */}
            <tr className="border-y border-line bg-brand-soft text-left text-xs text-brand-dark [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
              <th scope="col" className="py-2.5 pr-3 pl-3 font-semibold">Description</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Unit price</th>
              <th scope="col" className="py-2.5 pr-3 pl-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {model.lines.map((line) => (
              <tr key={line.id}>
                <td className="py-3 pr-3 pl-3 text-ink">{line.description}</td>
                <td className="px-3 py-3 text-right text-ink-soft tnum">
                  {formatNumber(line.quantity, { decimals: 2 })}
                </td>
                <td className="px-3 py-3 text-right text-ink-soft tnum">
                  {formatMoney(line.unitPriceCents, { currency, decimals: true })}
                </td>
                <td className="py-3 pr-3 pl-3 text-right font-medium text-ink tnum">
                  {formatMoney(line.lineTotalCents, { currency, decimals: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex justify-end">
        <dl className="w-full max-w-xs text-sm">
          <div className="flex justify-between py-1.5">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="font-medium text-ink tnum">
              {formatMoney(model.subtotalCents, { currency, decimals: true })}
            </dd>
          </div>
          {model.discountCents > 0 && (
            <div className="flex justify-between py-1.5">
              <dt className="text-ink-soft">Discount</dt>
              <dd className="font-medium text-ink tnum">
                −{formatMoney(model.discountCents, { currency, decimals: true })}
              </dd>
            </div>
          )}
          {model.taxCents > 0 && (
            <div className="flex justify-between py-1.5">
              <dt className="text-ink-soft">{model.taxLabel ?? "VAT"}</dt>
              <dd className="font-medium text-ink tnum">
                {formatMoney(model.taxCents, { currency, decimals: true })}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line-strong py-2.5">
            <dt className="font-semibold text-ink">Total</dt>
            <dd className="font-display text-lg font-extrabold text-brand tnum">
              {formatMoney(model.totalCents, { currency, decimals: true })}
            </dd>
          </div>
          {/* Inclusive pricing: the VAT is inside the total above, so it is
              disclosed here rather than added to it. */}
          {(model.taxIncludedCents ?? 0) > 0 && (
            <div className="flex justify-between pb-1.5 text-xs">
              <dt className="text-ink-faint">
                Includes {model.taxLabel ?? "VAT"}
              </dt>
              <dd className="text-ink-faint tnum">
                {formatMoney(model.taxIncludedCents!, { currency, decimals: true })}
              </dd>
            </div>
          )}
          {!isQuotation && (
            <>
              <div className="flex justify-between py-1.5">
                <dt className="text-ink-soft">Paid</dt>
                <dd className="font-medium text-good tnum">
                  {formatMoney(model.amountPaidCents, { currency, decimals: true })}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line py-2">
                <dt className="font-semibold text-ink">Balance</dt>
                <dd
                  className={`font-semibold tnum ${
                    model.balanceCents > 0 ? "text-attention" : "text-good"
                  }`}
                >
                  {formatMoney(model.balanceCents, { currency, decimals: true })}
                </dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {model.notes && (
        <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
          {model.notes}
        </p>
      )}

      {/* Signature block.
          Shown whenever there is anything to sign with — the image, or just a
          name. With a name but no uploaded signature it still prints the rule,
          so the document can be signed by hand, which is how most of these are
          actually issued. */}
      {(branding.signatureUrl || branding.signatoryName) && (
        <div className="mt-8 flex justify-end">
          <div className="w-56 text-center">
            <div className="flex h-14 items-end justify-center">
              {branding.signatureUrl && (
                /* eslint-disable-next-line @next/next/no-img-element --
                   short-lived signed URL; see the logo above. */
                <img
                  src={branding.signatureUrl}
                  alt={
                    branding.signatoryName
                      ? `Signature of ${branding.signatoryName}`
                      : "Authorised signature"
                  }
                  className="max-h-14 max-w-full object-contain"
                />
              )}
            </div>
            <div className="border-t border-line-strong pt-1.5">
              {branding.signatoryName && (
                <p className="text-sm font-semibold text-ink">{branding.signatoryName}</p>
              )}
              {branding.signatoryTitle && (
                <p className="text-xs text-ink-soft">{branding.signatoryTitle}</p>
              )}
              <p className="mt-0.5 text-[0.6875rem] tracking-wide text-ink-faint uppercase">
                Authorised signature
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-line pt-4 text-center">
        {footer && (
          <p className="mx-auto mb-2 max-w-lg text-xs leading-relaxed whitespace-pre-line text-ink-soft">
            {footer}
          </p>
        )}
        <p className="text-xs text-ink-faint">
          {isQuotation
            ? "This quotation is an offer, not a demand for payment."
            : model.balanceCents <= 0
              ? "Paid in full — thank you."
              : "Thank you for your business."}
        </p>
      </div>
    </>
  );
}
