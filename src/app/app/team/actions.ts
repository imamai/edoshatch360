"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { canSendEmail, sendEmail, teamInviteEmail } from "@/lib/email";

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

/**
 * Where an invitation link should point.
 *
 * Read from the request rather than NEXT_PUBLIC_SITE_URL, which defaults to
 * http://localhost:3000 -- a colleague who clicked that would reach their own
 * machine, or nothing at all.
 */
async function inviteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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

  // The token is the credential, so the link is shown once and never stored in
  // the page's data. It is still returned even when the email goes out, so an
  // owner sitting next to the new worker can just show them the screen.
  const base = await inviteOrigin();
  const link = `${base}/invite/${data as string}`;

  if (!canSendEmail()) {
    return {
      error: null,
      ok: `Invitation ready for ${email}. Email isn't set up yet, so send them this link yourself.`,
      link,
    };
  }

  const sent = await sendEmail({
    to: email,
    ...teamInviteEmail({
      link,
      farmName: session.tenant.name,
      invitedBy: session.user.full_name ?? null,
      role,
    }),
  });

  if (!sent.sent) {
    console.error("Hatch360 invitation email failed:", sent.reason);
    return {
      error: null,
      ok: `Invitation created for ${email}, but the email didn't send. Pass them this link instead.`,
      link,
    };
  }

  return {
    error: null,
    ok: `Invitation emailed to ${email}.`,
    link,
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
