"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/data/session";
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
