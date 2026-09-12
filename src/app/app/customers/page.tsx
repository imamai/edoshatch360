import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Phone, Users, Wallet } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { BreakdownDonut } from "@/components/charts/trend-charts";
import { CustomerForm } from "./customer-form";
import { formatMoney, formatNumber } from "@/lib/utils";
import type { Customer, Sale } from "@/lib/database.types";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const session = await requireSession();
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

  const supabase = await createClient();
  const [customerRes, saleRes] = await Promise.all([
    supabase
      .from("edoshatch360_customers")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("edoshatch360_sales")
      .select("customer_id, total_cents, balance_cents, doc_type, status, sale_date")
      .eq("tenant_id", session.tenant.id)
      .neq("status", "cancelled")
      .in("doc_type", ["invoice", "receipt"]),
  ]);

  const customers = (customerRes.data ?? []) as Customer[];
  const sales = (saleRes.data ?? []) as Pick<
    Sale, "customer_id" | "total_cents" | "balance_cents" | "doc_type" | "status" | "sale_date"
  >[];
  const currency = session.tenant.currency;

  // Lifetime value and outstanding balance per customer.
  const stats = new Map<string, { spent: number; owed: number; orders: number; last: string }>();
  for (const s of sales) {
    if (!s.customer_id) continue;
    const prev = stats.get(s.customer_id) ?? { spent: 0, owed: 0, orders: 0, last: "" };
    stats.set(s.customer_id, {
      spent: prev.spent + s.total_cents,
      owed: prev.owed + s.balance_cents,
      orders: prev.orders + 1,
      last: s.sale_date > prev.last ? s.sale_date : prev.last,
    });
  }

  const totalOwed = [...stats.values()].reduce((a, s) => a + s.owed, 0);
  const overLimit = customers.filter((c) => {
    const owed = stats.get(c.id)?.owed ?? 0;
    return c.credit_limit_cents > 0 && owed > c.credit_limit_cents;
  });

  const byType = [...
    customers.reduce((map, c) => {
      const key = c.customer_type.replace(/_/g, " ");
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ]
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }))
    .sort((a, b) => b.value - a.value);

  const sorted = [...customers].sort(
    (a, b) => (stats.get(b.id)?.spent ?? 0) - (stats.get(a.id)?.spent ?? 0),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Customers
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Who buys from you, how much, and what they still owe.
          </p>
        </div>
        <CustomerForm />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Customers"
          value={customers.length}
          icon={<Users className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <StatCard
          label="Owed to you"
          value={formatMoney(totalOwed, { currency, compact: true })}
          icon={<Wallet className="h-4.5 w-4.5" />}
          tone={totalOwed > 0 ? "attention" : "neutral"}
        />
        <StatCard
          label="Over credit limit"
          value={overLimit.length}
          hint={overLimit.length > 0 ? "Owing more than agreed" : "All within limits"}
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
          tone={overLimit.length > 0 ? "critical" : "good"}
        />
        <StatCard
          label="Buying customers"
          value={stats.size}
          hint="Have bought at least once"
          icon={<Users className="h-4.5 w-4.5" />}
          tone="info"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <Card>
          <CardHeader
            title="Everyone who buys from you"
            subtitle="Biggest spenders first"
            icon={<Users className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            {customers.length === 0 ? (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No customers yet"
                description="Add the people and businesses you sell to, and every sale starts building their history and balance."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-faint">
                      <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Customer</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Orders</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Spent</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium sm:px-5">Owes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sorted.map((c) => {
                      const s = stats.get(c.id);
                      const over = c.credit_limit_cents > 0 && (s?.owed ?? 0) > c.credit_limit_cents;
                      return (
                        <tr key={c.id} className="hover:bg-surface-sunk">
                          <td className="px-4 py-3 sm:px-5">
                            <span className="block font-medium text-ink">{c.name}</span>
                            {c.phone && (
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-brand"
                              >
                                <Phone className="h-3 w-3" />
                                {c.phone}
                              </a>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone="neutral">{c.customer_type.replace(/_/g, " ")}</Badge>
                          </td>
                          <td className="px-3 py-3 text-right text-ink-soft tnum">
                            {s?.orders ?? 0}
                          </td>
                          <td className="px-3 py-3 text-right font-medium tnum">
                            {formatMoney(s?.spent ?? 0, { currency })}
                          </td>
                          <td className="px-4 py-3 text-right sm:px-5">
                            {(s?.owed ?? 0) > 0 ? (
                              <span
                                className={`font-medium tnum ${over ? "text-critical" : "text-attention"}`}
                              >
                                {formatMoney(s?.owed ?? 0, { currency })}
                                {over && (
                                  <span className="ml-1 text-[0.6875rem]">over limit</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-ink-faint">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {byType.length > 0 && (
          <Card>
            <CardHeader
              title="Customer mix"
              subtitle="Who your buyers are"
              icon={<Users className="h-4 w-4" />}
            />
            <CardBody>
              <BreakdownDonut data={byType} unitLabel="customers" />
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-ink-faint">
                {formatNumber(customers.length)} customers across {byType.length} type
                {byType.length === 1 ? "" : "s"}. A mix that leans heavily on one buyer is
                a risk worth knowing about.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
