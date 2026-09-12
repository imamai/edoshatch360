"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Pencil, Plus, RotateCcw, Trash2, TriangleAlert, X,
} from "lucide-react";

import {
  createProduct, deleteProduct, setProductActive, updateProduct,
  type ProductFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NumberInput, SelectInput, TextInput } from "@/components/ui/field";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/catalogues";
import type { Product } from "@/lib/database.types";
import { cn, formatMoney } from "@/lib/utils";

const initial: ProductFormState = { error: null, ok: null };

function Feedback({ state }: { state: ProductFormState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical"
      >
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

export function ProductManager({
  products,
  currency,
  soldCount,
}: {
  products: Product[];
  currency: string;
  /** Document lines each product appears on, keyed by product id. */
  soldCount: Record<string, number>;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const active = products.filter((p) => p.is_active);
  const retired = products.filter((p) => !p.is_active);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------------------------------------ add -- */}
      {adding ? (
        <AddForm onDone={() => setAdding(false)} />
      ) : (
        <div>
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add a product
          </Button>
        </div>
      )}

      {/* --------------------------------------------------------- active -- */}
      <Card>
        <CardHeader
          title="On the till"
          subtitle={
            active.length === 0
              ? "Nothing here yet — the Counter will have no tiles."
              : `${active.length} product${active.length === 1 ? "" : "s"}`
          }
        />
        <CardBody className="p-0">
          {active.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-soft">
              Add your first product and it appears on the Counter straight away.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {active.map((p) =>
                editing === p.id ? (
                  <li key={p.id} className="bg-surface-sunk px-4 py-4">
                    <EditForm product={p} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <ProductRow
                    key={p.id}
                    product={p}
                    currency={currency}
                    sold={soldCount[p.id] ?? 0}
                    confirming={confirming === p.id}
                    onEdit={() => setEditing(p.id)}
                    onConfirm={() => setConfirming(p.id)}
                    onCancelConfirm={() => setConfirming(null)}
                  />
                ),
              )}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* -------------------------------------------------------- retired -- */}
      {retired.length > 0 && (
        <Card>
          <CardHeader
            title="Retired"
            subtitle="Off the till, but everything they have already sold is untouched."
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {retired.map((p) =>
                editing === p.id ? (
                  <li key={p.id} className="bg-surface-sunk px-4 py-4">
                    <EditForm product={p} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <ProductRow
                    key={p.id}
                    product={p}
                    currency={currency}
                    sold={soldCount[p.id] ?? 0}
                    confirming={confirming === p.id}
                    onEdit={() => setEditing(p.id)}
                    onConfirm={() => setConfirming(p.id)}
                    onCancelConfirm={() => setConfirming(null)}
                  />
                ),
              )}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ row -- */

function ProductRow({
  product,
  currency,
  sold,
  confirming,
  onEdit,
  onConfirm,
  onCancelConfirm,
}: {
  product: Product;
  currency: string;
  sold: number;
  confirming: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const category = PRODUCT_CATEGORIES.find((c) => c.value === product.category);

  function run(fn: () => Promise<ProductFormState>) {
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      else {
        setError(null);
        onCancelConfirm();
        router.refresh();
      }
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="truncate">{product.name}</span>
            {!product.is_active && <Badge tone="neutral">Retired</Badge>}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {category?.label ?? product.category} · per {product.unit}
            {sold > 0 && ` · on ${sold} document${sold === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-display text-base font-extrabold text-brand tnum">
            {formatMoney(product.default_price_cents, { currency })}
          </span>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${product.name}`}
              className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-brand"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {product.is_active ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setProductActive(product.id, false))}
                aria-label={`Retire ${product.name}`}
                title="Take it off the till, keep its history"
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-attention"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setProductActive(product.id, true))}
                aria-label={`Put ${product.name} back on the till`}
                title="Put it back on the till"
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-good"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              aria-label={`Delete ${product.name}`}
              className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-critical"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Deleting is fine for the books and costly for reporting. Say which. */}
      {confirming && (
        <div className="mt-3 flex gap-2.5 rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-critical" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-critical">
              Delete {product.name} permanently?
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              {sold > 0 ? (
                <>
                  It appears on <strong>{sold}</strong> document line
                  {sold === 1 ? "" : "s"}. Those invoices and receipts keep their
                  wording and their prices exactly as issued — but they stop being
                  linked to this product, so it will no longer group in reports.{" "}
                  <strong>Retiring it instead</strong> keeps the link and takes it
                  off the till.
                </>
              ) : (
                <>It has never been sold, so nothing else refers to it.</>
              )}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="danger"
                size="sm"
                busy={pending}
                onClick={() => run(() => deleteProduct(product.id))}
              >
                Delete for good
              </Button>
              <button
                type="button"
                onClick={onCancelConfirm}
                className="text-sm font-semibold text-ink-faint hover:text-ink"
              >
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-critical">
          {error}
        </p>
      )}
    </li>
  );
}

/* ----------------------------------------------------------------- forms -- */

function Fields({ product }: { product?: Product }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInput
        label="Name"
        name="name"
        required
        defaultValue={product?.name ?? ""}
        placeholder="Eggs (tray of 30)"
        hint="What whoever is serving would call it"
      />
      <SelectInput label="Kind" name="category" defaultValue={product?.category ?? "eggs"}>
        {PRODUCT_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </SelectInput>
      <SelectInput label="Sold by" name="unit" defaultValue={product?.unit ?? "tray"}>
        {PRODUCT_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
        {/* A unit already in use that is not on the list must stay selectable,
            or editing an old product would silently change how it is sold. */}
        {product && !PRODUCT_UNITS.some((u) => u.value === product.unit) && (
          <option value={product.unit}>{product.unit}</option>
        )}
      </SelectInput>
      <NumberInput
        label="Price"
        name="price"
        required
        min={0}
        step="0.01"
        defaultValue={
          product ? String(product.default_price_cents / 100) : ""
        }
        placeholder="0"
        hint="What one unit sells for. It can still be changed per sale at the till."
      />
    </div>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createProduct, initial);

  // The action revalidates the route, but this view is a client component
  // holding its own open/closed state, so it has to be told to close. In an
  // effect rather than during render: rendering is not where side effects
  // belong, and scheduling from the render body would start a fresh timer on
  // every re-render while the success message is showing.
  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    // Closing is held a beat behind the refresh so the confirmation is seen
    // rather than flashing past — the data is already on its way.
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <Card>
      <CardHeader title="New product" subtitle="It appears on the Counter as soon as you save." />
      <CardBody>
        <form action={action} className="flex flex-col gap-4">
          <Fields />
          <Feedback state={state} />
          <div className="flex items-center gap-2">
            <Button type="submit" busy={pending}>
              {pending ? "Saving" : "Add product"}
            </Button>
            <button
              type="button"
              onClick={onDone}
              className="text-sm font-semibold text-ink-faint hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function EditForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProduct, initial);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    // Closing is held a beat behind the refresh so the confirmation is seen
    // rather than flashing past — the data is already on its way.
    const t = setTimeout(onDone, 350);
    return () => clearTimeout(t);
  }, [state.ok, router, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={product.id} />
      <Fields product={product} />
      <Feedback state={state} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" busy={pending}>
          {pending ? "Saving" : "Save changes"}
        </Button>
        <button
          type="button"
          onClick={onDone}
          className={cn("text-sm font-semibold text-ink-faint hover:text-ink")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
