"use client";

import { useActionState } from "react";
import { CheckCircle2, Printer } from "lucide-react";

import { recordPayment, type SaleFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";

const initial: SaleFormState = { error: null, ok: null };

export function PaymentForm({
  saleId,
  balanceCents,
  currency,
}: {
  saleId: string;
  balanceCents: number;
  currency: string;
}) {
  const [state, action, pending] = useActionState(recordPayment, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sale_id" value={saleId} />

      <NumberInput
        label="Amount received"
        name="amount"
        unit={currency}
        decimals
        required
        min={0}
        max={balanceCents / 100}
        defaultValue={balanceCents / 100}
        hint={`Outstanding: ${(balanceCents / 100).toLocaleString()} ${currency}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectInput label="How?" name="method" defaultValue="cash">
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
          <option value="bank">Bank transfer</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </SelectInput>
        <TextInput label="Reference" name="reference" placeholder="M-Pesa code" hint="Optional" />
      </div>

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

      <Button type="submit" busy={pending}>
        {pending ? "Recording" : "Record payment"}
      </Button>
    </form>
  );
}

/**
 * Printing is the browser's own dialogue rather than a generated PDF: it
 * reaches a real printer and a "save as PDF" option on every platform, with
 * no library to ship over a slow connection.
 */
export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      Print or save as PDF
    </Button>
  );
}
