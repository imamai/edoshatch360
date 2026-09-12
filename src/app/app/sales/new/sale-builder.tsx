"use client";

import { useActionState, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { createSale, type SaleFormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import type { Customer, DocType, Product } from "@/lib/database.types";
import { cn, formatMoney, today } from "@/lib/utils";

const initial: SaleFormState = { error: null, ok: null };

interface Line {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

const DOC_TYPES: { value: DocType; label: string; note: string }[] = [
  { value: "receipt", label: "Receipt", note: "Paid on the spot" },
  { value: "invoice", label: "Invoice", note: "To be paid later" },
  { value: "quotation", label: "Quotation", note: "A price, not yet a sale" },
];

let nextId = 0;
const newLine = (): Line => ({
  id: `l${nextId++}`,
  productId: null,
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

export function SaleBuilder({
  products,
  customers,
  currency,
}: {
  products: Product[];
  customers: Customer[];
  currency: string;
}) {
  const [state, action, pending] = useActionState(createSale, initial);
  const [docType, setDocType] = useState<DocType>("receipt");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [paid, setPaid] = useState<number | "">("");

  const total = useMemo(
    () =>
      lines.reduce(
        (a, l) => a + Math.max(0, l.quantity * l.unitPrice - Math.max(0, l.discount)),
        0,
      ),
    [lines],
  );

  function update(id: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function pickProduct(id: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    update(id, {
      productId: productId || null,
      description: product ? product.name : "",
      // Seed the price from the catalogue, but leave it editable — farm-gate
      // prices move, and the person at the counter knows today's.
      unitPrice: product ? product.default_price_cents / 100 : 0,
    });
  }

  const balance = Math.max(0, total - (Number(paid) || 0));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="doc_type" value={docType} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map((l) => ({
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
        )}
      />

      <Card>
        <CardBody>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">What are you creating?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {DOC_TYPES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDocType(d.value)}
                  aria-pressed={docType === d.value}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    docType === d.value
                      ? "border-brand bg-brand-tint ring-1 ring-brand/20"
                      : "border-line hover:border-line-strong",
                  )}
                >
                  <span className="block text-sm font-semibold text-ink">{d.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-faint">{d.note}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What are you selling?" />
        <CardBody className="flex flex-col gap-3">
          {lines.map((line, i) => {
            const lineTotal = Math.max(
              0,
              line.quantity * line.unitPrice - Math.max(0, line.discount),
            );
            return (
              <div key={line.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-faint">Item {i + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.id !== line.id))}
                      aria-label={`Remove item ${i + 1}`}
                      className="text-ink-faint hover:text-critical"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                  <SelectInput
                    label="Product"
                    value={line.productId ?? ""}
                    onChange={(e) => pickProduct(line.id, e.target.value)}
                  >
                    <option value="">Choose or type below…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </SelectInput>

                  <TextInput
                    label="Description"
                    value={line.description}
                    onChange={(e) => update(line.id, { description: e.target.value })}
                    placeholder="What the customer is buying"
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-ink">Quantity</span>
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          update(line.id, { quantity: Math.max(0, line.quantity - 1) })
                        }
                        aria-label="Decrease quantity"
                        className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-soft hover:border-brand"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min={0}
                        value={line.quantity}
                        onChange={(e) => update(line.id, { quantity: Number(e.target.value) })}
                        className="h-12 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-2 text-center text-lg font-medium text-ink tnum focus:border-brand focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => update(line.id, { quantity: line.quantity + 1 })}
                        aria-label="Increase quantity"
                        className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-soft hover:border-brand"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <NumberInput
                    label="Unit price"
                    unit={currency}
                    decimals
                    min={0}
                    value={line.unitPrice}
                    onChange={(e) => update(line.id, { unitPrice: Number(e.target.value) })}
                  />

                  <NumberInput
                    label="Discount"
                    unit={currency}
                    decimals
                    min={0}
                    value={line.discount}
                    onChange={(e) => update(line.id, { discount: Number(e.target.value) })}
                  />

                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-ink">Line total</span>
                    <p className="flex h-12 items-center rounded-lg bg-surface-sunk px-3 text-lg font-semibold text-ink tnum">
                      {formatMoney(Math.round(lineTotal * 100), { currency })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="self-start"
          >
            <Plus className="h-4 w-4" />
            Add another item
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Customer and payment" />
        <CardBody className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput
              label="Customer"
              name="customer_id"
              defaultValue=""
              hint={
                docType === "receipt"
                  ? "Optional for a walk-in sale"
                  : "Needed so you know who owes you"
              }
            >
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </option>
              ))}
            </SelectInput>

            <TextInput label="Date" name="sale_date" type="date" defaultValue={today()} />
          </div>

          {docType !== "quotation" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectInput label="Paid how?" name="payment_method" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit">On credit — not paid yet</option>
                </SelectInput>

                <NumberInput
                  label="Amount paid now"
                  name="amount_paid"
                  unit={currency}
                  decimals
                  min={0}
                  value={paid}
                  onChange={(e) =>
                    setPaid(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0"
                  hint="Leave blank if nothing was paid yet"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="Payment reference"
                  name="payment_reference"
                  placeholder="M-Pesa code"
                  hint="Optional"
                />
                {docType === "invoice" && (
                  <TextInput label="Payment due by" name="due_date" type="date" hint="Optional" />
                )}
              </div>
            </>
          )}

          <TextArea label="Notes" name="notes" rows={2} placeholder="Optional" />
        </CardBody>
      </Card>

      {state.error && (
        <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical">
          {state.error}
        </p>
      )}

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-xl border border-line bg-surface/95 p-4 shadow-raised backdrop-blur-sm md:bottom-4 md:flex-row md:items-center md:justify-between">
        <dl className="flex items-center gap-5">
          <div>
            <dt className="text-xs text-ink-faint">Total</dt>
            <dd className="font-display text-xl font-extrabold text-ink tnum">
              {formatMoney(Math.round(total * 100), { currency })}
            </dd>
          </div>
          {docType !== "quotation" && balance > 0 && (
            <div>
              <dt className="text-xs text-ink-faint">Balance</dt>
              <dd className="font-display text-xl font-extrabold text-attention tnum">
                {formatMoney(Math.round(balance * 100), { currency })}
              </dd>
            </div>
          )}
        </dl>

        <Button type="submit" size="lg" busy={pending} className="w-full md:w-auto">
          {pending ? "Saving" : `Create ${docType}`}
        </Button>
      </div>
    </form>
  );
}
