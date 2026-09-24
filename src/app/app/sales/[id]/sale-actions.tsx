"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";

import {
  deleteSale,
  updateSaleDetails,
  updateSaleItems,
  voidSale,
  type CartLine,
  type SaleFormState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { NumberInput, SelectInput, TextArea, TextInput } from "@/components/ui/field";
import { formatMoney } from "@/lib/utils";
import type { Customer, Sale, SaleItem } from "@/lib/database.types";

const initial: SaleFormState = { error: null, ok: null };

function Feedback({ state }: { state: SaleFormState }) {
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

/**
 * Everything to fix a sale raised wrong, once it exists.
 *
 * Details (who it's for, when, notes) are always correctable — they never
 * change what anyone owes. Items are correctable only up to the first
 * payment, because rewriting them under an amount someone has already paid
 * would make that amount mean something different than it did when it was
 * received; void is the way back from there. Delete only ever applies before
 * that same line, for a document that should not have existed at all.
 */
export function SaleActions({
  sale,
  items,
  customers,
  currency,
  canManage,
}: {
  sale: Sale;
  items: SaleItem[];
  customers: Pick<Customer, "id" | "name">[];
  currency: string;
  canManage: boolean;
}) {
  const [panel, setPanel] = useState<"details" | "items" | "void" | "delete" | null>(null);

  if (!canManage) return null;

  const voided = sale.status === "cancelled";
  const locked = sale.amount_paid_cents > 0;

  const toggle = (key: typeof panel) => setPanel((p) => (p === key ? null : key));

  return (
    <div className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        {!voided && (
          <Button variant="secondary" size="sm" onClick={() => toggle("details")}>
            <Pencil className="h-4 w-4" />
            Edit details
          </Button>
        )}
        {!voided && !locked && (
          <Button variant="secondary" size="sm" onClick={() => toggle("items")}>
            <Pencil className="h-4 w-4" />
            Edit items
          </Button>
        )}
        {!voided && (
          <Button variant="secondary" size="sm" onClick={() => toggle("void")}>
            <Ban className="h-4 w-4" />
            Void
          </Button>
        )}
        {!locked && (
          <Button variant="danger" size="sm" onClick={() => toggle("delete")}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      {locked && !voided && (
        <p className="text-xs text-ink-faint">
          A payment has been recorded against this document, so its items and totals are locked.
          Void it to undo it, or record a correcting adjustment instead.
        </p>
      )}

      {panel === "details" && (
        <Card>
          <CardBody>
            <DetailsForm sale={sale} customers={customers} onDone={() => setPanel(null)} />
          </CardBody>
        </Card>
      )}
      {panel === "items" && (
        <Card>
          <CardBody>
            <ItemsForm sale={sale} items={items} currency={currency} onDone={() => setPanel(null)} />
          </CardBody>
        </Card>
      )}
      {panel === "void" && (
        <Card>
          <CardBody>
            <VoidForm sale={sale} onDone={() => setPanel(null)} />
          </CardBody>
        </Card>
      )}
      {panel === "delete" && <DeleteConfirm sale={sale} onCancel={() => setPanel(null)} />}
    </div>
  );
}

/* ----------------------------------------------------------- details -- */

function DetailsForm({
  sale,
  customers,
  onDone,
}: {
  sale: Sale;
  customers: Pick<Customer, "id" | "name">[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateSaleDetails, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={sale.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput label="Customer" name="customer_id" defaultValue={sale.customer_id ?? ""}>
          <option value="">Walk-in — no customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput label="Paid by" name="payment_method" defaultValue={sale.payment_method ?? ""}>
          <option value="">Not set</option>
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
          <option value="bank">Bank transfer</option>
          <option value="credit">Credit</option>
          <option value="cheque">Cheque</option>
          <option value="other">Other</option>
        </SelectInput>
        <TextInput label="Date" name="sale_date" type="date" defaultValue={sale.sale_date} required />
        <TextInput label="Due date" name="due_date" type="date" defaultValue={sale.due_date ?? ""} />
      </div>
      <TextArea label="Notes" name="notes" rows={2} defaultValue={sale.notes ?? ""} />

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

/* ------------------------------------------------------------- items -- */

interface EditLine extends CartLine {
  key: string;
}

const newLine = (): EditLine => ({
  key: Math.random().toString(36).slice(2),
  productId: null,
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

function ItemsForm({
  sale,
  items,
  currency,
  onDone,
}: {
  sale: Sale;
  items: SaleItem[];
  currency: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateSaleItems, initial);
  const [lines, setLines] = useState<EditLine[]>(() =>
    items.length
      ? items.map((i) => ({
          key: i.id,
          productId: i.product_id,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: i.unit_price_cents / 100,
          discount: i.discount_cents / 100,
        }))
      : [newLine()],
  );

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  const set = <K extends keyof EditLine>(key: string, field: K, value: EditLine[K]) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));

  const total = lines.reduce(
    (sum, l) => sum + Math.max(0, l.quantity * l.unitPrice - l.discount),
    0,
  );

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        // The lines travel as JSON in a hidden field — the same shape
        // createSale already sends, so the same server-side validation and
        // the same rollup trigger apply either way.
        const input = e.currentTarget.elements.namedItem("lines") as HTMLInputElement;
        const payload: CartLine[] = lines.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
        }));
        input.value = JSON.stringify(payload);
      }}
    >
      <input type="hidden" name="id" value={sale.id} />
      <input type="hidden" name="lines" />

      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <div key={line.key} className="grid grid-cols-12 items-end gap-2">
            <div className="col-span-12 sm:col-span-5">
              <TextInput
                label="Item"
                value={line.description}
                onChange={(e) => set(line.key, "description", e.target.value)}
                placeholder="What was sold"
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <NumberInput
                label="Qty"
                min={0}
                decimals
                value={line.quantity}
                onChange={(e) => set(line.key, "quantity", Number(e.target.value))}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <NumberInput
                label="Price"
                min={0}
                decimals
                value={line.unitPrice}
                onChange={(e) => set(line.key, "unitPrice", Number(e.target.value))}
              />
            </div>
            <div className="col-span-3 sm:col-span-2">
              <NumberInput
                label="Discount"
                min={0}
                decimals
                value={line.discount}
                onChange={(e) => set(line.key, "discount", Number(e.target.value))}
              />
            </div>
            <div className="col-span-1 flex justify-end pb-1.5">
              <button
                type="button"
                onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== line.key) : ls))}
                aria-label="Remove this line"
                className="rounded-md p-2 text-ink-faint hover:bg-surface-sunk hover:text-critical"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, newLine()])}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
        >
          <Plus className="h-4 w-4" />
          Add a line
        </button>
        <p className="text-sm text-ink-soft">
          New total:{" "}
          <span className="font-semibold text-ink tnum">
            {formatMoney(Math.round(total * 100), { currency })}
          </span>
        </p>
      </div>

      <Feedback state={state} />

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save items"}
        </Button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------- void -- */

