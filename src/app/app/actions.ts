"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";

const RETURN_TENANT_COOKIE = "edoshatch360_admin_return_tenant";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Leave a "View as" trip (see edoshatch360_admin_view_as in
 * src/app/app/admin/actions.ts) and return to the tenant the admin actually
 * belongs to.
 *
 * Only ever removes the self-granted viewer membership this exact trip
 * created — edoshatch360_admin_stop_viewing enforces that in SQL, not just
 * here, so this can never be called against someone else's real access.
 */
export async function stopViewingAsTenant() {
  const session = await requireSession();
  if (!session.isSupportView) redirect("/app");

  const supabase = await createClient();
  await supabase.rpc("edoshatch360_admin_stop_viewing", { p_tenant: session.tenant.id });

  const store = await cookies();
  const home = store.get(RETURN_TENANT_COOKIE)?.value;
  store.delete(RETURN_TENANT_COOKIE);

  await supabase
    .from("edoshatch360_users")
    .update({ last_tenant_id: home ?? null })
    .eq("id", session.user.id);

  revalidatePath("/app", "layout");
  redirect("/app");
}

/** Remember which organisation the user was last working in. */
export async function switchTenant(tenantId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS on edoshatch360_users restricts this update to the caller's own row,
  // and the FK to edoshatch360_tenants is itself readable only for tenants
  // they belong to — so a forged id cannot switch them into someone else's
  // organisation.
  await supabase
    .from("edoshatch360_users")
    .update({ last_tenant_id: tenantId })
    .eq("id", user.id);

  revalidatePath("/app", "layout");
  redirect("/app");
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("edoshatch360_notifications")
    .update({ is_read: true })
    .eq("is_read", false);

  revalidatePath("/app", "layout");
}
