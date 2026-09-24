"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { logAudit } from "@/lib/audit";
import type { Priority } from "@/lib/database.types";

export interface TaskFormState {
  error: string | null;
  ok: string | null;
}

export async function createTask(
  _prev: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  const session = await requireSession();
  const supabase = await createClient();

  const title = String(form.get("title") ?? "").trim();
  if (!title) return { error: "What needs doing?", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("edoshatch360_tasks").insert({
    tenant_id: session.tenant.id,
    farm_id: String(form.get("farm_id") ?? "") || session.farms[0]?.id || null,
    flock_id: String(form.get("flock_id") ?? "") || null,
    title,
    description: String(form.get("description") ?? "").trim() || null,
    category: String(form.get("category") ?? "").trim() || null,
    assignee_id: String(form.get("assignee_id") ?? "") || null,
    due_date: String(form.get("due_date") ?? "") || null,
    priority: (String(form.get("priority") ?? "normal") || "normal") as Priority,
    created_by: user?.id ?? null,
  });

  if (error) return { error: "We couldn't save that task. Try again.", ok: null };

  revalidatePath("/app/tasks");
  return { error: null, ok: "Task added." };
}

export async function setTaskStatus(id: string, status: "todo" | "in_progress" | "done") {
  const supabase = await createClient();

  await supabase
    .from("edoshatch360_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidatePath("/app/tasks");
  revalidatePath("/app");
}

/**
 * Correct a task's own content — a wrong title, the wrong person assigned,
 * a due date that changed. Status is a separate, one-click action
 * (setTaskStatus above); this is everything else about it.
 */
export async function updateTask(
  _prev: TaskFormState,
  form: FormData,
): Promise<TaskFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  if (!id) return { error: "That task could not be found.", ok: null };
  if (!title) return { error: "What needs doing?", ok: null };

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("edoshatch360_tasks")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!before) return { error: "That task could not be found.", ok: null };

  const after = {
    title,
    category: String(form.get("category") ?? "").trim() || null,
    assignee_id: String(form.get("assignee_id") ?? "") || null,
    flock_id: String(form.get("flock_id") ?? "") || null,
    due_date: String(form.get("due_date") ?? "") || null,
    priority: (String(form.get("priority") ?? "normal") || "normal") as Priority,
    description: String(form.get("description") ?? "").trim() || null,
  };

  const { error } = await supabase
    .from("edoshatch360_tasks")
    .update(after)
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAudit({
    tenantId: session.tenant.id,
    userId: user?.id ?? null,
    action: "task.updated",
    entityType: "task",
    entityId: id,
    before,
    after,
  });

  revalidatePath("/app/tasks");
  return { error: null, ok: "Task updated." };
}

/** Remove a task added twice, or one that turned out not to be needed. */
export async function deleteTask(id: string): Promise<TaskFormState> {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return { error: "Your account has read-only access to this farm.", ok: null };
  }

  const supabase = await createClient();

  const { data: task } = await supabase
    .from("edoshatch360_tasks")
    .select("title")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();
  if (!task) return { error: "That task could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_tasks")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that task. Try again.", ok: null };

  revalidatePath("/app/tasks");
  revalidatePath("/app");
  return { error: null, ok: `${task.title} deleted.` };
}
