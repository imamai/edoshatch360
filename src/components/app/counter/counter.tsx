"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check, ChevronDown, Minus, Plus, Printer, Search, ShoppingCart, Trash2, User, X,
} from "lucide-react";

import { issueSale, type IssueSaleResult } from "@/app/app/sales/actions";
import {
  SaleDocument, DOC_TITLE,
  type SaleDocumentBranding, type SaleDocumentBusiness, type SaleDocumentModel,
} from "@/components/app/sale-document";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useStoredJson } from "@/lib/hooks/use-browser-state";
import { ProductTile } from "./product-tile";
import type { Customer, DocType, PayMethod, Product } from "@/lib/database.types";
import { cn, formatMoney, today } from "@/lib/utils";

/**
 * The Counter — the till.
 *
 * The cart owns the left third and never moves: it is pinned to the viewport
 * with its own scrolling list, so a long sale stays entirely visible while the
 * catalogue scrolls beside it. Whoever is serving should never lose sight of
 * what they have rung up.
 *
 * Tap a tile and it lands in the cart; tap it again and the quantity goes up
 * rather than a second line appearing. Money is integer cents from the tile to
 * the database — nothing here holds a floating-point shilling.
 */

interface Line {
  productId: string | null;
  name: string;
  unit: string;
  unitPriceCents: number;
  qty: number;
}

const DOC_OPTIONS: { key: DocType; label: string; note: string; cta: string }[] = [
  { key: "receipt", label: "Cash sale", note: "Paid now", cta: "Complete sale" },
  { key: "invoice", label: "Invoice", note: "Pay later", cta: "Issue invoice" },
  { key: "quotation", label: "Quotation", note: "A price only", cta: "Create quotation" },
  { key: "order", label: "Sales order", note: "Agreed, not sent", cta: "Create order" },
];

const PAY_OPTIONS: { key: PayMethod; label: string; hint?: string }[] = [
  { key: "cash", label: "Cash" },
  { key: "mpesa", label: "M-Pesa", hint: "Record the M-Pesa code as the reference." },
  { key: "bank", label: "Bank", hint: "Record the slip or transfer reference." },
  { key: "credit", label: "Credit", hint: "Nothing received yet — this will show as owing." },
];

/** Days a quotation stands, and the default terms on an invoice. */
const TERM_DAYS: Partial<Record<DocType, number>> = { invoice: 14, quotation: 14 };

