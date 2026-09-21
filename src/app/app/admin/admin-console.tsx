"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Building2, CheckCircle2, Eye, Mail, ShieldCheck, Users } from "lucide-react";

import {
  extendTrial, setEnquiryHandled, setPlatformAdmin, setSubscriptionStatus, setTenantPlan,
  viewAsTenant, type AdminState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { PLAN_LABEL, type PlanCode } from "@/lib/plans";
import type { SubStatus } from "@/lib/database.types";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owners: string[];
  members: number;
  flocks: number;
  birds: number;
  billedPlan: PlanCode | null;
  effectivePlan: PlanCode | null;
  status: SubStatus | null;
  trialEndsAt: string | null;
}

export interface AdminPerson {
  id: string;
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  createdAt: string;
  isSelf: boolean;
  farms: { tenant: string; role: string }[];
}

export interface AdminEnquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  county: string | null;
  message: string;
  handled: boolean;
  createdAt: string;
}

interface PlanOption {
  code: PlanCode;
  name: string;
  priceCents: number;
  currency: string;
}

const STATUS_TONE: Record<SubStatus, Tone> = {
  trialing: "info",
  active: "good",
  past_due: "attention",
  cancelled: "neutral",
  expired: "critical",
};

const STATUSES: SubStatus[] = ["trialing", "active", "past_due", "cancelled", "expired"];

type Tab = "orgs" | "people" | "enquiries";

