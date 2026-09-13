import { LogoMark } from "@/components/brand/logo";
import { cn, formatDate } from "@/lib/utils";
import type {
  SaleDocumentBranding, SaleDocumentBusiness,
} from "@/components/app/sale-document";

/**
 * The printed face of a report.
 *
 * A report leaves the farm the same way an invoice does — handed to a bank, a
 * co-operative, a vet or an auditor — so it is built from the same parts as
 * SaleDocument: the farm's own letterhead, a band over the columns, a
 * signature. A page of numbers with no letterhead and nothing signed is not
 * something anyone can act on.
 *
 * Landing on a report shows the table alone — the controls above it already
 * say what it covers, and nobody needs their own address read back to them.
 * Pressing Generate is a different act: the farmer has asked for this exact
 * report, so `preview` shows them the finished document, letterhead and all,
 * rather than making them open a print dialogue to find out what it looks
 * like. Printing always shows the full document either way.
 *
 * Presentation only, no data access, so either side of the boundary can use it.
 */
export function ReportDocument({
  title,
  business,
  branding,
  covers,
  recordCount,
  clientSignOff = false,
  preview = false,
  children,
}: {
  title: string;
  business: SaleDocumentBusiness;
  branding: SaleDocumentBranding;
  /** The filters that produced this, in words. */
  covers: string[];
  recordCount: number;
  /**
   * A money report is evidence in a conversation with somebody else, so it
   * carries a second rule for them to sign. An operational report is the
   * farm's own record and carries only the farm's signature.
   */
  clientSignOff?: boolean;
  /** Show the document chrome on screen, not only on paper. */
  preview?: boolean;
  children: React.ReactNode;
}) {
  const signable = branding.signatureUrl || branding.signatoryName;

  // One decision, applied to every part of the letterhead, so the document
  // cannot appear half-dressed.
  const asBlock = preview ? "block" : "hidden print:block";
  const asFlex = preview ? "flex" : "hidden print:flex";

  return (
    <>
      {/* Always on paper; on screen only once a report has been generated. */}
      <div className={cn("flex-wrap items-start justify-between gap-4", asFlex)}>
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
            {title.toUpperCase()}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Generated {formatDate(new Date().toLocaleDateString("en-CA"), "long")}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft tnum">
            {recordCount} record{recordCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className={cn("mt-7 border-t border-line pt-5", asBlock)}>
        <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
          Report covers
        </p>
        <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink">
          {covers.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>

      <div className={preview ? "mt-6" : "print:mt-6"}>{children}</div>

      {(signable || clientSignOff) && (
        <div className={cn("mt-8 flex-wrap justify-between gap-8", asFlex)}>
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
                Prepared by
              </p>
            </div>
          </div>

          {clientSignOff && (
            <div className="w-56 text-center">
              {/* Left blank on purpose — this rule is signed by hand, by
                  whoever the report is being shown to. */}
              <div className="h-14" />
              <div className="border-t border-line-strong pt-1.5">
                <p className="text-xs text-ink-soft">Name</p>
                <p className="mt-0.5 text-xs text-ink-soft">Date</p>
                <p className="mt-0.5 text-[0.6875rem] tracking-wide text-ink-faint uppercase">
                  Received and agreed
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={cn("mt-6 border-t border-line pt-4 text-center", asBlock)}>
        <p className="text-xs text-ink-faint">
          Produced from the records held by {business.name}. Figures cover only the
          period and selection stated above.
        </p>
      </div>
    </>
  );
}
