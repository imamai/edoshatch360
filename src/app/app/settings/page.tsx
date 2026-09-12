import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2, CreditCard, Landmark, Receipt, Smartphone, Users,
} from "lucide-react";

import { CAN_ADMIN, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BusinessForm, EtimsForm, MpesaForm, TaxForm } from "./settings-forms";
import { formatDate, formatMoney, formatNumber, initials } from "@/lib/utils";
import type { AppUser, Plan, Subscription, TenantSetting } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { key: "business", label: "Business", icon: Building2 },
  { key: "tax", label: "Tax & invoices", icon: Receipt },
  { key: "etims", label: "eTIMS", icon: Landmark },
  { key: "mpesa", label: "M-Pesa", icon: Smartphone },
  { key: "staff", label: "Staff", icon: Users },
  { key: "billing", label: "Plan & billing", icon: CreditCard },
] as const;

/** Which plans unlock which configurable feature (spec §47). */
const FEATURE_PLANS: Record<string, string[]> = {
  etims: ["professional", "enterprise"],
  mpesa: ["growth", "professional", "enterprise"],
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) notFound();

  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "business";

  const supabase = await createClient();
  const [settingRes, subRes, memberRes] = await Promise.all([
    supabase.from("edoshatch360_settings").select("*").eq("tenant_id", session.tenant.id),
    supabase
      .from("edoshatch360_subscriptions")
      .select("*, edoshatch360_plans(*)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("edoshatch360_memberships")
      .select("id, role, status, created_at, edoshatch360_users(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at"),
  ]);

  const settings = new Map(
    ((settingRes.data ?? []) as TenantSetting[]).map((s) => [s.key, s.value]),
  );

  const subscription = subRes.data as (Subscription & {
    edoshatch360_plans: Plan | null;
  }) | null;
  const plan = subscription?.edoshatch360_plans ?? null;
  const planCode = plan?.code ?? "starter";
  const planName = plan?.name ?? "Starter";

  const members = ((memberRes.data ?? []) as unknown as {
    id: string;
    role: string;
    status: string;
    created_at: string;
    edoshatch360_users: Pick<AppUser, "id" | "full_name" | "email"> | null;
  }[]).filter((m) => m.edoshatch360_users !== null);

  const locked = (feature: string) => !FEATURE_PLANS[feature]?.includes(planCode);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        How {session.tenant.name} appears on documents, and what the app lets your team do.
      </p>

      <nav className="scroll-slim mt-5 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/app/settings?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {tab === "business" && (
          <Card>
            <CardHeader
              title="Business details"
              subtitle="What customers see on your invoices and receipts"
              icon={<Building2 className="h-4 w-4" />}
            />
            <CardBody>
              <BusinessForm tenant={session.tenant} />
            </CardBody>
          </Card>
        )}

        {tab === "tax" && (
          <Card>
            <CardHeader
              title="Tax & invoices"
              subtitle="VAT handling and what appears at the bottom of a document"
              icon={<Receipt className="h-4 w-4" />}
            />
            <CardBody>
              <TaxForm value={(settings.get("tax") ?? {}) as Record<string, unknown>} />
            </CardBody>
          </Card>
        )}

        {tab === "etims" && (
          <Card>
            <CardHeader
              title="KRA eTIMS"
              subtitle="Electronic tax invoice management"
              icon={<Landmark className="h-4 w-4" />}
              action={
                locked("etims") && <Badge tone="neutral">Professional and above</Badge>
              }
            />
            <CardBody>
              <EtimsForm
                value={(settings.get("etims") ?? {}) as Record<string, unknown>}
                locked={locked("etims")}
                plan={planName}
              />
            </CardBody>
          </Card>
        )}

        {tab === "mpesa" && (
          <Card>
            <CardHeader
              title="M-Pesa"
              subtitle="Where customers send payment"
              icon={<Smartphone className="h-4 w-4" />}
              action={locked("mpesa") && <Badge tone="neutral">Growth and above</Badge>}
            />
            <CardBody>
              <MpesaForm
                value={(settings.get("mpesa") ?? {}) as Record<string, unknown>}
                locked={locked("mpesa")}
                plan={planName}
              />
            </CardBody>
          </Card>
        )}

        {tab === "staff" && (
          <Card>
            <CardHeader
              title="Your team"
              subtitle={`${members.length} of ${plan?.max_users ?? "unlimited"} seats used`}
              icon={<Users className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {members.map((m) => {
                  const u = m.edoshatch360_users!;
                  return (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                        {initials(u.full_name ?? u.email)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">
                          {u.full_name ?? u.email}
                          {u.id === session.user.id && (
                            <span className="ml-1.5 text-xs font-normal text-ink-faint">you</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-ink-faint">{u.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone="brand">{m.role}</Badge>
                        {m.status !== "active" && <Badge tone="attention">{m.status}</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-line px-4 py-4 sm:px-5">
                <p className="text-sm font-medium text-ink">Adding someone</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                  Ask them to create an account at{" "}
                  <Link href="/signup" className="text-brand hover:underline">
                    the sign-up page
                  </Link>
                  , then send us their email and the role you want them to have. Self-serve
                  invitations are coming — until then we add them for you so nobody ends up
                  in the wrong organisation.
                </p>
              </div>
            </CardBody>
          </Card>
        )}

        {tab === "billing" && (
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader
                title="Your plan"
                subtitle="What you are on and what it includes"
                icon={<CreditCard className="h-4 w-4" />}
              />
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-extrabold text-ink">{planName}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {plan && plan.price_cents > 0
                        ? `${formatMoney(plan.price_cents, { currency: plan.currency })} per ${plan.billing_period}`
                        : "Free"}
                    </p>
                  </div>
                  {subscription && (
                    <Badge
                      tone={
                        subscription.status === "active"
                          ? "good"
                          : subscription.status === "trialing"
                            ? "info"
                            : "attention"
                      }
                      dot
                    >
                      {subscription.status}
                    </Badge>
                  )}
                </div>

                {subscription?.trial_ends_at && subscription.status === "trialing" && (
                  <p className="mt-3 rounded-lg border border-info/25 bg-info-soft px-3 py-2.5 text-sm text-info">
                    Your trial runs until {formatDate(subscription.trial_ends_at, "long")}.
                    Nothing stops working when it ends — you drop to the free Starter limits.
                  </p>
                )}

                {plan && (
                  <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                    {[
                      ["Farms", plan.max_farms],
                      ["Houses", plan.max_houses],
                      ["Birds", plan.max_birds],
                      ["Team members", plan.max_users],
                    ].map(([label, limit]) => (
                      <div key={String(label)}>
                        <dt className="text-xs text-ink-faint">{label as string}</dt>
                        <dd className="mt-0.5 text-lg font-semibold text-ink tnum">
                          {limit === null ? "Unlimited" : formatNumber(limit as number)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                <Link
                  href="/pricing"
                  className="mt-4 inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-ink hover:border-brand hover:text-brand"
                >
                  Compare plans
                </Link>
              </CardBody>
            </Card>

            {plan && plan.features.length > 0 && (
              <Card>
                <CardHeader title="What is included" />
                <CardBody>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                        <span
                          className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-good"
                          aria-hidden="true"
                        />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
