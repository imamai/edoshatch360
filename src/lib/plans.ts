import type { SubStatus } from "@/lib/database.types";

/**
 * What each subscription plan actually unlocks.
 *
 * The promises were already written — every row in edoshatch360_plans carries
 * a `features` list that the pricing page renders, saying things like "Flock
 * profitability & FCR" from Growth and "Audit log" from Professional. Nothing
 * in the application read them, so a farm on the free plan reached every
 * screen. This module is the missing half: one place that turns a plan code
 * into what the software will let you do.
 *
 * Pure and client-safe, so the navigation, a page guard and a server action
 * all decide the same way.
 */

export type PlanCode = "starter" | "growth" | "professional" | "enterprise";

/** Ascending. A plan includes everything the plans below it include. */
const RANK: Record<PlanCode, number> = {
  starter: 0,
  growth: 1,
  professional: 2,
  enterprise: 3,
};

export const PLAN_LABEL: Record<PlanCode, string> = {
  starter: "Starter",
  growth: "Growth",
  professional: "Professional",
  enterprise: "Enterprise",
};

/**
 * Capabilities, and the lowest plan that carries each.
 *
 * Every entry traces to a line in that plan's own `features` column, so the
 * software and the pricing page cannot drift apart. Anything a plan does not
 * mention is deliberately absent here and stays open to everyone: recording
 * the day's eggs, feed and deaths is the point of the product, not an upsell.
 */
export type PlanFeature =
  | "invoicing"        // "Customers, invoices & receipts"
  | "inventory"        // "Inventory & reorder alerts"
  | "vaccinations"     // "Vaccination scheduling & reminders"
  | "fcr"              // "Flock profitability & FCR"
  | "health_score"     // "Farm Health Score"
  | "reports_export"   // "Production & financial reports (PDF/Excel)"
  | "mpesa"            // "M-Pesa" collection details
  | "multi_farm"       // "Multi-farm dashboard & comparison"
  | "staff_roles"      // "Role-based staff accounts"
  | "benchmarking"     // "Benchmarking vs previous batches"
  | "audit_log"        // "Audit log"
  | "etims"            // "eTIMS-ready tax invoices"
  | "api"              // "API access"
  | "white_label";     // "White-label branding"

const FEATURE_FROM: Record<PlanFeature, PlanCode> = {
  invoicing: "growth",
  inventory: "growth",
  vaccinations: "growth",
  fcr: "growth",
  health_score: "growth",
  reports_export: "growth",
  mpesa: "growth",
  multi_farm: "professional",
  staff_roles: "professional",
  benchmarking: "professional",
  audit_log: "professional",
  etims: "professional",
  api: "enterprise",
  white_label: "enterprise",
};

/** The plan a feature first appears on, for "available from Growth" copy. */
export function featureFrom(feature: PlanFeature): PlanCode {
  return FEATURE_FROM[feature];
}

export function planAllows(plan: PlanCode | null, feature: PlanFeature): boolean {
  // Null means this organisation has no subscription row at all — it predates
  // billing. Locking those farms out of screens they have been using for weeks
  // would be a billing change arriving as a fault, so they are left unmetered
  // until a plan is assigned to them.
  if (plan === null) return true;
  return RANK[plan] >= RANK[FEATURE_FROM[feature]];
}

/**
 * What a subscription is worth today, which is not always the plan on it.
 *
 * A trial grants the full paid product. The seeded trial is thirty days of
 * *Starter* — a free plan — which gives a new farm nothing to evaluate and no
 * reason to pay at the end of it. Every farm currently on the platform is
 * trialing, so this also means none of them loses a screen the day gating
 * arrives.
 *
 * Enterprise is deliberately not the trial tier: it is the "talk to us" plan,
 * and white-label and API access are not built.
 */
export const TRIAL_GRANTS: PlanCode = "professional";

export function effectivePlan(
  code: PlanCode | null,
  status: SubStatus | null,
): PlanCode | null {
  if (!code || !status) return null;
  switch (status) {
    case "trialing":
      return TRIAL_GRANTS;
    // Past due keeps working. Chasing a farmer for 2,500 shillings by taking
    // away the records they are mid-way through entering loses the farm and
    // the money.
    case "active":
    case "past_due":
      return code;
    case "cancelled":
    case "expired":
      return "starter";
    default:
      return code;
  }
}

/* --------------------------------------------------------------- limits -- */

export interface PlanLimits {
  farms: number | null;
  houses: number | null;
  birds: number | null;
  users: number | null;
}

export const NO_LIMITS: PlanLimits = { farms: null, houses: null, birds: null, users: null };

/**
 * Whether one more of something is allowed.
 *
 * Limits apply to *adding*, never to what a farm already holds. An
 * organisation that grew past its plan — or was seeded above it — keeps every
 * record it has and simply cannot add more, so enforcement can never strand
 * anyone outside their own data.
 */
export function withinLimit(
  current: number,
  limit: number | null,
  adding = 1,
): boolean {
  if (limit === null) return true;
  return current + adding <= limit;
}
