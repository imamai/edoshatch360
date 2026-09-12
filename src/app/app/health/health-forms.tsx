"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Plus, Sparkles, Stethoscope } from "lucide-react";

import {
  addHealthIncident, addVaccination, applyVaccinationProgramme,
  recordVaccinationGiven, type HealthFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { Picker, SimplePicker } from "@/components/ui/picker";
import { VACCINE_ROUTES, VACCINE_TYPES } from "@/lib/catalogues";
import type { AppUser, Flock } from "@/lib/database.types";
import { today } from "@/lib/utils";

export type Person = Pick<AppUser, "id" | "full_name" | "email">;

const personLabel = (p: Person) => p.full_name ?? p.email ?? "Team member";

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
    return (
      <p className="flex items-center gap-2 rounded-lg border border-good/25 bg-good-soft px-3 py-2 text-sm text-good">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {state.ok}
      </p>
    );
  }
  return null;
}

/** One-click standard programme for a flock, then edit from there. */
export function ProgrammeForm({ flocks }: { flocks: Flock[] }) {
  const [state, action, pending] = useActionState(applyVaccinationProgramme, initial);

  return (
    <Card>
      <CardHeader
        title="Set up a vaccination programme"
        subtitle="Schedules the standard doses by day of age"
        icon={<Sparkles className="h-4 w-4" />}
      />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <SelectInput label="Flock" name="flock_id" required defaultValue={flocks[0]?.id ?? ""}>
            {flocks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code}
                {f.name ? ` · ${f.name}` : ""}
              </option>
            ))}
          </SelectInput>

          <Feedback state={state} />

          <Button type="submit" busy={pending} className="self-start">
            {!pending && <Plus className="h-4 w-4" />}
            {pending ? "Scheduling" : "Schedule standard doses"}
          </Button>

          <p className="text-xs leading-relaxed text-ink-faint">
            These are the common commercial schedules used in Kenya as a starting
            point. Review every dose with your animal health officer — Hatch360
            reminds you, it does not prescribe.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}

