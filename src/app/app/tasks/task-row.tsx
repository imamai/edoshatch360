"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Pencil, Trash2, TriangleAlert } from "lucide-react";

import { deleteTask, updateTask, type TaskFormState } from "./actions";
import { TaskToggle } from "./task-ui";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { relativeDay } from "@/lib/utils";
import type { AppUser, Flock, Priority, Task } from "@/lib/database.types";

const initial: TaskFormState = { error: null, ok: null };

const PRIORITY_TONE: Record<Priority, Tone> = {
  low: "neutral",
  normal: "info",
  high: "attention",
  urgent: "critical",
};

const CATEGORIES = [
  "Vaccination", "Feed purchase", "House cleaning", "Egg collection",
  "Bird weighing", "Medication", "Equipment maintenance", "Litter change",
  "Repairs", "Other",
];

function Feedback({ state }: { state: TaskFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-good/25 bg-good-soft px-3 py-2 text-sm text-good">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {state.ok}
      </p>
    );
  }
  return null;
}

export function TaskRow({
  task,
  late,
  personName,
  flockCode,
  people,
  flocks,
  canManage,
}: {
  task: Task;
  late: boolean;
  personName: string | null;
  flockCode: string | null;
  people: Pick<AppUser, "id" | "full_name" | "email">[];
  flocks: Flock[];
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <TaskToggle id={task.id} done={false} title={task.title} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{task.title}</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {task.due_date ? relativeDay(task.due_date) : "No due date"}
            {personName ? ` · ${personName}` : ""}
            {flockCode ? ` · ${flockCode}` : ""}
          </p>
          {task.description && (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">{task.description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={late ? "critical" : PRIORITY_TONE[task.priority]} dot>
            {late ? "Overdue" : task.priority}
          </Badge>
          {task.category && <span className="text-[0.6875rem] text-ink-faint">{task.category}</span>}
          {canManage && mode === "view" && (
            <div className="mt-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-label={`Edit ${task.title}`}
                className="rounded-md p-1 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMode("delete")}
                aria-label={`Delete ${task.title}`}
                className="rounded-md p-1 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "edit" && (
        <div className="mt-3 rounded-lg border border-line bg-surface-sunk p-3">
          <EditForm task={task} people={people} flocks={flocks} onDone={() => setMode("view")} />
        </div>
      )}
      {mode === "delete" && (
        <div className="mt-3 rounded-lg border border-critical/25 bg-critical-soft p-3">
          <DeleteConfirm task={task} onCancel={() => setMode("view")} />
        </div>
      )}
    </li>
  );
}

function EditForm({
  task,
  people,
  flocks,
  onDone,
}: {
  task: Task;
  people: Pick<AppUser, "id" | "full_name" | "email">[];
  flocks: Flock[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateTask, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={task.id} />
      <TextInput label="What needs doing?" name="title" required defaultValue={task.title} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput label="Type of job" name="category" defaultValue={task.category ?? ""}>
          <option value="">Not categorised</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="How urgent?" name="priority" defaultValue={task.priority}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </SelectInput>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Due by" name="due_date" type="date" defaultValue={task.due_date ?? ""} />
        <SelectInput label="Who is doing it?" name="assignee_id" defaultValue={task.assignee_id ?? ""}>
          <option value="">Anyone</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email ?? "Team member"}
            </option>
          ))}
        </SelectInput>
      </div>

      {flocks.length > 0 && (
        <SelectInput label="Which flock?" name="flock_id" defaultValue={task.flock_id ?? ""}>
          <option value="">Not flock-specific</option>
          {flocks.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code}
            </option>
          ))}
        </SelectInput>
      )}

      <TextArea label="Any detail?" name="description" rows={2} defaultValue={task.description ?? ""} />

      <Feedback state={state} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteConfirm({ task, onCancel }: { task: Task; onCancel: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteTask(task.id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex gap-2.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete this task?</p>
        {error && (
          <p role="alert" className="mt-1 text-xs text-critical">
            {error}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button variant="danger" size="sm" busy={pending} onClick={remove}>
            Delete
          </Button>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
            Keep it
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteDoneTask({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteTask(id);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        aria-label={`Delete ${title}`}
        className="rounded-md p-1 text-ink-faint hover:bg-surface-sunk hover:text-critical"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[0.6875rem] text-critical">{error}</span>}
    </span>
  );
}
