import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { effectivePlan, type PlanCode } from "@/lib/plans";
import { AdminConsole, type AdminOrg, type AdminPerson, type AdminEnquiry } from "./admin-console";
import type { Plan, SubStatus } from "@/lib/database.types";

export const metadata: Metadata = { title: "Platform" };

/**
 * The EDOS view of the platform: every organisation, everyone on it, and the
 * enquiries coming in from the website.
 *
 * Gated on is_platform_admin, which RLS already honours — so this page is not
 * the security boundary, it is the interface to one that already exists. A
 * farm owner who guesses the URL gets the same 404 as a stranger.
 */
export default async function AdminPage() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) notFound();

  const supabase = await createClient();

  const [tenantRes, planRes, userRes, enquiryRes] = await Promise.all([
    supabase
      .from("edoshatch360_tenants")
      .select("id, name, slug, mode, currency, created_at")
      .order("created_at"),
    supabase.from("edoshatch360_plans").select("*").order("sort_order"),
    supabase
      .from("edoshatch360_users")
      .select("id, email, full_name, is_platform_admin, created_at")
      .order("created_at"),
    supabase
      .from("edoshatch360_contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const tenants = tenantRes.data ?? [];
  const plans = (planRes.data ?? []) as Plan[];

  // Counted per organisation rather than joined, because the numbers come from
  // five different tables and a single join would multiply the rows.
  const [subs, members, flocks] = await Promise.all([
    supabase
      .from("edoshatch360_subscriptions")
      .select("tenant_id, status, trial_ends_at, current_period_end, plan_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("edoshatch360_memberships")
      .select("tenant_id, role, user_id, status"),
    supabase
      .from("edoshatch360_flocks")
      .select("tenant_id, current_count, status"),
  ]);

  const planById = new Map(plans.map((p) => [p.id, p]));
  const userById = new Map((userRes.data ?? []).map((u) => [u.id, u]));

  // The newest subscription per tenant wins, matching getTenantPlan.
  type SubRow = {
    tenant_id: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    plan_id: string;
  };
  const subByTenant = new Map<string, SubRow>();
  for (const s of (subs.data ?? []) as SubRow[]) {
    if (!subByTenant.has(s.tenant_id)) subByTenant.set(s.tenant_id, s);
  }

  const orgs: AdminOrg[] = tenants.map((t) => {
    const sub = subByTenant.get(t.id);
    const plan = sub ? planById.get(sub.plan_id) : null;
    const mine = (members.data ?? []).filter((m) => m.tenant_id === t.id);
    const owners = mine
      .filter((m) => m.role === "owner")
      .map((m) => userById.get(m.user_id)?.email ?? "unknown");
    const live = (flocks.data ?? []).filter(
      (f) => f.tenant_id === t.id && !["closed", "harvested"].includes(f.status as string),
    );

    const billed = (plan?.code ?? null) as PlanCode | null;
    const status = (sub?.status ?? null) as SubStatus | null;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      createdAt: t.created_at as string,
      owners,
      members: mine.filter((m) => m.status === "active").length,
      flocks: live.length,
      birds: live.reduce((sum, f) => sum + ((f.current_count as number) ?? 0), 0),
      billedPlan: billed,
      effectivePlan: effectivePlan(billed, status),
      status,
      trialEndsAt: (sub?.trial_ends_at as string | null) ?? null,
    };
  });

  const people: AdminPerson[] = (userRes.data ?? []).map((u) => {
    const mine = (members.data ?? []).filter((m) => m.user_id === u.id);
    return {
      id: u.id,
      email: u.email as string,
      name: (u.full_name as string | null) ?? null,
      isPlatformAdmin: u.is_platform_admin as boolean,
      createdAt: u.created_at as string,
      isSelf: u.id === session.user.id,
      farms: mine.map((m) => ({
        tenant: tenants.find((t) => t.id === m.tenant_id)?.name ?? "unknown",
        role: m.role as string,
      })),
    };
  });

  const enquiries: AdminEnquiry[] = (enquiryRes.data ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
    email: e.email as string,
    phone: (e.phone as string | null) ?? null,
    county: (e.county as string | null) ?? null,
    message: e.message as string,
    handled: e.handled as boolean,
    createdAt: e.created_at as string,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Platform</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every organisation on EDOS Hatch360, who is on them, and what has come
          in from the website.
        </p>
      </div>

      <AdminConsole
        orgs={orgs}
        people={people}
        enquiries={enquiries}
        plans={plans.map((p) => ({
          code: p.code as PlanCode,
          name: p.name,
          priceCents: p.price_cents,
          currency: p.currency,
        }))}
      />
    </div>
  );
}
