"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";

export interface RecordFormState {
  error: string | null;
  ok: string | null;
}

/**
 * Remove a day's entry outright — a duplicate, a test, a day recorded
 * against the wrong flock. Re-saving the same day already lets a wrong
 * figure be corrected in place; this is for a day that should not be on the
 * record at all.
 *
 * edoshatch360_recount_flock does a full recompute of the flock's live bird
 * count from every remaining record, not an incremental subtraction, so a
 * deleted day can never leave the count skewed by whatever it used to hold.
 */
export async function deleteDailyRecord(
  _prev: RecordFormState,
  form: FormData,
): Promise<RecordFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm, so you cannot delete an entry.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!id) return { error: "That entry could not be found.", ok: null };
  if (!reason) return { error: "Say why this entry is being deleted.", ok: null };

  const supabase = await createClient();

  const { data: record } = await supabase
    .from("edoshatch360_daily_records")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!record) return { error: "That entry could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_daily_records")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that entry. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "daily_record.deleted",
    entityType: "daily_record",
    entityId: id,
    reason,
    before: record,
  });

  revalidatePath(`/app/flocks/${record.flock_id}`);
  revalidatePath("/app/record");
  revalidatePath("/app");
  return { error: null, ok: `The entry for ${record.record_date} was deleted.` };
}
