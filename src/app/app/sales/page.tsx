import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney, relativeDay, today } from "@/lib/utils";
import type { Customer, DocType, Sale, SaleStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sales" };

const STATUS_TONE: Record<SaleStatus, Tone> = {
  draft: "neutral",
  sent: "info",
  partial: "attention",
  paid: "good",
  overdue: "critical",
  cancelled: "neutral",
};

const DOC_LABEL = {
  quotation: "Quotation",
  order: "Order",
  invoice: "Invoice",
  receipt: "Receipt",
} as const;

/**
 * The filtered views the sidebar links to. One list, one `doc_type` filter —
 * no separate pages, no separate queries.
 */
const VIEWS: { key: DocType | "all"; label: string; title: string; lead: string }[] = [
  {
    key: "all",
    label: "All",
    title: "Sales",
    lead: "Quotations, invoices and receipts — and who still owes you.",
  },
  {
    key: "invoice",
    label: "Invoices",
    title: "Invoices",
    lead: "Issued and awaiting payment, or settled.",
  },
  {
    key: "receipt",
    label: "Receipts",
    title: "Receipts",
    lead: "Money already taken, at the counter or in the field.",
  },
  {
    key: "quotation",
    label: "Quotations",
    title: "Quotations",
    lead: "Prices you have offered. Not yet a sale.",
  },
  {
    key: "order",
    label: "Sales orders",
    title: "Sales orders",
    lead: "Agreed with the customer, not yet invoiced.",
  },
];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

  const params = await searchParams;
  const view = VIEWS.find((v) => v.key === params.type) ?? VIEWS[0];

  const supabase = await createClient();
  const monthStart = `${today().slice(0, 7)}-01`;

  const [saleRes, customerRes] = await Promise.all([
    supabase
      .from("edoshatch360_sales")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("edoshatch360_customers")
      .select("id, name")
      .eq("tenant_id", session.tenant.id),
  ]);

  const sales = (saleRes.data ?? []) as Sale[];
  const customerName = new Map(
    ((customerRes.data ?? []) as Pick<Customer, "id" | "name">[]).map((c) => [c.id, c.name]),
  );
  const currency = session.tenant.currency;

  const soldThisMonth = sales
    .filter(
      (s) =>
        s.sale_date >= monthStart &&
        s.status !== "cancelled" &&
        (s.doc_type === "invoice" || s.doc_type === "receipt"),
    )
    .reduce((a, s) => a + s.total_cents, 0);

  const outstanding = sales
    .filter((s) => s.balance_cents > 0 && s.status !== "cancelled" && s.doc_type !== "quotation")
    .reduce((a, s) => a + s.balance_cents, 0);

  const overdueCount = sales.filter(
    (s) => s.balance_cents > 0 && s.due_date && s.due_date < today() && s.status !== "cancelled",
  ).length;

  const openQuotes = sales.filter((s) => s.doc_type === "quotation" && s.status === "sent").length;

  // The figures above are the farm's, whatever is being looked at. Only the
  // table below narrows — a filter should not silently change a KPI.
  const shown = view.key === "all" ? sales : sales.filter((s) => s.doc_type === view.key);
  const countFor = (key: DocType | "all") =>
    key === "all" ? sales.length : sales.filter((s) => s.doc_type === key).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            {view.title}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{view.lead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href="/app/sales/counter" size="sm">
            <ShoppingCart className="h-4 w-4" />
            Counter
          </ButtonLink>
        </div>
      </div>

      {/* On a phone there is no sidebar tree, so the same views live here as
          chips. On desktop they mirror the sidebar and either route works. */}
      <div className="scroll-slim -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {VIEWS.map((v) => {
          const isOn = v.key === view.key;
          return (
            <Link
              key={v.key}
              href={v.key === "all" ? "/app/sales" : `/app/sales?type=${v.key}`}
              aria-current={isOn ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                isOn
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-soft hover:border-brand hover:text-brand",
              )}
            >
              {v.label}
              <span className={cn("tnum", isOn ? "text-white/70" : "text-ink-faint")}>
                {countFor(v.key)}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Sold this month"
          value={formatMoney(soldThisMonth, { currency, compact: true })}
          icon={<TrendingUp className="h-4.5 w-4.5" />}
          tone="good"
        />
        <StatCard
          label="Owed to you"
          value={formatMoney(outstanding, { currency, compact: true })}
          icon={<Wallet className="h-4.5 w-4.5" />}
          tone={outstanding > 0 ? "attention" : "neutral"}
        />
        <StatCard
          label="Overdue"
          value={overdueCount}
          hint="Past their due date"
          icon={<Receipt className="h-4.5 w-4.5" />}
          tone={overdueCount > 0 ? "critical" : "good"}
        />
        <StatCard
          label="Open quotations"
          value={openQuotes}
          icon={<FileText className="h-4.5 w-4.5" />}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader
          title={view.key === "all" ? "All documents" : view.title}
          subtitle={`${shown.length} ${shown.length === 1 ? "document" : "documents"}, most recent first`}
          icon={<Receipt className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          {shown.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title={
                view.key === "all" ? "No sales recorded yet" : `No ${view.label.toLowerCase()} yet`
              }
              description={
                view.key === "all"
                  ? "Record your first sale and the revenue, profit and customer figures across Hatch360 start filling in."
                  : "Nothing of this kind has been issued. The Counter is the quickest way to raise one."
              }
              action={<ButtonLink href="/app/sales/counter">Open the Counter</ButtonLink>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-faint">
                    <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Document</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Customer</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Balance</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-sunk">
                      <td className="px-4 py-3 sm:px-5">
                        <Link
                          href={`/app/sales/${s.id}`}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {s.doc_number}
                        </Link>
                        <span className="block text-xs text-ink-faint">
                          {DOC_LABEL[s.doc_type]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-soft">
                        {s.customer_id ? customerName.get(s.customer_id) ?? "—" : "Walk-in"}
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{relativeDay(s.sale_date)}</td>
                      <td className="px-3 py-3 text-right font-medium tnum">
                        {formatMoney(s.total_cents, { currency })}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tnum ${
                          s.balance_cents > 0 ? "font-medium text-attention" : "text-ink-faint"
                        }`}
                      >
                        {s.balance_cents > 0 ? formatMoney(s.balance_cents, { currency }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right sm:px-5">
                        <Badge tone={STATUS_TONE[s.status]} dot>
                          {s.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
