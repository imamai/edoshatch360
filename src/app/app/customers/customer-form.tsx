"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";

import { createCustomer, type SaleFormState } from "../sales/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import type { CustomerType } from "@/lib/database.types";

const initial: SaleFormState = { error: null, ok: null };

const TYPES: { value: CustomerType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "retailer", label: "Retailer / shop" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "school", label: "School / institution" },
  { value: "distributor", label: "Distributor" },
  { value: "other", label: "Other" },
];

export function CustomerForm() {
  const [state, action, pending] = useActionState(createCustomer, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Add customer
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader title="Add a customer" icon={<UserPlus className="h-4 w-4" />} />
      <CardBody>
        <form action={action} className="flex flex-col gap-3">
          <TextInput label="Name" name="name" required placeholder="Person or business" />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Phone" name="phone" type="tel" placeholder="07xx xxx xxx" />
            <SelectInput label="What kind of customer?" name="customer_type" defaultValue="individual">
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </SelectInput>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput label="Location" name="location" placeholder="Town or estate" hint="Optional" />
            <TextInput label="Email" name="email" type="email" hint="Optional" />
          </div>

          <NumberInput
            label="Credit limit"
            name="credit_limit"
            unit="KES"
            decimals
            min={0}
            placeholder="0"
            hint="The most you are willing to let them owe. 0 means cash only."
          />

          <TextArea label="Notes" name="notes" rows={2} placeholder="Optional" />

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

          <div className="flex gap-2">
            <Button type="submit" busy={pending}>
              {pending ? "Saving" : "Add customer"}
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