function VoidForm({ sale, onDone }: { sale: Sale; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(voidSale, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={sale.id} />
      <div className="flex gap-2.5 rounded-lg border border-attention/25 bg-attention-soft px-3 py-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-ink-soft">
          {sale.doc_number} is kept and marked voided — its number stays on record and it drops
          out of every &ldquo;owed to you&rdquo; figure. This does not undo any payment already
          recorded; delete the payment first if one was taken by mistake.
        </p>
      </div>
      <TextInput
        label="Why is this being voided?"
        name="reason"
        required
        placeholder="e.g. raised against the wrong customer"
        autoFocus
      />

      <Feedback state={state} />

      <div className="flex items-center gap-2">
        <Button type="submit" variant="danger" size="sm" busy={pending}>
          {pending ? "Voiding" : "Void this document"}
        </Button>
        <button type="button" onClick={onDone} className="text-sm font-semibold text-ink-faint hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------ delete -- */

function DeleteConfirm({ sale, onCancel }: { sale: Sale; onCancel: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    start(async () => {
      const result = await deleteSale(sale.id);
      if (result.error) setError(result.error);
      else router.push("/app/sales");
    });
  }

  return (
    <Card>
      <CardBody>
        <div className="flex gap-2.5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-critical">Delete {sale.doc_number} permanently?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              Nothing has been paid against it, so nothing else refers to it. This cannot be
              undone — its items go with it, and the document number is not reused.
            </p>
            {error && (
              <p role="alert" className="mt-2 text-xs text-critical">
                {error}
              </p>
            )}
            <div className="mt-2.5 flex gap-2">
              <Button variant="danger" size="sm" busy={pending} onClick={remove}>
                Delete for good
              </Button>
              <button type="button" onClick={onCancel} className="text-sm font-semibold text-ink-faint hover:text-ink">
                Keep it
              </button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
