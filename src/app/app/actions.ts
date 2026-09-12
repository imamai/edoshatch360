"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
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
