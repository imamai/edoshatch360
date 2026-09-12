"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, PackagePlus, Plus } from "lucide-react";

import { createInventoryItem, recordStockMovement, type StockFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { Picker } from "@/components/ui/picker";
import { UNITS, itemsForCategory } from "@/lib/catalogues";
import type { Flock, InventoryCategory, InventoryItem } from "@/lib/database.types";
import { today } from "@/lib/utils";

const initial: StockFormState = { error: null, ok: null };

const CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "vaccine", label: "Vaccine" },
  { value: "medication", label: "Medication" },
  { value: "equipment", label: "Equipment" },
  { value: "packaging", label: "Packaging" },
  { value: "cleaning", label: "Cleaning supplies" },
  { value: "spare_parts", label: "Spare parts" },
  { value: "other", label: "Other" },
];

const MOVEMENTS = [
  { value: "purchase", label: "Bought stock", hint: "Adds to stock and records the expense" },
  { value: "usage", label: "Used on the farm", hint: "Takes stock out" },
  { value: "wastage", label: "Spoiled or lost", hint: "Takes stock out" },
  { value: "adjustment", label: "Stock count correction", hint: "Sets the record straight" },
];

function Feedback({ state }: { state: StockFormState }) {
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

export function NewItemForm({
  defaultCategory = "feed",
  lockCategory = false,
}: {
  defaultCategory?: InventoryCategory;
  lockCategory?: boolean;
}) {
  const [state, action, pending] = useActionState(createInventoryItem, initial);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<InventoryCategory>(defaultCategory);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <PackagePlus className="h-4 w-4" />
        Add an item
      </Button>
    );
  }

  const groups = itemsForCategory(category);

  return (
    <Card>
      <CardHeader title="Add a stock item" icon={<PackagePlus className="h-4 w-4" />} />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          {lockCategory && <input type="hidden" name="category" value={defaultCategory} />}

          <div className="grid gap-3 sm:grid-cols-2">
            {!lockCategory && (
              <SelectInput
                label="Category"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as InventoryCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </SelectInput>
            )}
            <SelectInput label="Unit" name="unit" defaultValue="kg">
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </SelectInput>
          </div>

          {/* Remounted per category so the list always matches the kind of
              thing being added. */}
          {groups.length > 0 ? (
            <Picker
              key={category}
              label="What is it?"
              name="name"
              groups={groups}
              required
              placeholder="Choose from the list…"
              otherLabel="Not listed — let me type it"
              otherPlaceholder="e.g. Custom ration from the mill"
              hint="Picking from the list keeps your stock report from splitting one product across three spellings."
            />
          ) : (
            <TextInput
              label="What is it?"
              name="name"
              required
              placeholder="e.g. Spare fan belt"
            />
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="Stock on hand now" name="opening_stock" decimals min={0} placeholder="0" />
            <NumberInput
              label="Warn me below"
              name="reorder_level"
              decimals
              min={0}
              placeholder="0"
              hint="0 turns the alert off"
            />
            <NumberInput label="Cost per unit" name="unit_cost" unit="KES" decimals min={0} placeholder="0" />
          </div>

          <TextInput label="Supplier" name="supplier" placeholder="Who you buy it from" hint="Optional" />

          <Feedback state={state} />

          <div className="flex gap-2">
            <Button type="submit" busy={pending}>
              {pending ? "Saving" : "Add item"}
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

export function MovementForm({
  items,
  flocks,
}: {
  items: InventoryItem[];
  flocks: Flock[];
}) {
  const [state, action, pending] = useActionState(recordStockMovement, initial);
  const [type, setType] = useState("purchase");

  if (items.length === 0) return null;

  const outward = type === "usage" || type === "wastage";

  return (
    <Card>
      <CardHeader
        title="Record a stock movement"
        subtitle="Bought, used, wasted or corrected"
        icon={<Plus className="h-4 w-4" />}
      />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <SelectInput label="Item" name="item_id" required defaultValue={items[0]?.id}>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.current_stock} {i.unit})
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="What happened?"
            name="txn_type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            hint={MOVEMENTS.find((m) => m.value === type)?.hint}
          >
            {MOVEMENTS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectInput>

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="How much?" name="quantity" decimals required min={0} placeholder="0" />
            <NumberInput
              label="Cost per unit"
              name="unit_cost"
              unit="KES"
              decimals
              min={0}
              placeholder="0"
              hint={type === "purchase" ? "Also recorded as an expense" : "Optional"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Date" name="occurred_on" type="date" defaultValue={today()} max={today()} />
            {outward && flocks.length > 0 ? (
              <SelectInput label="Used for which flock?" name="flock_id" defaultValue="">
                <option value="">Not flock-specific</option>
                {flocks.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code}
                  </option>
                ))}
              </SelectInput>
            ) : (
              <TextInput
                label="Supplier or reference"
                name="reference"
                placeholder="Invoice number, supplier"
                hint="Optional"
              />
            )}
          </div>

          <TextArea label="Notes" name="notes" rows={2} placeholder="Optional" />

          <Feedback state={state} />

          <Button type="submit" busy={pending} className="self-start">
            {pending ? "Recording" : "Record movement"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
