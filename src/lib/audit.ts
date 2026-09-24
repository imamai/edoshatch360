import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * A paper trail for the corrections this app now allows.
 *
 * edoshatch360_audit_logs has existed since the platform migration and was
 * never written to — every "insert + never delete" guarantee it was built
 * for was going unused. Editing or deleting a payment, voiding a sale, or
 * deleting one outright are exactly the actions that need one: the current
 * row (or its absence) only ever shows the latest state, and a wrong figure
 * that has been "fixed" twice should not read as though it was only ever
 * right.
 *
 * Deliberately best-effort: a failed audit write must never be the reason a
 * genuine mistake cannot be corrected. It is logged to the server console
 * instead, so a silent failure here is at least a loud one there.
 */
export async function logAudit(entry: {
  tenantId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("edoshatch360_audit_logs").insert({
    tenant_id: entry.tenantId,
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    before: entry.before ?? null,
    after: { ...(entry.after && typeof entry.after === "object" ? entry.after : {}), reason: entry.reason ?? null },
  });
  if (error) {
    console.error(`edoshatch360: audit log write failed for ${entry.action}`, error.message);
  }
}
