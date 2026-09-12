"use client";

import { useActionState, useState } from "react";
import { Bird, CalendarDays, Hash, Tag } from "lucide-react";

import { createFlock, type FlockFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { SimplePicker } from "@/components/ui/picker";
import { Card } from "@/components/ui/card";
import { BREEDS, flockCodePrefix } from "@/lib/catalogues";
import type { BirdType, Farm, House } from "@/lib/database.types";
import { cn, today } from "@/lib/utils";

const BIRD_TYPES: { value: BirdType; label: string; note: string }[] = [
  { value: "broiler", label: "Broiler", note: "Raised for meat, ~5–6 weeks" },
  { value: "layer", label: "Layer", note: "Commercial egg production" },
  { value: "kienyeji", label: "Kienyeji", note: "Indigenous, dual purpose" },
  { value: "improved_kienyeji", label: "Improved kienyeji", note: "KARI, Kuroiler, Sasso" },
  { value: "breeder", label: "Breeder", note: "Producing hatching eggs" },
  { value: "chick", label: "Chicks", note: "Day-olds being brooded" },
  { value: "pullet", label: "Pullet", note: "Growing towards lay" },
  { value: "turkey", label: "Turkey", note: "" },
  { value: "other", label: "Other", note: "" },
];

const FREQUENCIES = [
  { value: "daily", label: "Every day", note: "Recommended — the trends need it" },
  { value: "weekly", label: "Once a week", note: "Lighter, less precise" },
  { value: "milestone", label: "At milestones only", note: "Vaccination, weighing, harvest" },
];

const initial: FlockFormState = { error: null };

export function NewFlockForm({ farms, houses }: { farms: Farm[]; houses: House[] }) {
  const [state, action, pending] = useActionState(createFlock, initial);
  const [birdType, setBirdType] = useState<BirdType>("broiler");
  const [dateMode, setDateMode] = useState<"date" | "age">("date");
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [breed, setBreed] = useState("");

  const housesForFarm = houses.filter((h) => h.farm_id === farmId);

  // Previewed from the same rule the database uses; Postgres stays the
  // authority on the sequence number itself.
  const farmName = farms.find((f) => f.id === farmId)?.name ?? "";
  const codePrefix = flockCodePrefix(farmName, birdType, breed);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="bird_type" value={birdType} />
      <input type="hidden" name="date_mode" value={dateMode} />

      <Card>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Bird className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ink">The birds</h2>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <TextInput
            label="Name this flock"
            name="name"
            required
            autoFocus
            placeholder="e.g. House 2 broilers — September"
            hint="Something you will recognise on a list in three months."
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              What kind of birds? <span className="text-critical">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BIRD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setBirdType(t.value)}
                  aria-pressed={birdType === t.value}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    birdType === t.value
                      ? "border-brand bg-brand-tint ring-1 ring-brand/20"
                      : "border-line hover:border-line-strong",
                  )}
                >
                  <span className="block text-sm font-semibold text-ink">{t.label}</span>
                  {t.note && (
                    <span className="mt-0.5 block text-[0.6875rem] leading-snug text-ink-faint">
                      {t.note}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <SimplePicker
              // Remounted when the bird type changes so the breed list always
              // matches the birds selected above.
              key={birdType}
              label="Breed"
              name="breed"
              onValueChange={setBreed}
              options={BREEDS[birdType] ?? []}
              placeholder="Select a breed…"
              otherLabel="Another breed — let me type it"
              otherPlaceholder="Breed name"
              hint="Optional"
            />
            <NumberInput
              label="How many birds did you place?"
              name="placement_count"
              required
              min={1}
              placeholder="0"
            />
          </div>

          {/* The batch number is generated, not typed — one less thing to get
              wrong, and it reads the same way across every farm. */}
          <div className="flex items-start gap-3 rounded-lg border border-line bg-surface-sunk p-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Tag className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">
                Batch number:{" "}
                <span className="font-semibold text-brand tnum">
                  {codePrefix}-<span className="text-ink-faint">000</span>
                </span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                The farm, the bird type, then the breed once you choose
                one. The number at the end is assigned when you save, counting
                on from your last batch of exactly this kind.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <CalendarDays className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ink">When they arrived</h2>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="flex rounded-lg border border-line-strong p-0.5">
            {(
              [
                ["date", "I know the date"],
                ["age", "I know their age"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDateMode(value)}
                aria-pressed={dateMode === value}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  dateMode === value ? "bg-brand text-white" : "text-ink-soft hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {dateMode === "date" ? (
            <TextInput
              label="Placement date"
              name="placement_date"
              type="date"
              required
              max={today()}
              defaultValue={today()}
              hint="The day the birds came onto the farm."
            />
          ) : (
            <NumberInput
              label="How old are they now?"
              name="age_days"
              unit="days"
              required
              min={0}
              placeholder="0"
              hint="We work the placement date back from this."
            />
          )}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Hash className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-ink">Where and how you will track them</h2>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput
              label="Farm"
              name="farm_id"
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              required
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectInput>

            <SelectInput label="House" name="house_id" defaultValue="">
              <option value="">Not assigned yet</option>
              {housesForFarm.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput
              label="Cost per bird"
              name="cost_per_bird"
              unit="KES"
              decimals
              min={0}
              placeholder="0"
              hint="What you paid for each chick — used for profit per bird."
            />
            <TextInput
              label="Hatchery or supplier"
              name="source_hatchery"
              placeholder="e.g. Kenchic"
              hint="Optional"
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              How often will you record data?
            </legend>
            <div className="flex flex-col gap-2">
              {FREQUENCIES.map((f, i) => (
                <label
                  key={f.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:border-line-strong has-checked:border-brand has-checked:bg-brand-tint"
                >
                  <input
                    type="radio"
                    name="entry_frequency"
                    value={f.value}
                    defaultChecked={i === 0}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{f.label}</span>
                    <span className="block text-xs text-ink-faint">{f.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button type="submit" size="lg" busy={pending}>
          {pending ? "Creating flock" : "Create flock"}
        </Button>
      </div>
    </form>
  );
}
