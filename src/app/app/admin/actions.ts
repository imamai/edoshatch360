"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";
import type { PlanCode } from "@/lib/plans";
import type { SubStatus } from "@/lib/database.types";

/** Where a "View as" trip started, so "Stop viewing" knows where home is. */
const RETURN_TENANT_COOKIE = "edoshatch360_admin_return_tenant";

/**
 * Platform administration.
 *
 * Everything here relies on ordinary RLS rather than a service key: every
 * policy on these tables already begins with "or the caller is a platform
 * admin", so an administrator signed into the app can do this work with the
 * same anon key as everyone else. That keeps one audit trail and means no
 * secret has to exist in the application to make administration possible.
 */

export interface AdminState {
  error: string | null;
  ok: string | null;
}

async function guard(): Promise<{ ok: true } | { ok: false; state: AdminState }> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) {
    return { ok: false, state: { error: "That is not yours to change.", ok: null } };
  }
  return { ok: true };
}

function done(message: string): AdminState {
  revalidatePath("/app/admin");
  revalidatePath("/app", "layout");
  return { error: null, ok: message };
}

/* ----------------------------------------------------------- the plan -- */

export async function setTenantPlan(
  tenantId: string,
  planCode: PlanCode,
): Promise<AdminState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("edoshatch360_plans")
    .select("id, name")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) return { error: "That plan no longer exists.", ok: null };

  const { data: existing } = await supabase
    .from("edoshatch360_subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // An organisation with no subscription is unmetered, so giving it a plan is
  // the moment limits start applying to it. Created as active rather than
  // trialing: an administrator assigning a plan by hand means it, and a
  // silent thirty-day grant would be a surprise on both sides.
  const { error } = existing
    ? await supabase
        .from("edoshatch360_subscriptions")
        .update({ plan_id: plan.id })
        .eq("id", existing.id)
    : await supabase.from("edoshatch360_subscriptions").insert({
        tenant_id: tenantId,
        plan_id: plan.id,
        status: "active" as SubStatus,
        current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
      });

  if (error) return { error: "We couldn't change that plan. Try again.", ok: null };
  return done(`Moved to ${plan.name}.`);
}

export async function setSubscriptionStatus(
  tenantId: string,
  status: SubStatus,
): Promise<AdminState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("edoshatch360_subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return { error: "That organisation has no subscription to change.", ok: null };
  }

  const { error } = await supabase
    .from("edoshatch360_subscriptions")
    .update({ status })
    .eq("id", existing.id);

  if (error) return { error: "We couldn't change that. Try again.", ok: null };
  return done(`Marked ${status}.`);
}

/** Push a trial out, from today rather than from whenever it was due. */
export async function extendTrial(tenantId: string, days: number): Promise<AdminState> {
  const g = await guard();
  if (!g.ok) return g.state;
  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { error: "Extend a trial by between 1 and 365 days.", ok: null };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("edoshatch360_subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existing) return { error: "That organisation has no subscription.", ok: null };

  const until = new Date(Date.now() + days * 864e5).toISOString();
  const { error } = await supabase
    .from("edoshatch360_subscriptions")
    .update({ status: "trialing" as SubStatus, trial_ends_at: until, current_period_end: until })
    .eq("id", existing.id);

  if (error) return { error: "We couldn't extend that trial. Try again.", ok: null };
  return done(`Trial runs another ${days} days.`);
}

/* -------------------------------------------------------------- people -- */

/**
 * Grant or withdraw platform administration.
 *
 * edoshatch360_guard_platform_admin reverts this silently unless the caller
 * already holds the flag, which is why the first one had to be made in SQL.
 * From here it can be done in the open.
 */
export async function setPlatformAdmin(
  userId: string,
  isAdmin: boolean,
): Promise<AdminState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const session = await requireSession();
  if (userId === session.user.id && !isAdmin) {
    return {
      error: "Removing your own administration would lock you out of this screen.",
      ok: null,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edoshatch360_users")
    .update({ is_platform_admin: isAdmin })
    .eq("id", userId)
    .select("email, is_platform_admin")
    .maybeSingle();

  if (error || !data) return { error: "We couldn't change that account. Try again.", ok: null };

  // The trigger reverts rather than refusing, so the only honest check is
  // whether the value actually moved.
  if (data.is_platform_admin !== isAdmin) {
    return { error: "The database declined that change.", ok: null };
  }

  return done(
    isAdmin ? `${data.email} can now administer the platform.` : `${data.email} no longer can.`,
  );
}

/* ----------------------------------------------------------- enquiries -- */

/* -------------------------------------------------------------- view as -- */

/**
 * Look at one organisation's real screens as a support tool.
 *
 * Grants a temporary, read-only membership (see edoshatch360_admin_view_as)
 * and switches into it — the same last_tenant_id flip an ordinary user gets
 * from the tenant switcher. Redirects rather than returning AdminState,
 * since the point is to leave this page and land inside the organisation.
 */
export async function viewAsTenant(tenantId: string): Promise<void> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) {
    throw new Error("That is not yours to use.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("edoshatch360_admin_view_as", { p_tenant: tenantId });
  if (error) throw new Error("We couldn't open that organisation. Try again.");

  // Only remembered on the first hop — jumping from one "View as" straight
  // into another must not overwrite where the admin actually started.
  const store = await cookies();
  if (!session.isSupportView) {
    store.set(RETURN_TENANT_COOKIE, session.tenant.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
  }

  await supabase.from("edoshatch360_users").update({ last_tenant_id: tenantId }).eq("id", session.user.id);

  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function setEnquiryHandled(id: string, handled: boolean): Promise<AdminState> {
  const g = await guard();
  if (!g.ok) return g.state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("edoshatch360_contact_messages")
    .update({ handled })
    .eq("id", id);

  if (error) return { error: "We couldn't update that enquiry. Try again.", ok: null };
  return done(handled ? "Marked as handled." : "Reopened.");
}
