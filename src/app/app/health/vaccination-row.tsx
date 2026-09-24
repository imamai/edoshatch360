"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, TriangleAlert } from "lucide-react";

import {
  deleteVaccination, updateVaccination, type HealthFormState,
} from "./actions";
import { MarkGivenForm, type Person } from "./health-forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NumberInput, TextArea, TextInput } from "@/components/ui/field";
import { Picker, SimplePicker } from "@/components/ui/picker";
import { VACCINE_ROUTES, VACCINE_TYPES } from "@/lib/catalogues";
import { relativeDay, today } from "@/lib/utils";
import type { Vaccination } from "@/lib/database.types";

const initial: HealthFormState = { error: null, ok: null };

function Feedback({ state }: { state: HealthFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return <p className="text-sm text-good">{state.ok}</p>;
  }
  return null;
}

export function VaccinationRow({
  v,
  flockCode,
  givenBy,
  supervisedBy,
  isOverdue,
  people,
  suggestedBirds,
  canManage,
}: {
  v: Vaccination;
  flockCode: string;
  givenBy: string | null;
  supervisedBy: string | null;
  isOverdue: boolean;
  people: Person[];
  suggestedBirds: number;
  canManage: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");

  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{v.vaccine}</p>
          <p className="text-xs text-ink-faint">
            {flockCode}
            {v.day_of_age !== null ? ` · day ${v.day_of_age}` : ""} ·{" "}
            {v.status === "done" ? `given ${v.administered_on ?? ""}` : relativeDay(v.due_date)}
          </p>

          {v.status === "done" && (givenBy || supervisedBy || v.batch_no) && (
            <p className="mt-1 text-xs text-ink-soft">
              {givenBy && <>By {givenBy}</>}
              {supervisedBy && <> · supervised by {supervisedBy}</>}
              {v.batch_no && <> · batch {v.batch_no}</>}
              {v.route && <> · {v.route.toLowerCase()}</>}
            </p>
          )}

          {v.reaction_notes && (
            <p className="mt-1 text-xs text-attention">Reaction noted: {v.reaction_notes}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {v.status === "done" ? (
            <Badge tone="good" dot>Given</Badge>
          ) : (
            <Badge tone={isOverdue ? "critical" : "attention"} dot>
              {isOverdue ? "Overdue" : "Due"}
            </Badge>
          )}
          {canManage && mode === "view" && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setMode("edit")}
                aria-label={`Edit ${v.vaccine}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMode("delete")}
                aria-label={`Delete ${v.vaccine}`}
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "view" && v.status !== "done" && (
        <MarkGivenForm
          id={v.id}
          vaccine={v.vaccine}
          people={people}
          suggestedBirds={suggestedBirds}
          defaultRoute={v.route}
        />
      )}

      {mode === "edit" && <EditForm v={v} onDone={() => setMode("view")} />}
      {mode === "delete" && <DeleteForm v={v} onCancel={() => setMode("view")} />}
    </li>
  );
}

function EditForm({ v, onDone }: { v: Vaccination; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateVaccination, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form
      action={action}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-line bg-surface-sunk p-3"
    >
      <input type="hidden" name="id" value={v.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Picker
          label="Vaccine"
          name="vaccine"
          groups={VACCINE_TYPES}
          required
          defaultValue={v.vaccine}
          otherLabel="Not listed — let me type it"
          otherPlaceholder="Vaccine name"
        />
        <TextInput
          label="Disease target"
          name="disease_target"
          defaultValue={v.disease_target ?? ""}
          hint="Optional"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Due date" name="due_date" type="date" required defaultValue={v.due_date} />
        <SimplePicker
          label="How is it given?"
          name="route"
          options={VACCINE_ROUTES}
          defaultValue={v.route ?? ""}
          placeholder="Select a route…"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Dose" name="dose" defaultValue={v.dose ?? ""} placeholder="e.g. 0.5 ml per bird" hint="Optional" />
        <TextInput label="Manufacturer" name="manufacturer" defaultValue={v.manufacturer ?? ""} hint="Optional" />
      </div>

      {v.status === "done" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput
              label="Date given"
              name="administered_on"
              type="date"
              defaultValue={v.administered_on ?? ""}
              max={today()}
            />
            <NumberInput label="Birds covered" name="birds_covered" min={0} defaultValue={v.birds_covered ?? ""} />
            <NumberInput label="Cost" name="cost" unit="KES" decimals min={0} defaultValue={v.cost_cents / 100} />
          </div>
          <TextInput label="Vial batch no." name="batch_no" defaultValue={v.batch_no ?? ""} hint="Optional" />
          <TextArea
            label="Any reaction afterwards?"
            name="reaction_notes"
            rows={2}
            defaultValue={v.reaction_notes ?? ""}
          />
        </>
      )}

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

function DeleteForm({ v, onCancel }: { v: Vaccination; onCancel: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteVaccination, initial);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form
      action={action}
      className="mt-3 flex gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5"
    >
      <input type="hidden" name="id" value={v.id} />
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-critical">Delete {v.vaccine}?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          This removes the dose entirely — schedule it again if it was needed.
        </p>
        <div className="mt-2">
          <TextInput
            label="Why is this being deleted?"
            name="reason"
            required
            placeholder="e.g. scheduled against the wrong flock"
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
