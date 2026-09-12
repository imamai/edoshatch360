"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Receipt } from "lucide-react";

import { addExpense, type ExpenseFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import type { ExpenseCategory, Farm, Flock } from "@/lib/database.types";
import { today } from "@/lib/utils";

const initial: ExpenseFormState = { error: null, ok: null };

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "chicks", label: "Chicks / stock" },
  { value: "vaccines", label: "Vaccines" },
  { value: "medication", label: "Medication" },
  { value: "labour", label: "Labour" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "transport", label: "Transport" },
  { value: "repairs", label: "Repairs" },
  { value: "equipment", label: "Equipment" },
  { value: "rent", label: "Rent" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

export function ExpenseForm({ farms, flocks }: { farms: Farm[]; flocks: Flock[] }) {
  const [state, action, pending] = useActionState(addExpense, initial);
  const [key, setKey] = useState(0);

  return (
    <Card>
      <CardHeader
        title="Record an expense"
        subtitle="Every shilling out, so profit means something"
        icon={<Receipt className="h-4 w-4" />}
      />
      <CardBody>
        <form
          key={key}
          action={async (formData) => {
            await action(formData);
            // Clear the form after a save so the next entry starts fresh.
            setKey((k) => k + 1);
          }}
          className="flex flex-col gap-3"
        >
          <TextInput
            label="What was it for?"
            name="description"
            required
            placeholder="e.g. 10 bags layers mash from Unga"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <NumberInput label="Amount" name="amount" unit="KES" decimals required min={0} placeholder="0" />
            <SelectInput label="Category" name="category" defaultValue="feed">
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Date"
              name="expense_date"
              type="date"
              defaultValue={today()}
              max={today()}
            />
            <SelectInput label="Paid how?" name="payment_method" defaultValue="cash">
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
              <option value="cheque">Cheque</option>
              <option value="credit">On credit</option>
              <option value="other">Other</option>
            </SelectInput>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Paid to" name="vendor" placeholder="Supplier or person" hint="Optional" />
            <TextInput label="Reference" name="reference" placeholder="Receipt or M-Pesa code" hint="Optional" />
          </div>

          {flocks.length > 0 && (
            <SelectInput
              label="For a particular flock?"
              name="flock_id"
              defaultValue=""
              hint="Attach it to a flock to get true cost and profit per batch."
            >
              <option value="">Whole farm</option>
              {flocks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code}
                  {f.name ? ` · ${f.name}` : ""}
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
            {pending ? "Saving" : "Record expense"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
