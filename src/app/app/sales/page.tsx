import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney, relativeDay, today } from "@/lib/utils";
import type { Customer, Sale, SaleStatus } from "@/lib/database.types";

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

export default async function SalesPage() {
  const session = await requireSession();
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

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

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Sales</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Quotations, invoices and receipts — and who still owes you.
          </p>
        </div>
        <ButtonLink href="/app/sales/new" size="sm">
          <Plus className="h-4 w-4" />
          New sale
        </ButtonLink>
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
          title="All documents"
          subtitle="Most recent first"
          icon={<Receipt className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          {sales.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No sales recorded yet"
              description="Record your first sale and the revenue, profit and customer figures across Hatch360 start filling in."
              action={<ButtonLink href="/app/sales/new">Record a sale</ButtonLink>}
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
                  {sales.map((s) => (
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