/** How wide the cart may be dragged, as a percentage of the screen. */
const SPLIT_KEY = "hatch360:counter-split";
const SPLIT_DEFAULT = { pct: 33 };
const SPLIT_MIN = 26;
const SPLIT_MAX = 52;

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Built in UTC on purpose: these are calendar dates, never instants, and a
  // local-time Date would shift the day for anyone east or west of the server.
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function Counter({
  products,
  customers,
  currency,
  business,
  branding,
}: {
  products: Product[];
  customers: Customer[];
  currency: string;
  business: SaleDocumentBusiness;
  branding: SaleDocumentBranding;
}) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [lines, setLines] = useState<Line[]>([]);
  const [docType, setDocType] = useState<DocType>("receipt");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [reference, setReference] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ saleId: string; docNumber: string } | null>(null);
  /** Briefly marks the line a tap just changed, so the eye can follow it. */
  const [flash, setFlash] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  // Where the user has dragged the divider, remembered between shifts.
  const [split, setSplit] = useStoredJson(SPLIT_KEY, SPLIT_DEFAULT);
  const pct = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, split.pct));

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(products.map((p) => p.category)))],
    [products],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (q === "" || p.name.toLowerCase().includes(q)),
    );
  }, [products, category, query]);

  const qtyOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of lines) if (l.productId) map.set(l.productId, l.qty);
    return map;
  }, [lines]);

  const subtotalCents = lines.reduce((a, l) => a + Math.round(l.qty * l.unitPriceCents), 0);
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const option = DOC_OPTIONS.find((d) => d.key === docType)!;
  const takesPayment = docType === "receipt";
  const customer = customers.find((c) => c.id === customerId) ?? null;

  /* ------------------------------------------------------------- cart -- */

  const addProduct = useCallback((product: Product) => {
    setError(null);
    setFlash(product.id);
    window.setTimeout(() => setFlash((f) => (f === product.id ? null : f)), 700);
    setLines((prev) => {
      const at = prev.findIndex((l) => l.productId === product.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        setAnnounce(`${product.name}, ${next[at].qty}`);
        return next;
      }
      setAnnounce(`${product.name} added`);
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          // Seeded from the catalogue but editable in the cart — farm-gate
          // prices move, and whoever is serving knows today's.
          unitPriceCents: product.default_price_cents,
          qty: 1,
        },
      ];
    });
  }, []);

  function bump(index: number, by: number) {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, qty: l.qty + by } : l)).filter((l) => l.qty > 0),
    );
  }

  function setQty(index: number, qty: number) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, qty } : l)));
  }

  function setPrice(index: number, shillings: number) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, unitPriceCents: Math.max(0, Math.round(shillings * 100)) } : l,
      ),
    );
  }

  function remove(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function startOver() {
    setLines([]);
    setCustomerId("");
    setReference("");
    setDocType("receipt");
    setPayMethod("cash");
    setIssued(null);
    setError(null);
  }

  /* ---------------------------------------------------------- divider -- */

  const drag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const shell = shellRef.current;
      if (!shell) return;
      event.preventDefault();
      const box = shell.getBoundingClientRect();

      const move = (e: PointerEvent) => {
        const next = ((e.clientX - box.left) / box.width) * 100;
        setSplit({ pct: Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, Math.round(next))) });
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
        document.body.style.userSelect = "";
      };
      // Without this, dragging selects the text either side of the divider.
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    },
    [setSplit],
  );

  /* ---------------------------------------------------------- issuing -- */

  const dueDate = TERM_DAYS[docType] !== undefined ? addDays(today(), TERM_DAYS[docType]!) : null;

  // Credit is a promise to pay, so it settles nothing even on a cash sale.
  const amountPaidCents = takesPayment && payMethod !== "credit" ? subtotalCents : 0;

  async function complete() {
    if (lines.length === 0 || busy) return;
    setBusy(true);
    setError(null);

    const result: IssueSaleResult = await issueSale({
      docType,
      customerId: customerId || null,
      dueDate,
      paymentMethod: takesPayment ? payMethod : null,
      amountPaidCents,
      paymentReference: reference || null,
      notes: null,
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.name,
        quantity: l.qty,
        unitPriceCents: l.unitPriceCents,
        discountCents: 0,
      })),
    });

    setBusy(false);
    if (result.error || !result.saleId || !result.docNumber) {
      setError(result.error ?? "We couldn't complete that sale. Try again.");
      return;
    }
    setIssued({ saleId: result.saleId, docNumber: result.docNumber });
  }

  const model: SaleDocumentModel | null = issued
    ? {
        docType,
        docNumber: issued.docNumber,
        saleDate: today(),
        dueDate,
        customer: customer
          ? {
              name: customer.name,
              phone: customer.phone,
              location: customer.location,
              email: customer.email,
            }
          : null,
        lines: lines.map((l, i) => ({
          id: `l${i}`,
          description: l.name,
          quantity: l.qty,
          unitPriceCents: l.unitPriceCents,
          lineTotalCents: Math.round(l.qty * l.unitPriceCents),
        })),
        subtotalCents,
        discountCents: 0,
        taxCents: 0,
        totalCents: subtotalCents,
        amountPaidCents,
        balanceCents: subtotalCents - amountPaidCents,
        notes: null,
      }
    : null;

  return (
    <div
      ref={shellRef}
      className="-mx-4 -mt-5 flex flex-col sm:-mx-6 lg:flex-row lg:items-stretch"
    >
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {/* ----------------------------------------------------------- cart -- */}
      <aside
        ref={cartRef}
        style={{ flexBasis: `${pct}%` }}
        className={cn(
          "flex w-full shrink-0 grow-0 flex-col border-line bg-surface",
          // Below lg the cart follows the catalogue; from lg it leads, pinned
          // to the viewport on the left.
          "order-last lg:order-none",
          "lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-r",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <ShoppingCart className="h-4 w-4 shrink-0 text-brand" />
            <span className="truncate font-display text-sm font-extrabold text-ink">
              {lines.length === 0
                ? "Cart"
                : `${lines.length} ${lines.length === 1 ? "item" : "items"}`}
            </span>
            {units > 0 && (
              <span className="shrink-0 text-xs text-ink-faint tnum">{units} units</span>
            )}
          </div>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={() => setLines([])}
              className="shrink-0 rounded px-1.5 py-1 text-xs font-semibold text-ink-faint hover:text-critical"
            >
              Clear
            </button>
          )}
        </div>

        <div className="border-b border-line px-3 py-2.5">
          <label className="flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-ink-soft focus-within:border-brand">
            <User className="h-4 w-4 shrink-0" />
            <span className="sr-only">Customer</span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink focus:outline-none"
            >
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* The list takes every pixel between the header and the footer and
            scrolls on its own — so a twenty-line sale is still one glance and
            the totals never slide off the bottom of the screen. */}
        <div className="scroll-slim max-h-[22rem] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          {lines.length === 0 ? (
            <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2.5 px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunk">
                <ShoppingCart className="h-5 w-5 text-ink-faint" />
              </span>
              <p className="text-sm text-ink-soft">
                Tap a product to start.
                <br />
                Tap it again to add another.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l, i) => (
                <li
                  key={`${l.productId ?? "x"}-${i}`}
                  className={cn(
                    "flex gap-3 px-3 py-3 transition-colors duration-500",
                    flash === l.productId && "bg-brand-soft",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{l.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => bump(i, -1)}
                        aria-label={`One fewer ${l.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft hover:border-brand hover:text-brand"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={l.qty}
                        onChange={(e) => setQty(i, Math.max(0, Number(e.target.value)))}
                        aria-label={`Quantity of ${l.name}`}
                        className="h-8 w-14 rounded-md border border-line bg-canvas text-center text-sm font-semibold text-ink tnum focus:border-brand focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => bump(i, 1)}
                        aria-label={`One more ${l.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-soft hover:border-brand hover:text-brand"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-xs text-ink-faint">{l.unit} @</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={l.unitPriceCents / 100}
                        onChange={(e) => setPrice(i, Number(e.target.value))}
                        aria-label={`Unit price of ${l.name}`}
                        className="h-8 w-20 rounded-md border border-line bg-canvas px-1.5 text-right text-sm text-ink tnum focus:border-brand focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <span className="text-sm font-bold text-ink tnum">
                      {formatMoney(Math.round(l.qty * l.unitPriceCents), { currency })}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={`Remove ${l.name}`}
                      className="rounded p-1 text-ink-faint hover:text-critical"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Everything from here down is pinned: the total and the way out of
            the sale are never something you have to scroll to find. */}
        <div className="shrink-0 border-t border-line">
          <div className="flex items-baseline justify-between bg-brand-tint px-3 py-2.5">
            <span className="font-display text-base font-extrabold text-ink">Total</span>
            <span className="font-display text-xl font-extrabold text-brand tnum">
              {formatMoney(subtotalCents, { currency })}
            </span>
          </div>

          <div className="flex flex-col gap-3 p-3">
            <div>
              <span className="mb-1.5 block text-[0.65rem] font-semibold tracking-[0.11em] text-ink-faint uppercase">
                Issue as
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {DOC_OPTIONS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setDocType(d.key)}
                    aria-pressed={docType === d.key}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-left transition-colors",
                      docType === d.key
                        ? "border-brand bg-brand-soft"
                        : "border-line bg-surface hover:border-brand",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-sm font-bold",
                        docType === d.key ? "text-brand-dark" : "text-ink",
                      )}
                    >
                      {d.label}
                    </span>
                    <span className="block text-[0.68rem] text-ink-faint">{d.note}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* A quotation cannot be paid, so this is absent rather than
                disabled. An invoice is paid later, by definition. */}
            {takesPayment && (
              <div>
                <span className="mb-1.5 block text-[0.65rem] font-semibold tracking-[0.11em] text-ink-faint uppercase">
                  Payment
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PAY_OPTIONS.map((pm) => (
                    <button
                      key={pm.key}
                      type="button"
                      onClick={() => setPayMethod(pm.key)}
                      aria-pressed={payMethod === pm.key}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                        payMethod === pm.key
                          ? "border-brand bg-brand text-white"
                          : "border-line bg-surface text-ink-soft hover:border-brand hover:text-brand",
                      )}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
                {(payMethod === "mpesa" || payMethod === "bank") && (
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder={
                      payMethod === "mpesa" ? "M-Pesa code" : "Slip or transfer reference"
                    }
                    aria-label="Payment reference"
                    className="mt-2 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
                  />
                )}
                {PAY_OPTIONS.find((pm) => pm.key === payMethod)?.hint && (
                  <p className="mt-1.5 text-[0.7rem] leading-relaxed text-ink-faint">
                    {PAY_OPTIONS.find((pm) => pm.key === payMethod)!.hint}
                  </p>
                )}
              </div>
            )}

            {dueDate && (
              <p className="text-[0.7rem] text-ink-faint">
                {docType === "quotation" ? "Valid until" : "Payment due"}{" "}
                <span className="font-semibold text-ink-soft">{dueDate}</span>
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical"
              >
                {error}
              </p>
            )}

            <Button onClick={complete} disabled={lines.length === 0 || busy} className="w-full">
              {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {busy ? "Saving…" : option.cta}
            </Button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------- divider -- */}
      <div
        onPointerDown={drag}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setSplit({ pct: Math.max(SPLIT_MIN, pct - 2) });
          if (e.key === "ArrowRight") setSplit({ pct: Math.min(SPLIT_MAX, pct + 2) });
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the cart"
        aria-valuenow={pct}
        aria-valuemin={SPLIT_MIN}
        aria-valuemax={SPLIT_MAX}
        tabIndex={0}
        className="group hidden w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-line/40 transition-colors hover:bg-brand/40 focus-visible:bg-brand focus-visible:outline-none lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)]"
      >
        <span className="h-8 w-0.5 rounded-full bg-line-strong transition-colors group-hover:bg-brand" />
      </div>

      {/* ----------------------------------------------------- catalogue -- */}
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Counter</h1>
          <label className="relative flex min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <span className="sr-only">Search products</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Type a few letters, press Enter, keep going. At a counter the
                // keyboard is faster than the eye once you know the catalogue.
                if (e.key === "Enter" && visible.length > 0) {
                  e.preventDefault();
                  addProduct(visible[0]);
                  setQuery("");
                }
              }}
              placeholder="Search, then press Enter…"
              className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        {lines.length > 0 && !issued && (
          <div className="sticky top-16 z-20 -mx-4 mt-3 border-y border-line bg-brand-soft/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:hidden">
            <button
              type="button"
              onClick={() => cartRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="text-sm font-semibold text-brand-dark">
                {lines.length} {lines.length === 1 ? "item" : "items"}
                <span className="ml-2 font-normal text-ink-soft tnum">{units} units</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-display text-base font-extrabold text-brand tnum">
                  {formatMoney(subtotalCents, { currency })}
                </span>
                <ChevronDown className="h-4 w-4 text-brand" />
              </span>
            </button>
          </div>
        )}

        {categories.length > 2 && (
          <div className="scroll-slim mt-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                  category === c
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-soft hover:border-brand hover:text-brand",
                )}
              >
                {c === "all" ? "All" : c.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-soft">
            {products.length === 0
              ? "This farm has no products yet."
              : "Nothing matches that search."}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {visible.map((p) => (
              <ProductTile
                key={p.id}
                product={p}
                currency={currency}
                count={qtyOf.get(p.id) ?? 0}
                onAdd={() => addProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- preview -- */}
      {issued && model && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-darker/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="counter-preview-title"
        >
          <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface shadow-raised">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 print:hidden">
              <div>
                <p
                  id="counter-preview-title"
                  className="font-display text-base font-extrabold text-ink"
                >
                  {DOC_TITLE[docType].charAt(0) + DOC_TITLE[docType].slice(1).toLowerCase()} issued
                </p>
                <p className="text-xs text-ink-soft tnum">{issued.docNumber}</p>
              </div>
              <button
                type="button"
                onClick={startOver}
                aria-label="Close and start a new sale"
                className="rounded-md p-1.5 text-ink-faint hover:bg-surface-sunk hover:text-ink"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* print-sheet is what the print stylesheet keeps; everything else
                on the page is hidden while printing. */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunk p-3 sm:p-5">
              <div className="print-sheet rounded-lg border border-line bg-surface p-4 sm:p-6">
                <SaleDocument
                  model={model}
                  business={business}
                  branding={branding}
                  currency={currency}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line px-4 py-3 print:hidden">
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Link
                href={`/app/sales/${issued.saleId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand"
              >
                Open document
              </Link>
              <div className="ml-auto">
                <Button
                  size="sm"
                  onClick={() => {
                    startOver();
                    router.refresh();
                    searchRef.current?.focus();
                  }}
                >
                  Next sale
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
