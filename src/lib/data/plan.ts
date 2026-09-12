import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  NO_LIMITS, effectivePlan, planAllows,
  type PlanCode, type PlanFeature, type PlanLimits,
} from "@/lib/plans";
import type { Plan, SubStatus } from "@/lib/database.types";

/**
 * The plan an organisation is actually on, and the limits that follow from it.
 *
 * Read once per request and shared through React's cache, because the layout,
 * the navigation and a page guard all need the same answer and none of them
 * should cost a round trip of its own.
 */

export interface TenantPlan {
  /** Null when the organisation has no subscription row — see planAllows. */
  code: PlanCode | null;
  /** The plan actually written on the subscription, before any trial grant. */
  billedCode: PlanCode | null;
  status: SubStatus | null;
  limits: PlanLimits;
  trialEndsAt: string | null;
  allows: (feature: PlanFeature) => boolean;
}

const UNMETERED: TenantPlan = {
  code: null,
  billedCode: null,
  status: null,
  limits: NO_LIMITS,
  trialEndsAt: null,
  allows: () => true,
};

export const getTenantPlan = cache(async function getTenantPlan(
  tenantId: string,
): Promise<TenantPlan> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("edoshatch360_subscriptions")
    .select("status, trial_ends_at, edoshatch360_plans(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const plan = (data as { edoshatch360_plans: Plan | null } | null)?.edoshatch360_plans ?? null;
  if (!data || !plan) return UNMETERED;

  const billedCode = plan.code as PlanCode;
  const status = data.status as SubStatus;
  const code = effectivePlan(billedCode, status);

  // Limits come from the plan the tenant is *entitled to* right now, so a
  // trialing farm is not told it may only keep 500 birds while it is being
  // shown the professional product.
  const source =
    code === billedCode
      ? plan
      : ((
          await supabase
            .from("edoshatch360_plans")
            .select("*")
            .eq("code", code)
            .maybeSingle()
        ).data as Plan | null) ?? plan;

  return {
    code,
    billedCode,
    status,
    trialEndsAt: data.trial_ends_at as string | null,
    limits: {
      farms: source.max_farms,
      houses: source.max_houses,
      birds: source.max_birds,
      users: source.max_users,
    },
    allows: (feature: PlanFeature) => planAllows(code, feature),
  };
});

/* ---------------------------------------------------------------- usage -- */

export interface TenantUsage {
  farms: number;
  houses: number;
  birds: number;
  users: number;
}

/**
 * What the organisation currently holds, counted the way the limits are worded.
 *
 * Birds is the live count across flocks that are still running — a farm that
 * has closed three batches this year is not still carrying those birds, and
 * counting them would make the limit unreachable by design.
 */
export const getTenantUsage = cache(async function getTenantUsage(
  tenantId: string,
): Promise<TenantUsage> {
  const supabase = await createClient();

  const [farms, houses, flocks, users] = await Promise.all([
    supabase.from("edoshatch360_farms").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase.from("edoshatch360_houses").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase.from("edoshatch360_flocks").select("current_count")
      .eq("tenant_id", tenantId).not("status", "in", "(closed,harvested)"),
    supabase.from("edoshatch360_memberships").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "active"),
  ]);

  return {
    farms: farms.count ?? 0,
    houses: houses.count ?? 0,
    birds: (flocks.data ?? []).reduce(
      (sum, f) => sum + ((f as { current_count: number }).current_count ?? 0),
      0,
    ),
    users: users.count ?? 0,
  };
});
