import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Wallet } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { getBrandingWithUrls } from "@/lib/data/branding";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import {
  SaleDocument,
  type SaleDocumentBusiness,
  type SaleDocumentModel,
} from "@/components/app/sale-document";
import { PaymentForm, PrintButton } from "./payment-form";
import { formatDate, formatMoney } from "@/lib/utils";
import type {
  Customer, CustomerPayment, Sale, SaleItem, SaleStatus,
} from "@/lib/database.types";

export const metadata: Metadata = { title: "Sale" };

const STATUS_TONE: Record<SaleStatus, Tone> = {
  draft: "neutral", sent: "info", partial: "attention",
  paid: "good", overdue: "critical", cancelled: "neutral",
};

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

  const business: SaleDocumentBusiness = {
    name: tenant.name,
    address: tenant.address,
    phone: tenant.phone,
    email: tenant.email,
    kraPin: tenant.kra_pin,
  };

  const model: SaleDocumentModel = {
    docType: doc.doc_type,
    docNumber: doc.doc_number,
    saleDate: doc.sale_date,
    dueDate: doc.due_date,
    customer: customer
      ? {
          name: customer.name,
          phone: customer.phone,
          location: customer.location,
          email: customer.email,
        }
      : null,
    lines: items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
    subtotalCents: doc.subtotal_cents,
    discountCents: doc.discount_cents,
    taxCents: doc.tax_cents,
    totalCents: doc.total_cents,
    amountPaidCents: doc.amount_paid_cents,
    balanceCents: doc.balance_cents,
    notes: doc.notes,
  };

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
          <SaleDocument
            model={model}
            business={business}
            branding={branding}
            currency={currency}
            badge={
              <Badge tone={STATUS_TONE[doc.status]} dot>
                {doc.status}
              </Badge>
            }
          />
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
