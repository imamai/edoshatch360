import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Wallet } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { getBrandingWithUrls } from "@/lib/data/branding";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { LogoMark } from "@/components/brand/logo";
import { PaymentForm, PrintButton } from "./payment-form";
import { formatDate, formatMoney, formatNumber } from "@/lib/utils";
import type {
  Customer, CustomerPayment, Sale, SaleItem, SaleStatus,
} from "@/lib/database.types";

export const metadata: Metadata = { title: "Sale" };

const STATUS_TONE: Record<SaleStatus, Tone> = {
  draft: "neutral", sent: "info", partial: "attention",
  paid: "good", overdue: "critical", cancelled: "neutral",
};

const DOC_TITLE = {
  quotation: "QUOTATION",
  order: "SALES ORDER",
  invoice: "TAX INVOICE",
  receipt: "RECEIPT",
} as const;

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

  const { id } = await params;
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("edoshatch360_sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!sale) notFound();
  const doc = sale as Sale;

  const branding = await getBrandingWithUrls(session.tenant.id);
  const [itemRes, paymentRes, customerRes] = await Promise.all([
    supabase.from("edoshatch360_sale_items").select("*").eq("sale_id", id).order("sort_order"),
    supabase
      .from("edoshatch360_customer_payments")
      .select("*")
      .eq("sale_id", id)
      .order("paid_at", { ascending: false }),
    doc.customer_id
      ? supabase.from("edoshatch360_customers").select("*").eq("id", doc.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const items = (itemRes.data ?? []) as SaleItem[];
  const payments = (paymentRes.data ?? []) as CustomerPayment[];
  const customer = customerRes.data as Customer | null;
  const currency = session.tenant.currency;
  const tenant = session.tenant;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/app/sales"
          className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-brand"
        >
          <ChevronLeft className="h-4 w-4" />
          Sales
        </Link>
        <PrintButton />
      </div>

      {/* ------------------------------------------------- the document -- */}
      <Card className="mt-4 print:border-0 print:shadow-none">
        <CardBody className="sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* An uploaded logo is usually a wide lockup, so it gets the full
                left column and the business details sit beneath it. The
                default mark is a small square, which reads better beside the
                name than stacked above it. */}
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
                  alt={`${tenant.name} logo`}
                  className="max-h-20 w-auto max-w-[15rem] object-contain object-left"
                />
              ) : (
                <LogoMark className="h-9 w-9 text-brand" />
              )}
              <div>
                {/* Same colour as the document title, so the two things a
                    customer reads first are visibly a pair. */}
                <p className="font-display text-lg font-extrabold text-brand">{tenant.name}</p>
                <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                  {tenant.address && <p>{tenant.address}</p>}
                  {tenant.phone && <p>{tenant.phone}</p>}
                  {tenant.email && <p>{tenant.email}</p>}
                  {tenant.kra_pin && <p>KRA PIN: {tenant.kra_pin}</p>}
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="font-display text-xl font-extrabold tracking-tight text-brand">
                {DOC_TITLE[doc.doc_type]}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink tnum">{doc.doc_number}</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {formatDate(doc.sale_date, "long")}
              </p>
              <div className="mt-2 flex justify-end print:hidden">
                <Badge tone={STATUS_TONE[doc.status]} dot>
                  {doc.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <div>
              <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                Billed to
              </p>
              {customer ? (
                <div className="mt-1.5 text-sm leading-relaxed text-ink">
                  <p className="font-semibold">{customer.name}</p>
                  {customer.phone && <p className="text-ink-soft">{customer.phone}</p>}
                  {customer.location && <p className="text-ink-soft">{customer.location}</p>}
                  {customer.email && <p className="text-ink-soft">{customer.email}</p>}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-ink-soft">Walk-in customer</p>
              )}
            </div>

            {doc.due_date && (
              <div className="sm:text-right">
                <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                  Payment due
                </p>
                <p className="mt-1.5 text-sm font-semibold text-ink">
                  {formatDate(doc.due_date, "long")}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                {/* The column band carries the brand tint. print-color-adjust
                    is load-bearing: browsers drop background colours when
                    printing, and a printed invoice is exactly where this is
                    meant to be seen. */}
                <tr className="border-y border-line bg-brand-soft text-left text-xs text-brand-dark [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
                  <th scope="col" className="py-2.5 pr-3 pl-3 font-semibold">Description</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Qty</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Unit price</th>
                  <th scope="col" className="py-2.5 pr-3 pl-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3 pl-3 text-ink">{item.description}</td>
                    <td className="px-3 py-3 text-right text-ink-soft tnum">
                      {formatNumber(Number(item.quantity), { decimals: 2 })}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-soft tnum">
                      {formatMoney(item.unit_price_cents, { currency, decimals: true })}
                    </td>
                    <td className="py-3 pr-3 pl-3 text-right font-medium text-ink tnum">
                      {formatMoney(item.line_total_cents, { currency, decimals: true })}
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
                  {formatMoney(doc.subtotal_cents, { currency, decimals: true })}
                </dd>
              </div>
              {doc.discount_cents > 0 && (
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-soft">Discount</dt>
                  <dd className="font-medium text-ink tnum">
                    −{formatMoney(doc.discount_cents, { currency, decimals: true })}
                  </dd>
                </div>
              )}
              {doc.tax_cents > 0 && (
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-soft">VAT</dt>
                  <dd className="font-medium text-ink tnum">
                    {formatMoney(doc.tax_cents, { currency, decimals: true })}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-line-strong py-2.5">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-display text-lg font-extrabold text-brand tnum">
                  {formatMoney(doc.total_cents, { currency, decimals: true })}
                </dd>
              </div>
              {doc.doc_type !== "quotation" && (
                <>
                  <div className="flex justify-between py-1.5">
                    <dt className="text-ink-soft">Paid</dt>
                    <dd className="font-medium text-good tnum">
                      {formatMoney(doc.amount_paid_cents, { currency, decimals: true })}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-line py-2">
                    <dt className="font-semibold text-ink">Balance</dt>
                    <dd
                      className={`font-semibold tnum ${
                        doc.balance_cents > 0 ? "text-attention" : "text-good"
                      }`}
                    >
                      {formatMoney(doc.balance_cents, { currency, decimals: true })}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {doc.notes && (
            <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
              {doc.notes}
            </p>
          )}

          {/* Signature block.
              Shown whenever there is anything to sign with — the image, or
              just a name. With a name but no uploaded signature it still
              prints the rule, so the document can be signed by hand, which is
              how most of these are actually issued. */}
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

          <p className="mt-6 border-t border-line pt-4 text-center text-xs text-ink-faint">
            {doc.doc_type === "quotation"
              ? "This quotation is an offer, not a demand for payment."
              : doc.balance_cents <= 0
                ? "Paid in full — thank you."
                : "Thank you for your business."}
          </p>
        </CardBody>
      </Card>

      {/* -------------------------------------------------- payments -- */}
      {doc.doc_type !== "quotation" && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2 print:hidden">
          <Card>
            <CardHeader
              title="Payments received"
              subtitle={`${payments.length} recorded`}
              icon={<Wallet className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {payments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-faint">
                  Nothing received against this document yet.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink capitalize">{p.method}</p>
                        <p className="text-xs text-ink-faint">
                          {formatDate(p.paid_at)}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-good tnum">
                        {formatMoney(p.amount_cents, { currency })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {doc.balance_cents > 0 && (
            <Card>
              <CardHeader title="Record a payment" icon={<Wallet className="h-4 w-4" />} />
              <CardBody>
                <PaymentForm
                  saleId={doc.id}
                  balanceCents={doc.balance_cents}
                  currency={currency}
                />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
