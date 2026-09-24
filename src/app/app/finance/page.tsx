import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Coins, PieChart, Receipt, TrendingDown, TrendingUp } from "lucide-react";

import { CAN_SEE_MONEY, CAN_WRITE, can, requireSession } from "@/lib/data/session";
import {
  computeKpis, expenseBreakdown, getDashboardData, moneySeries,
} from "@/lib/data/dashboard";
import { getFlocks } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { BreakdownDonut, RevenueExpenseChart } from "@/components/charts/trend-charts";
import { ExpenseForm } from "./expense-form";
import { ExpenseRow } from "./expense-row";
import { formatMoney, formatPercent } from "@/lib/utils";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage() {
  const session = await requireSession();

  // Workers and supervisors have no business on this screen; RLS would let
  // them read the rows, so the restriction is enforced here as well.
  if (!can(session.role, CAN_SEE_MONEY)) notFound();
  const canManage = can(session.role, CAN_WRITE) && can(session.role, CAN_SEE_MONEY);

  const [data, flocks] = await Promise.all([
    getDashboardData(session.tenant.id),
    getFlocks(session.tenant.id),
  ]);

  const kpis = computeKpis(data);
  const money = moneySeries(data, 6);
  const breakdown = expenseBreakdown(data);
  const currency = session.tenant.currency;

  const outstanding = data.sales
    .filter((s) => s.balance_cents > 0)
    .reduce((a, s) => a + s.balance_cents, 0);

  const recentExpenses = [...data.expenses]
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
    .slice(0, 12);

  // Month-on-month change, to give the profit tile a direction.
  const thisMonth = money[money.length - 1];
  const lastMonth = money[money.length - 2];
  const profitNow = (thisMonth?.revenue ?? 0) - (thisMonth?.expenses ?? 0);
  const profitPrev = (lastMonth?.revenue ?? 0) - (lastMonth?.expenses ?? 0);
  const profitDelta =
    profitPrev !== 0 ? ((profitNow - profitPrev) / Math.abs(profitPrev)) * 100 : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Finance</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What came in, what went out, and whether you are ahead.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatMoney(kpis.revenueCents, { currency, compact: true })}
          icon={<TrendingUp className="h-4.5 w-4.5" />}
          tone="good"
        />
        <StatCard
          label="Expenses this month"
          value={formatMoney(kpis.expensesCents, { currency, compact: true })}
          icon={<TrendingDown className="h-4.5 w-4.5" />}
          tone="attention"
          higherIsBetter={false}
        />
        <StatCard
          label="Profit this month"
          value={formatMoney(kpis.profitCents, { currency, compact: true })}
          hint={`${formatPercent(kpis.marginPct)} margin`}
          icon={<Coins className="h-4.5 w-4.5" />}
          tone={kpis.profitCents >= 0 ? "good" : "critical"}
          delta={profitDelta}
        />
        <StatCard
          label="Owed to you"
          value={formatMoney(outstanding, { currency, compact: true })}
          hint="Unpaid invoice balances"
          icon={<Receipt className="h-4.5 w-4.5" />}
          tone={outstanding > 0 ? "attention" : "neutral"}
          href="/app/sales"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Revenue against expenses"
            subtitle="Last 6 months"
            icon={<Coins className="h-4 w-4" />}
          />
          <CardBody>
            <RevenueExpenseChart data={money} currency={currency} height={250} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Where the money went"
            subtitle="This month, by category"
            icon={<PieChart className="h-4 w-4" />}
          />
          <CardBody>
            <BreakdownDonut data={breakdown} currency={currency} height={250} />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card>
          <CardHeader
            title="Recent expenses"
            subtitle="Last 6 months"
            icon={<Receipt className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            {recentExpenses.length === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" />}
                title="No expenses recorded"
                description="Record what you spend and the profit figure above becomes real rather than optimistic."
              />
            ) : (
              <ul className="divide-y divide-line">
                {recentExpenses.map((e) => (
                  <ExpenseRow key={e.id} expense={e} currency={currency} canManage={canManage} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <ExpenseForm farms={session.farms} flocks={flocks} />
      </div>
    </div>
  );
}
