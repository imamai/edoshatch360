import type { Metadata } from "next";

import { CAN_ADMIN, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan, getTenantUsage } from "@/lib/data/plan";
import { ReadOnlyNotice } from "@/components/app/read-only-notice";
import { TeamManager, type TeamInvite, type TeamMember } from "./team-manager";

export const metadata: Metadata = { title: "Team" };

/**
 * The people on this farm, and the invitations still outstanding.
 *
 * Not gated on the staff_roles feature: every plan carries at least two seats,
 * so the seat count is the real limit and the plan speaks through that rather
 * than through a locked page.
 */
export default async function TeamPage() {
  const session = await requireSession();

  if (!can(session.role, CAN_ADMIN)) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-ink">Team</h1>
        <div className="mt-4">
          <ReadOnlyNotice what="manage the team" tenantName={session.tenant.name} />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: memberRows }, { data: inviteRows }, plan, usage] = await Promise.all([
    supabase
      .from("edoshatch360_memberships")
      .select("user_id, role, status, created_at, edoshatch360_users(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .order("created_at"),
    supabase
      .from("edoshatch360_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("tenant_id", session.tenant.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    getTenantPlan(session.tenant.id),
    getTenantUsage(session.tenant.id),
  ]);

  const members: TeamMember[] = (memberRows ?? [])
    .map((m) => {
      const u = m.edoshatch360_users as unknown as {
        id: string; full_name: string | null; email: string;
      } | null;
      if (!u) return null;
      return {
        id: u.id,
        name: u.full_name ?? u.email,
        email: u.email,
        role: m.role as TeamMember["role"],
        isSelf: u.id === session.user.id,
        joinedAt: m.created_at as string,
      };
    })
    .filter((m): m is TeamMember => m !== null);

  const invites: TeamInvite[] = (inviteRows ?? []).map((i) => ({
    id: i.id as string,
    email: i.email as string,
    role: i.role as TeamInvite["role"],
    expiresAt: i.expires_at as string,
  }));

  // Outstanding invitations hold a seat: the person will occupy one the moment
  // they accept, and a farm that cannot see that would keep inviting.
  const seatsUsed = usage.users + invites.length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Team</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Everyone who can open {session.tenant.name}, and what they are allowed to
          do once they are in.
        </p>
      </div>

      <TeamManager
        members={members}
        invites={invites}
        seatsUsed={seatsUsed}
        seatLimit={plan.limits.users}
      />
    </div>
  );
}
