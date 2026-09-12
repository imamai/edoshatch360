import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Farm, FarmMode, Role, Tenant } from "@/lib/database.types";

export interface SessionContext {
  user: AppUser;
  tenant: Tenant;
  role: Role;
  /** Farms this user may actually see — already filtered by RLS. */
  farms: Farm[];
  /** Every organisation the user belongs to, for the switcher. */
  tenants: { id: string; name: string; role: Role }[];
  mode: FarmMode;
  isPlatformAdmin: boolean;
}

/**
 * The one place the app resolves "who is this and what are they looking at".
 *
 * Wrapped in React's `cache` so a layout, a page and three components in the
 * same render all share a single round trip rather than each issuing their own.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  // Heals a profile row that the auth trigger could not write (see
  // edoshatch360_ensure_profile). Cheap, idempotent, and means a missing
  // profile never becomes a dead end for the user.
  await supabase.rpc("edoshatch360_ensure_profile");

  const { data: profile } = await supabase
    .from("edoshatch360_users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (!profile) return null;

  const { data: memberships } = await supabase
    .from("edoshatch360_memberships")
    .select("tenant_id, role, edoshatch360_tenants(id, name)")
    .eq("user_id", authUser.id)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return null;

  const list = memberships
    .map((m) => {
      const t = m.edoshatch360_tenants as unknown as { id: string; name: string } | null;
      return t ? { id: t.id, name: t.name, role: m.role as Role } : null;
    })
    .filter((t): t is { id: string; name: string; role: Role } => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Prefer the organisation the user last worked in; fall back to the first.
  const activeId =
    (profile.last_tenant_id && list.some((t) => t.id === profile.last_tenant_id)
      ? profile.last_tenant_id
      : list[0]?.id) ?? null;

  if (!activeId) return null;

  const [{ data: tenant }, { data: farms }] = await Promise.all([
    supabase.from("edoshatch360_tenants").select("*").eq("id", activeId).maybeSingle(),
    supabase
      .from("edoshatch360_farms")
      .select("*")
      .eq("tenant_id", activeId)
      .eq("is_active", true)
      .order("name"),
  ]);

  if (!tenant) return null;

  return {
    user: profile as AppUser,
    tenant: tenant as Tenant,
    role: (list.find((t) => t.id === activeId)?.role ?? "viewer") as Role,
    farms: (farms ?? []) as Farm[],
    tenants: list,
    mode: (tenant as Tenant).mode,
    isPlatformAdmin: (profile as AppUser).is_platform_admin,
  };
});

/**
 * Session or bust. Sends a signed-out user to login and a signed-in user with
 * no organisation to onboarding, so no page has to handle either case.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/onboarding" : "/login?next=/app");
  }
  return session;
}

/* ----------------------------------------------------------- permissions --

   These lists exist to hide controls people cannot use. They are NOT the
   protection — enforcement lives in RLS, and each list below mirrors exactly
   one database function so the two cannot quietly diverge:

     CAN_WRITE      → edoshatch360_writable_tenant_ids()
     CAN_SEE_MONEY  → edoshatch360_money_tenant_ids()
     CAN_ADMIN      → edoshatch360_admin_tenant_ids()

   If you change a list here, change the matching function in
   supabase/migrations/ in the same commit.                                  */

export const CAN_WRITE: Role[] = [
  "owner", "manager", "supervisor", "worker", "vet", "accountant", "sales",
];

// `viewer` is a deliberate read-only role, so it sees the books; the roles
// kept out are the operational ones — worker, supervisor and vet.
export const CAN_SEE_MONEY: Role[] = [
  "owner", "accountant", "sales", "manager", "viewer",
];

export const CAN_ADMIN: Role[] = ["owner"];

export function can(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}