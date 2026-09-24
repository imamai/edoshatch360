"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, TriangleAlert } from "lucide-react";

import {
  deleteHealthIncident, updateHealthIncident, type HealthFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { formatNumber, today } from "@/lib/utils";
import type { HealthRecord } from "@/lib/database.types";

const initial: HealthFormState = { error: null, ok: null };

const SEVERITY_TONE = {
  low: "neutral",
  medium: "attention",
  high: "critical",
  critical: "critical",
} as const;

function Feedback({ state }: { state: HealthFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-sm text-good">{state.ok}</p>;
  return null;
}

export function IncidentRow({
  h,
  flockCode,
  canManage,
}: {
  h: HealthRecord;
  flockCode: string;
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{h.title}</p>
          <p className="text-xs text-ink-faint">
            {flockCode} · {h.occurred_on}
            {h.birds_affected ? ` · ${formatNumber(h.birds_affected)} birds` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {h.severity && (
            <Badge tone={SEVERITY_TONE[h.severity]} dot>
              {h.severity}
            </Badge>
          )}
          {canManage && mode === "view" && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-label={`Edit ${h.title}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode("delete")}
                aria-label={`Delete ${h.title}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "view" && (
        <>
          {h.symptoms && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{h.symptoms}</p>}
          {h.treatment && (
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">
              <strong className="text-ink-soft">Done:</strong> {h.treatment}
            </p>
          )}
        </>
      )}

      {mode === "edit" && <EditForm h={h} onDone={() => setMode("view")} />}
      {mode === "delete" && <DeleteForm h={h} onCancel={() => setMode("view")} />}
    </li>
  );
}

function EditForm({ h, onDone }: { h: HealthRecord; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateHealthIncident, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-surface-sunk p-3">
      <input type="hidden" name="id" value={h.id} />
      <TextInput label="What is happening?" name="title" required defaultValue={h.title} />

      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput label="Date noticed" name="occurred_on" type="date" defaultValue={h.occurred_on} max={today()} />
        <SelectInput label="How bad?" name="severity" defaultValue={h.severity ?? "medium"}>
          <option value="low">Low — a few birds</option>
          <option value="medium">Medium — spreading</option>
          <option value="high">High — many birds</option>
          <option value="critical">Critical — losing birds</option>
        </SelectInput>
        <NumberInput label="Birds affected" name="birds_affected" min={0} defaultValue={h.birds_affected ?? ""} />
      </div>

      <TextArea label="Symptoms" name="symptoms" defaultValue={h.symptoms ?? ""} />
      <TextArea label="What have you done so far?" name="treatment" defaultValue={h.treatment ?? ""} />

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

function DeleteForm({ h, onCancel }: { h: HealthRecord; onCancel: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteHealthIncident, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="mt-3 flex gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5">
      <input type="hidden" name="id" value={h.id} />
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete this incident?</p>
        <div className="mt-2">
          <TextInput
            label="Why is this being deleted?"
            name="reason"
            required
            placeholder="e.g. logged against the wrong flock"
            autoFocus
          />
        </div>
        {state.error && (
          <p role="alert" className="mt-2 text-xs text-critical">
            {state.error}
          </p>
        )}
        <div className="mt-2.5 flex gap-2">
          <Button type="submit" variant="danger" size="sm" busy={pending}>
            Delete
          </Button>
          <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
            Keep it
          </button>
        </div>
      </div>
    </form>
  );
}
