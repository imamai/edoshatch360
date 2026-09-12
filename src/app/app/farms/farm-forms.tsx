"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Home, MapPinPlus } from "lucide-react";

import { createFarm, createHouse, type FarmFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import type { Farm } from "@/lib/database.types";

const initial: FarmFormState = { error: null, ok: null };

function Feedback({ state }: { state: FarmFormState }) {
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

export function NewFarmForm() {
  const [state, action, pending] = useActionState(createFarm, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <MapPinPlus className="h-4 w-4" />
        Add farm
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader title="Add a farm" icon={<MapPinPlus className="h-4 w-4" />} />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <TextInput label="Farm name" name="name" required placeholder="e.g. Kirinyaga site" />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Location" name="location" placeholder="Town or area" hint="Optional" />
            <TextInput label="County" name="county" placeholder="e.g. Kiambu" hint="Optional" />
          </div>

          <Feedback state={state} />

          <div className="flex gap-2">
            <Button type="submit" busy={pending}>
              {pending ? "Saving" : "Add farm"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export function NewHouseForm({ farms }: { farms: Farm[] }) {
  const [state, action, pending] = useActionState(createHouse, initial);

  if (farms.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Add a poultry house"
        subtitle="A shed, unit or pen within a farm"
        icon={<Home className="h-4 w-4" />}
      />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <SelectInput label="Farm" name="farm_id" required defaultValue={farms[0]?.id}>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </SelectInput>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="House name" name="name" required placeholder="e.g. House 01" />
            <TextInput label="Short code" name="code" placeholder="e.g. H1" hint="Optional" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput
              label="How many birds does it hold?"
              name="capacity"
              min={0}
              placeholder="0"
              hint="Optional"
            />
            <SelectInput label="Type" name="house_type" defaultValue="">
              <option value="">Not specified</option>
              <option value="deep_litter">Deep litter</option>
              <option value="cage">Cage</option>
              <option value="slatted">Slatted floor</option>
              <option value="free_range">Free range</option>
              <option value="brooder">Brooder</option>
            </SelectInput>
          </div>

          <Feedback state={state} />

          <Button type="submit" busy={pending} className="self-start">
            {pending ? "Saving" : "Add house"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
