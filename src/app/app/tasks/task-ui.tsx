"use client";

import { useActionState, useState } from "react";
import { Check, CheckCircle2, ListPlus, RotateCcw } from "lucide-react";

import { createTask, setTaskStatus, type TaskFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectInput, TextArea, TextInput } from "@/components/ui/field";
import type { AppUser, Farm, Flock } from "@/lib/database.types";
import { today } from "@/lib/utils";

const initial: TaskFormState = { error: null, ok: null };

const CATEGORIES = [
  "Vaccination", "Feed purchase", "House cleaning", "Egg collection",
  "Bird weighing", "Medication", "Equipment maintenance", "Litter change",
  "Repairs", "Other",
];

export function TaskForm({
  farms,
  flocks,
  people,
}: {
  farms: Farm[];
  flocks: Flock[];
  people: Pick<AppUser, "id" | "full_name" | "email">[];
}) {
  const [state, action, pending] = useActionState(createTask, initial);

  return (
    <Card>
      <CardHeader title="Add a task" icon={<ListPlus className="h-4 w-4" />} />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <TextInput
            label="What needs doing?"
            name="title"
            required
            placeholder="e.g. Newcastle vaccination, House 2"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput label="Type of job" name="category" defaultValue="">
              <option value="">Not categorised</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
            <SelectInput label="How urgent?" name="priority" defaultValue="normal">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </SelectInput>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Due by" name="due_date" type="date" defaultValue={today()} />
            <SelectInput label="Who is doing it?" name="assignee_id" defaultValue="">
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name ?? p.email ?? "Team member"}
                </option>
              ))}
            </SelectInput>
          </div>

          {flocks.length > 0 && (
            <SelectInput label="Which flock?" name="flock_id" defaultValue="">
              <option value="">Not flock-specific</option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                </option>
              ))}
            </SelectInput>
          )}

          {farms.length > 1 && (
            <SelectInput label="Farm" name="farm_id" defaultValue={farms[0]?.id}>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectInput>
          )}

          <TextArea label="Any detail?" name="description" rows={2} placeholder="Optional" />

          {state.error && (
            <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
              {state.error}
            </p>
          )}
          {state.ok && (
            <p className="flex items-center gap-2 rounded-lg border border-good/25 bg-good-soft px-3 py-2 text-sm text-good">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {state.ok}
            </p>
          )}

          <Button type="submit" busy={pending} className="self-start">
            {pending ? "Saving" : "Add task"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function TaskToggle({
  id,
  done,
  title,
}: {
  id: string;
  done: boolean;
  title: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async () => {
        setBusy(true);
        await setTaskStatus(id, done ? "todo" : "done");
        setBusy(false);
      }}
    >
      <button
        type="submit"
        disabled={busy}
        aria-label={done ? `Reopen ${title}` : `Mark ${title} done`}
        className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
          done
            ? "border-good bg-good text-white hover:bg-good/80"
            : "border-line-strong text-transparent hover:border-good hover:text-good/40"
        }`}
      >
        {done ? <Check className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      </button>
    </form>
  );
}

export function ReopenButton({ id }: { id: string }) {
  return (
    <form action={setTaskStatus.bind(null, id, "todo")}>
      <button
        type="submit"
        className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-brand"
      >
        <RotateCcw className="h-3 w-3" />
        Reopen
      </button>
    </form>
  );
}