export function AddVaccinationForm({ flocks }: { flocks: Flock[] }) {
  const [state, action, pending] = useActionState(addVaccination, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} size="sm">
        <Plus className="h-4 w-4" />
        Add a single dose
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader title="Add a vaccination" icon={<Plus className="h-4 w-4" />} />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <SelectInput label="Flock" name="flock_id" required defaultValue={flocks[0]?.id ?? ""}>
            {flocks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code}
              </option>
            ))}
          </SelectInput>

          <Picker
            label="Vaccine"
            name="vaccine"
            groups={VACCINE_TYPES}
            required
            placeholder="Choose a vaccine…"
            otherLabel="Not listed — let me type it"
            otherPlaceholder="Vaccine name"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Due date" name="due_date" type="date" required defaultValue={today()} />
            <SimplePicker
              label="How is it given?"
              name="route"
              options={VACCINE_ROUTES}
              placeholder="Select a route…"
              hint="Optional"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Dose" name="dose" placeholder="e.g. 0.5 ml per bird" hint="Optional" />
            <TextInput label="Manufacturer" name="manufacturer" placeholder="e.g. Cooper K-Brands" hint="Optional" />
          </div>

          <Feedback state={state} />

          <div className="flex gap-2">
            <Button type="submit" busy={pending}>
              {pending ? "Saving" : "Schedule dose"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function AddIncidentForm({ flocks }: { flocks: Flock[] }) {
  const [state, action, pending] = useActionState(addHealthIncident, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} size="sm">
        <Stethoscope className="h-4 w-4" />
        Record a health problem
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Record a health problem"
        subtitle="What you saw, what you did"
        icon={<Stethoscope className="h-4 w-4" />}
      />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <SelectInput label="Flock" name="flock_id" required defaultValue={flocks[0]?.id ?? ""}>
            {flocks.map((f) => (
              <option key={f.id} value={f.id}>
                {f.code}
              </option>
            ))}
          </SelectInput>

          <TextInput
            label="What is happening?"
            name="title"
            required
            placeholder="e.g. Coughing and nasal discharge in the corner pen"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput label="Date noticed" name="occurred_on" type="date" defaultValue={today()} max={today()} />
            <SelectInput label="How bad?" name="severity" defaultValue="medium">
              <option value="low">Low — a few birds</option>
              <option value="medium">Medium — spreading</option>
              <option value="high">High — many birds</option>
              <option value="critical">Critical — losing birds</option>
            </SelectInput>
            <NumberInput label="Birds affected" name="birds_affected" min={0} placeholder="0" />
          </div>

          <TextArea
            label="Symptoms"
            name="symptoms"
            placeholder="Describe what you can see — droppings, breathing, appetite, movement."
          />
          <TextArea
            label="What have you done so far?"
            name="treatment"
            placeholder="Treatment given, who you called, what changed."
          />

          <Feedback state={state} />

          <div className="flex gap-2">
            <Button type="submit" busy={pending}>
              {pending ? "Saving" : "Record it"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-ink-faint">
            Recording a problem is not a diagnosis. If birds are dying, call your
            veterinarian or animal health officer.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}

/**
 * Records a dose as given, capturing who did it and who supervised.
 *
 * Deliberately not a one-click button: a vaccination record without a name
 * against it is of no use in a disease investigation or a buyer's audit, and
 * asking afterwards never works.
 */
export function MarkGivenForm({
  id,
  vaccine,
  people,
  suggestedBirds,
  defaultRoute,
}: {
  id: string;
  vaccine: string;
  people: Person[];
  suggestedBirds: number;
  defaultRoute?: string | null;
}) {
  const [state, action, pending] = useActionState(recordVaccinationGiven, initial);
  const [open, setOpen] = useState(false);
  const [byUser, setByUser] = useState(people[0]?.id ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Record ${vaccine} as given`}
        className="rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-good hover:bg-good-soft hover:text-good"
      >
        Record as given
      </button>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 flex w-full flex-col gap-3 rounded-lg border border-line bg-surface-sunk p-3"
    >
      <input type="hidden" name="id" value={id} />

      <p className="text-sm font-semibold text-ink">Record {vaccine} as given</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput
          label="Who gave it?"
          name="administered_by"
          value={byUser}
          onChange={(e) => setByUser(e.target.value)}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {personLabel(p)}
            </option>
          ))}
          <option value="">Someone else — not on the system</option>
        </SelectInput>

        {byUser === "" ? (
          <TextInput
            label="Their name"
            name="administered_name"
            required
            placeholder="e.g. Dr Otieno, visiting vet"
          />
        ) : (
          <TextInput label="Date given" name="administered_on" type="date" defaultValue={today()} max={today()} />
        )}
      </div>

      {byUser === "" && (
        <TextInput label="Date given" name="administered_on" type="date" defaultValue={today()} max={today()} />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput label="Who supervised?" name="supervised_by" defaultValue="">
          <option value="">Nobody / not recorded</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {personLabel(p)}
            </option>
          ))}
        </SelectInput>
        <TextInput
          label="Or a supervisor not on the system"
          name="supervisor_name"
          placeholder="Name"
          hint="Optional"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SimplePicker
          label="How was it given?"
          name="route"
          options={VACCINE_ROUTES}
          defaultValue={defaultRoute ?? ""}
          placeholder="Select a route…"
        />
        <NumberInput
          label="Birds covered"
          name="birds_covered"
          min={0}
          defaultValue={suggestedBirds || ""}
          placeholder="0"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput label="Vial batch no." name="batch_no" placeholder="From the label" hint="For traceability" />
        <TextInput label="Expiry" name="expiry_date" type="date" hint="Optional" />
        <NumberInput label="Cost" name="cost" unit="KES" decimals min={0} placeholder="0" />
      </div>

      <TextArea
        label="Any reaction afterwards?"
        name="reaction_notes"
        rows={2}
        placeholder="Leave blank if the flock took it normally."
      />

      <Feedback state={state} />

      <div className="flex gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save record"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
