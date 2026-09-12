"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check, ChevronDown, Minus, Pause, Play, Plus, Printer, Search, ShoppingCart,
  Tag, Trash2, User, UserPlus, X,
} from "lucide-react";

import { issueSale, quickAddCustomer, type IssueSaleResult } from "@/app/app/sales/actions";
import {
  SaleDocument, DOC_TITLE,
  type SaleDocumentBranding, type SaleDocumentBusiness, type SaleDocumentModel,
} from "@/components/app/sale-document";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useStoredJson } from "@/lib/hooks/use-browser-state";
import { ProductTile } from "./product-tile";
import type { Customer, DocType, PayMethod, Product } from "@/lib/database.types";
import { cn, formatDate, formatMoney, today } from "@/lib/utils";

/**
 * The Counter — the till.
 *
 * The cart owns the right third and never moves: it is pinned to the viewport
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
  /** Taken off this line before the sale total, as a whole-line amount. */
  discountCents: number;
}

/** A sale set aside so the till is free for the next customer. */
interface HeldSale {
  id: string;
  label: string;
  lines: Line[];
  customerId: string;
  docType: DocType;
  discountCents: number;
}

/** The VAT position of this farm, as configured on Settings → Tax. */
export interface CounterTax {
  vatRegistered: boolean;
  vatRate: number;
  pricesIncludeVat: boolean;
  label: string;
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

/** Held sales live in this browser only — they are not documents yet. */
const HELD_KEY = "hatch360:counter-held";
const NO_HELD: HeldSale[] = [];

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Built in UTC on purpose: these are calendar dates, never instants, and a
  // local-time Date would shift the day for anyone east or west of the server.
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function lineTotal(l: Line): number {
  return Math.max(0, Math.round(l.qty * l.unitPriceCents) - l.discountCents);
}

export function Counter({
  products,
  customers: initialCustomers,
  currency,
  business,
  branding,
  tax,
  invoiceFooter,
}: {
  products: Product[];
  customers: Customer[];
  currency: string;
  business: SaleDocumentBusiness;
  branding: SaleDocumentBranding;
  tax: CounterTax;
  invoiceFooter: string | null;
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
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerId, setCustomerId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ saleId: string; docNumber: string } | null>(null);
  /** Briefly marks the line a tap just changed, so the eye can follow it. */
  const [flash, setFlash] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  /** Which line has its discount field open. */
  const [discounting, setDiscounting] = useState<number | null>(null);
  /** A discount on the whole sale, in cents. */
  const [saleDiscountCents, setSaleDiscountCents] = useState(0);
  const [discountOpen, setDiscountOpen] = useState(false);

  /** The new-customer form, open at the till. */
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [held, setHeld] = useStoredJson(HELD_KEY, NO_HELD);
  const [heldOpen, setHeldOpen] = useState(false);

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

  /* -------------------------------------------------------------- money -- */

  const subtotalCents = lines.reduce((a, l) => a + lineTotal(l), 0);
  // A discount can never exceed what is being bought.
  const discountCents = Math.min(saleDiscountCents, subtotalCents);
  const netCents = subtotalCents - discountCents;

  // Exclusive pricing adds VAT on top; inclusive pricing already contains it,
  // so the total is unchanged and the VAT is disclosed instead.
  const vatCents =
    tax.vatRegistered && tax.vatRate > 0 && netCents > 0
      ? tax.pricesIncludeVat
        ? Math.round((netCents * tax.vatRate) / (100 + tax.vatRate))
        : Math.round((netCents * tax.vatRate) / 100)
      : 0;
  const addedVatCents = tax.pricesIncludeVat ? 0 : vatCents;
  const includedVatCents = tax.pricesIncludeVat ? vatCents : 0;
  const totalCents = netCents + addedVatCents;

  const units = lines.reduce((a, l) => a + l.qty, 0);
  const option = DOC_OPTIONS.find((d) => d.key === docType)!;
  const takesPayment = docType === "receipt";
  const customer = customers.find((c) => c.id === customerId) ?? null;

  /* --------------------------------------------------------------- cart -- */

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
          discountCents: 0,
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

  function setLineDiscount(index: number, shillings: number) {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              // Never more than the line is worth: a negative line total would
              // be a refund hiding inside a sale.
              discountCents: Math.min(
                Math.round(l.qty * l.unitPriceCents),
                Math.max(0, Math.round(shillings * 100)),
              ),
            }
          : l,
      ),
    );
  }

  function remove(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setDiscounting(null);
  }

  function clearCart() {
    setLines([]);
    setSaleDiscountCents(0);
    setDiscountOpen(false);
    setDiscounting(null);
  }

  function startOver() {
    clearCart();
    setCustomerId("");
    setReference("");
    setDocType("receipt");
    setPayMethod("cash");
    setIssued(null);
    setError(null);
    setAddingCustomer(false);
  }

  /* --------------------------------------------------------------- held -- */

  function holdSale() {
    if (lines.length === 0) return;
    const label = customer?.name ?? `${lines[0].name}${lines.length > 1 ? " +" : ""}`;
    setHeld([
      {
        id: crypto.randomUUID(),
        label,
        lines,
        customerId,
        docType,
        discountCents: saleDiscountCents,
      },
      ...held,
    ]);
    clearCart();
    setCustomerId("");
    setAnnounce(`Sale held for ${label}`);
    searchRef.current?.focus();
  }

  function resume(sale: HeldSale) {
    // Whatever is on the till now is not lost — it swaps places with the sale
    // being resumed, so neither customer's basket is thrown away.
    const current: HeldSale[] =
      lines.length > 0
        ? [
            {
              id: crypto.randomUUID(),
              label: customer?.name ?? lines[0].name,
              lines,
              customerId,
              docType,
              discountCents: saleDiscountCents,
            },
          ]
        : [];

    setHeld([...current, ...held.filter((h) => h.id !== sale.id)]);
    setLines(sale.lines);
    setCustomerId(sale.customerId);
    setDocType(sale.docType);
    setSaleDiscountCents(sale.discountCents);
    setHeldOpen(false);
    setAnnounce(`Resumed ${sale.label}`);
  }

  function discardHeld(id: string) {
    setHeld(held.filter((h) => h.id !== id));
  }

  /* ----------------------------------------------------------- customer -- */

  async function saveCustomer() {
    const name = newName.trim();
    if (!name || savingCustomer) return;
    setSavingCustomer(true);
    const result = await quickAddCustomer({ name, phone: newPhone.trim() || null });
    setSavingCustomer(false);

    if (result.error || !result.customer) {
      setError(result.error ?? "We couldn't save that customer. Try again.");
      return;
    }
    const saved = result.customer;
    setCustomers((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    setCustomerId(saved.id);
    setAddingCustomer(false);
    setNewName("");
    setNewPhone("");
    setAnnounce(`${saved.name} added`);
  }

  /* ------------------------------------------------------------ divider -- */

  const drag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const shell = shellRef.current;
      if (!shell) return;
      event.preventDefault();
      const box = shell.getBoundingClientRect();

      const move = (e: PointerEvent) => {
        // Measured from the right edge inward: the cart is the right-hand
        // panel, so dragging left makes it wider.
        const next = ((box.right - e.clientX) / box.width) * 100;
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

  /* -------------------------------------------------------------- issue -- */

  const dueDate = TERM_DAYS[docType] !== undefined ? addDays(today(), TERM_DAYS[docType]!) : null;

  // Credit is a promise to pay, so it settles nothing even on a cash sale.
  const amountPaidCents = takesPayment && payMethod !== "credit" ? totalCents : 0;

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
      discountCents,
      taxCents: addedVatCents,
      lines: lines.map((l) => ({
        productId: l.productId,
        description: l.name,
        quantity: l.qty,
        unitPriceCents: l.unitPriceCents,
        discountCents: l.discountCents,
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
          lineTotalCents: lineTotal(l),
        })),
        subtotalCents,
        discountCents,
        taxCents: addedVatCents,
        taxIncludedCents: includedVatCents,
        taxLabel: tax.label,
        totalCents,
        amountPaidCents,
        balanceCents: totalCents - amountPaidCents,
        notes: null,
      }
    : null;

  /* ------------------------------------------------------------- render -- */

  const money = (cents: number) => formatMoney(cents, { currency });

  return (
    <div
      ref={shellRef}
      className="-mx-4 -mt-5 flex flex-col sm:-mx-6 lg:flex-row lg:items-stretch"
    >
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>

      {/* ---------------------------------------------------- catalogue -- */}
      <div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              Counter
            </h1>
            <p className="text-xs text-ink-faint">{formatDate(today(), "long")}</p>
          </div>
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
                  {money(totalCents)}
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
          products.length === 0 ? (
            // A till with no tiles is a dead end unless it says where the
            // catalogue is kept.
            <div className="mt-10 text-center">
              <p className="text-sm text-ink-soft">This farm has no products yet.</p>
              <Link
                href="/app/products"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
              >
                <Plus className="h-4 w-4" />
                Add what you sell
              </Link>
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-ink-soft">
              Nothing matches that search.
            </p>
          )
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

      {/* ------------------------------------------------------ divider -- */}
      <div
        onPointerDown={drag}
        onKeyDown={(e) => {
          // Left widens the cart, right narrows it — the cart is on the right,
          // so its edge moves the way the key points.
          if (e.key === "ArrowLeft") setSplit({ pct: Math.min(SPLIT_MAX, pct + 2) });
          if (e.key === "ArrowRight") setSplit({ pct: Math.max(SPLIT_MIN, pct - 2) });
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

      {/* --------------------------------------------------------- cart -- */}
      <aside
        ref={cartRef}
        style={{ flexBasis: `${pct}%` }}
        className={cn(
          "flex w-full shrink-0 grow-0 flex-col border-line bg-surface",
          // Below lg the cart follows the catalogue; from lg it sits to the
          // right of it, pinned to the viewport.
          "lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-l",
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

          <div className="flex shrink-0 items-center gap-0.5">
            {held.length > 0 && (
              <button
                type="button"
                onClick={() => setHeldOpen((v) => !v)}
                aria-expanded={heldOpen}
                className={cn(
                  "flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold transition-colors",
                  heldOpen ? "bg-brand-soft text-brand" : "text-ink-soft hover:text-brand",
                )}
              >
                <Play className="h-3.5 w-3.5" />
                {held.length}
              </button>
            )}
            {lines.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={holdSale}
                  title="Hold this sale and start another"
                  className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold text-ink-soft hover:text-brand"
                >
                  <Pause className="h-3.5 w-3.5" />
                  Hold
                </button>
                <button
                  type="button"
                  onClick={clearCart}
                  className="rounded px-1.5 py-1 text-xs font-semibold text-ink-faint hover:text-critical"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Held sales — a customer who went back for their money should not
            cost you the basket, or the till. */}
        {heldOpen && held.length > 0 && (
          <div className="border-b border-line bg-surface-sunk px-3 py-2">
            <p className="mb-1.5 text-[0.65rem] font-semibold tracking-[0.11em] text-ink-faint uppercase">
              Held sales
            </p>
            <ul className="flex flex-col gap-1">
              {held.map((h) => (
                <li key={h.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resume(h)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left hover:border-brand"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {h.label}
                      </span>
                      <span className="block text-[0.68rem] text-ink-faint">
                        {h.lines.length} {h.lines.length === 1 ? "item" : "items"}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-brand tnum">
                      {money(h.lines.reduce((a, l) => a + lineTotal(l), 0))}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => discardHeld(h.id)}
                    aria-label={`Discard the held sale for ${h.label}`}
                    className="shrink-0 rounded p-1 text-ink-faint hover:text-critical"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ----------------------------------------------------- customer */}
        <div className="border-b border-line px-3 py-2.5">
          {addingCustomer ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCustomer()}
                placeholder="Customer name"
                aria-label="New customer name"
                className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveCustomer()}
                placeholder="Phone (optional)"
                inputMode="tel"
                aria-label="New customer phone"
                className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={saveCustomer}
                  disabled={!newName.trim() || savingCustomer}
                >
                  {savingCustomer ? <Spinner className="h-3.5 w-3.5" /> : null}
                  Save
                </Button>
                <button
                  type="button"
                  onClick={() => setAddingCustomer(false)}
                  className="text-sm font-semibold text-ink-faint hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-ink-soft focus-within:border-brand">
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
              <button
                type="button"
                onClick={() => setAddingCustomer(true)}
                aria-label="Add a new customer"
                title="Add a new customer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft hover:border-brand hover:text-brand"
              >
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          )}
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
                    "px-3 py-3 transition-colors duration-500",
                    flash === l.productId && "bg-brand-soft",
                  )}
                >
                  <div className="flex gap-3">
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
                      <span className="text-sm font-bold text-ink tnum">{money(lineTotal(l))}</span>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        aria-label={`Remove ${l.name}`}
                        className="rounded p-1 text-ink-faint hover:text-critical"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Item discount, folded away until it is wanted — most lines
                      never carry one, and an always-visible field invites a
                      stray keystroke on a price. */}
                  {discounting === i || l.discountCents > 0 ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      <label className="text-xs text-ink-soft" htmlFor={`disc-${i}`}>
                        Item discount
                      </label>
                      <input
                        id={`disc-${i}`}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={l.discountCents / 100}
                        onChange={(e) => setLineDiscount(i, Number(e.target.value))}
                        className="h-8 w-20 rounded-md border border-line bg-canvas px-1.5 text-right text-sm text-ink tnum focus:border-brand focus:outline-none"
                      />
                      {l.discountCents === 0 && (
                        <button
                          type="button"
                          onClick={() => setDiscounting(null)}
                          className="text-xs text-ink-faint hover:text-ink"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDiscounting(i)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink-faint hover:text-brand"
                    >
                      <Tag className="h-3 w-3" />
                      Item discount
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Everything from here down is pinned: the total and the way out of
            the sale are never something you have to scroll to find. */}
        <div className="shrink-0 border-t border-line">
          <div className="flex flex-col gap-1 px-3 pt-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">Subtotal</span>
              <span className="font-medium text-ink tnum">{money(subtotalCents)}</span>
            </div>

            {discountOpen || discountCents > 0 ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <label className="flex items-center gap-1.5 text-ink-soft" htmlFor="sale-discount">
                  <Tag className="h-3.5 w-3.5" />
                  Discount
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id="sale-discount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={saleDiscountCents / 100}
                    onChange={(e) =>
                      setSaleDiscountCents(Math.max(0, Math.round(Number(e.target.value) * 100)))
                    }
                    className="h-8 w-24 rounded-md border border-line bg-canvas px-1.5 text-right text-sm text-ink tnum focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSaleDiscountCents(0);
                      setDiscountOpen(false);
                    }}
                    aria-label="Remove the discount"
                    className="rounded p-1 text-ink-faint hover:text-critical"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDiscountOpen(true)}
                  className="inline-flex items-center gap-1 self-start text-xs font-semibold text-ink-faint hover:text-brand"
                >
                  <Tag className="h-3 w-3" />
                  Add discount
                </button>
              )
            )}

            {addedVatCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">{tax.label}</span>
                <span className="font-medium text-ink tnum">{money(addedVatCents)}</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex items-baseline justify-between bg-brand-tint px-3 py-2.5">
            <span className="font-display text-base font-extrabold text-ink">Total</span>
            <span className="font-display text-xl font-extrabold text-brand tnum">
              {money(totalCents)}
            </span>
          </div>
          {includedVatCents > 0 && (
            <p className="bg-brand-tint px-3 pb-2 text-right text-[0.68rem] text-ink-faint tnum">
              Includes {tax.label} {money(includedVatCents)}
            </p>
          )}

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

            {/* The amount lives on the button. Whoever is serving reads one
                thing before they take the money, not two. */}
            <Button onClick={complete} disabled={lines.length === 0 || busy} className="w-full">
              {busy ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {busy
                ? "Saving…"
                : lines.length === 0
                  ? option.cta
                  : `${option.cta} · ${money(totalCents)}`}
            </Button>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------ preview -- */}
      {/* Rendered into <body> rather than in place.

          Printing is the reason. The document has to be the only thing on the
          printed page, and the previous approach hid the Counter behind
          `visibility: hidden` — which leaves the hidden content occupying its
          full height, so the receipt was pushed onto page three behind two
          blank ones. As a direct child of body the sheet can be isolated by
          hiding body's other children outright, which takes them out of the
          layout instead of merely making them invisible. */}
      {issued && model && createPortal(
        <div
          className="print-portal fixed inset-0 z-50 flex items-center justify-center bg-brand-darker/50 p-3 sm:p-6"
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
                  footer={invoiceFooter}
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
        </div>,
        document.body,
      )}
    </div>
  );
}