export function AdminConsole({
  orgs,
  people,
  enquiries,
  plans,
}: {
  orgs: AdminOrg[];
  people: AdminPerson[];
  enquiries: AdminEnquiry[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("orgs");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState | null>(null);

  function run(fn: () => Promise<AdminState>) {
    start(async () => {
      const r = await fn();
      setResult(r);
      if (!r.error) router.refresh();
    });
  }

  const open = enquiries.filter((e) => !e.handled).length;
  const stranded = people.filter((p) => p.farms.length === 0).length;
  const ownerless = orgs.filter((o) => o.owners.length === 0).length;

  const TABS: { key: Tab; label: string; icon: typeof Building2; count?: number }[] = [
    { key: "orgs", label: "Organisations", icon: Building2, count: orgs.length },
    { key: "people", label: "People", icon: Users, count: people.length },
    { key: "enquiries", label: "Enquiries", icon: Mail, count: open },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Things that need a human, surfaced rather than waiting to be noticed. */}
      {(ownerless > 0 || stranded > 0) && (
        <div className="flex gap-2.5 rounded-lg border border-attention/30 bg-attention-soft px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
          <p className="text-sm text-ink-soft">
            {ownerless > 0 && (
              <>
                <strong className="text-attention">
                  {ownerless} organisation{ownerless === 1 ? "" : "s"} with no owner
                </strong>
                {stranded > 0 && " · "}
              </>
            )}
            {stranded > 0 && (
              <>
                <strong className="text-attention">
                  {stranded} account{stranded === 1 ? "" : "s"} belonging to no farm
                </strong>
              </>
            )}
            . Nobody can reach those from inside the app.
          </p>
        </div>
      )}

      <div className="scroll-slim -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                on
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-soft hover:border-brand hover:text-brand",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.count !== undefined && (
                <span className={cn("text-xs tnum", on ? "text-white/75" : "text-ink-faint")}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {result && (
        <p
          role="alert"
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            result.error
              ? "border-critical/25 bg-critical-soft text-critical"
              : "border-good/25 bg-good-soft text-good",
          )}
        >
          {!result.error && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {result.error ?? result.ok}
        </p>
      )}

      {tab === "orgs" && (
        <div className="flex flex-col gap-3">
          {orgs.map((o) => (
            <Card key={o.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink">
                      {o.name}
                      {o.status && (
                        <Badge tone={STATUS_TONE[o.status]} dot>
                          {o.status}
                        </Badge>
                      )}
                      {!o.status && <Badge tone="neutral">no subscription</Badge>}
                      {o.owners.length === 0 && <Badge tone="attention">no owner</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {o.owners.length > 0 ? o.owners.join(", ") : "nobody owns this"} ·{" "}
                      {o.members} member{o.members === 1 ? "" : "s"} · {o.flocks} flock
                      {o.flocks === 1 ? "" : "s"} · {formatNumber(o.birds)} birds · since{" "}
                      {formatDate(o.createdAt, "long")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-ink-faint">Entitled to</p>
                    <p className="font-display text-sm font-bold text-brand">
                      {o.effectivePlan ? PLAN_LABEL[o.effectivePlan] : "Everything (unmetered)"}
                    </p>
                    {o.billedPlan && o.effectivePlan !== o.billedPlan && (
                      <p className="text-[0.6875rem] text-ink-faint">
                        billed as {PLAN_LABEL[o.billedPlan]}
                      </p>
                    )}
                  </div>
                </div>

                {o.trialEndsAt && o.status === "trialing" && (
                  <p className="text-xs text-ink-soft">
                    Trial runs until {formatDate(o.trialEndsAt, "long")}.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                    Plan
                    <select
                      value={o.billedPlan ?? ""}
                      disabled={pending}
                      onChange={(e) =>
                        run(() => setTenantPlan(o.id, e.target.value as PlanCode))
                      }
                      className="h-8 rounded-md border border-line bg-canvas px-2 text-sm text-ink focus:border-brand focus:outline-none"
                    >
                      <option value="" disabled>
                        none
                      </option>
                      {plans.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                          {p.priceCents > 0
                            ? ` — ${formatMoney(p.priceCents, { currency: p.currency })}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                    Status
                    <select
                      value={o.status ?? ""}
                      disabled={pending || !o.status}
                      onChange={(e) =>
                        run(() => setSubscriptionStatus(o.id, e.target.value as SubStatus))
                      }
                      className="h-8 rounded-md border border-line bg-canvas px-2 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50"
                    >
                      <option value="" disabled>
                        none
                      </option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>

                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending || !o.status}
                    onClick={() => run(() => extendTrial(o.id, 30))}
                  >
                    Extend trial 30 days
                  </Button>

                  {/* Opens their real screens read-only, as a support tool —
                      see edoshatch360_admin_view_as. Not wired through run()
                      because this redirects rather than returning a result. */}
                  <form action={viewAsTenant.bind(null, o.id)} className="ml-auto">
                    <Button type="submit" size="sm" variant="ghost">
                      <Eye className="h-4 w-4" />
                      View as
                    </Button>
                  </form>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {tab === "people" && (
        <Card>
          <CardHeader title="Everyone with an account" />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {people.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {p.name ?? p.email}
                      {p.isPlatformAdmin && (
                        <Badge tone="brand" dot>
                          platform admin
                        </Badge>
                      )}
                      {p.farms.length === 0 && <Badge tone="attention">no farm</Badge>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {p.email}
                      {p.farms.length > 0 &&
                        ` · ${p.farms.map((f) => `${f.tenant} (${f.role})`).join(", ")}`}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={p.isPlatformAdmin ? "secondary" : "ghost"}
                    disabled={pending || (p.isSelf && p.isPlatformAdmin)}
                    onClick={() => run(() => setPlatformAdmin(p.id, !p.isPlatformAdmin))}
                    title={
                      p.isSelf && p.isPlatformAdmin
                        ? "You cannot remove your own administration"
                        : undefined
                    }
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {p.isPlatformAdmin ? "Withdraw" : "Make admin"}
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {tab === "enquiries" && (
        <Card>
          <CardHeader
            title="From the website"
            subtitle={
              enquiries.length === 0
                ? "Nothing has come in yet."
                : `${open} open of ${enquiries.length}`
            }
          />
          <CardBody className={enquiries.length === 0 ? undefined : "p-0"}>
            {enquiries.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-soft">
                The contact form writes here. Until this screen existed nobody could
                read it.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {enquiries.map((e) => (
                  <li key={e.id} className={cn("px-4 py-3", e.handled && "opacity-60")}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {e.name}
                          {e.county && (
                            <span className="font-normal text-ink-faint"> · {e.county}</span>
                          )}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {e.email}
                          {e.phone && ` · ${e.phone}`} · {formatDate(e.createdAt, "long")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={e.handled ? "ghost" : "secondary"}
                        disabled={pending}
                        onClick={() => run(() => setEnquiryHandled(e.id, !e.handled))}
                      >
                        {e.handled ? "Reopen" : "Mark handled"}
                      </Button>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">
                      {e.message}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
