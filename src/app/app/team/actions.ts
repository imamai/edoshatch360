"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CAN_ADMIN, can, requireSession } from "@/lib/data/session";
import type { Role } from "@/lib/database.types";

/**
 * Who is on this farm.
 *
 * The rules live in the database — edoshatch360_create_invite checks the
 * caller owns the farm and that a seat is free, and raises HB001 with a
 * sentence meant for the farmer. These actions pass that sentence through
 * rather than inventing their own, so there is one wording per rule.
 */

export interface TeamState {
  error: string | null;
  ok: string | null;
  /** The link to hand over, returned once, on the invite that just succeeded. */
  link?: string;
}

const ROLES: Role[] = [
  "owner", "manager", "supervisor", "worker", "vet", "accountant", "sales", "viewer",
];

/** A message written for a person, or a generic one if Postgres wrote it. */
function readable(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  // PostgREST wraps our raise exception text; anything else is plumbing.
  return /[a-z] [a-z]/i.test(message) && !message.includes("duplicate key")
    ? message
    : fallback;
}

export async function inviteMember(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "Only the farm owner can invite people.", ok: null };
  }

  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "worker") as Role;

  if (!email) return { error: "Enter the email address to invite.", ok: null };
  if (!ROLES.includes(role)) return { error: "Pick a role.", ok: null };
  if (role === "owner") {
    return { error: "A farm has one owner. Invite them as a manager instead.", ok: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("edoshatch360_create_invite", {
    p_tenant: session.tenant.id,
    p_email: email,
    p_role: role,
  });

  if (error) {
    return { error: readable(error.message, "We couldn't send that invitation."), ok: null };
  }

  revalidatePath("/app/team");

  // The link is shown once and never stored in the page's data, because the
  // token is the credential. Email delivery is not wired up yet, so handing
  // the owner the link to pass on is the honest way to make this work today.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    error: null,
    ok: `Invitation ready for ${email}.`,
    link: `${base}/invite/${data as string}`,
  };
}

export async function revokeInvite(id: string): Promise<TeamState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "That is not yours to change.", ok: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("edoshatch360_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .is("accepted_at", null);

  if (error) return { error: "We couldn't cancel that invitation.", ok: null };

  revalidatePath("/app/team");
  return { error: null, ok: "Invitation cancelled." };
}

export async function changeRole(userId: string, role: Role): Promise<TeamState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "That is not yours to change.", ok: null };
  }
  if (userId === session.user.id) {
    return { error: "You cannot change your own role.", ok: null };
  }
  if (!ROLES.includes(role) || role === "owner") {
    return { error: "A farm has one owner.", ok: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("edoshatch360_memberships")
    .update({ role })
    .eq("tenant_id", session.tenant.id)
    .eq("user_id", userId);

  if (error) return { error: "We couldn't change that role.", ok: null };

  revalidatePath("/app/team");
  return { error: null, ok: "Role updated." };
}

export async function removeMember(userId: string): Promise<TeamState> {
  const session = await requireSession();
  if (!can(session.role, CAN_ADMIN)) {
    return { error: "That is not yours to change.", ok: null };
  }
  if (userId === session.user.id) {
    return {
      error: "You cannot remove yourself — the farm would be left with no owner.",
      ok: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("edoshatch360_memberships")
    .delete()
    .eq("tenant_id", session.tenant.id)
    .eq("user_id", userId);

  if (error) return { error: "We couldn't remove that person.", ok: null };

  revalidatePath("/app/team");
  return { error: null, ok: "Removed from this farm." };
}
