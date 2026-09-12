"use client";

import { Bird, Boxes, Egg, Drumstick, Sprout, Wheat } from "lucide-react";

import type { Product, ProductCategory } from "@/lib/database.types";
import { cn, formatMoney } from "@/lib/utils";

/**
 * One tappable product — a photograph first, everything else on top of it.
 *
 * At a counter the picture is what is recognised, not the words: the person
 * serving is looking for "the eggs", not reading a list. So the image fills
 * the tile edge to edge and the name and price sit over a scrim at the foot,
 * rather than the photo being a thumbnail above a caption.
 *
 * Three sources, in order: the product's own photograph, the default for its
 * category, then a tinted glyph. A farm that has uploaded nothing still gets
 * a till that looks finished.
 */

/** Shipped defaults, one per category. See public/images/products/. */
const CATEGORY_PHOTO: Partial<Record<ProductCategory, string>> = {
  eggs: "/images/products/eggs.jpg",
  live_birds: "/images/products/live_birds.jpg",
  processed_birds: "/images/products/processed_birds.jpg",
  spent_layers: "/images/products/spent_layers.jpg",
  chicks: "/images/products/chicks.jpg",
  manure: "/images/products/manure.jpg",
  feed: "/images/products/feed.jpg",
};

const FALLBACK: Record<ProductCategory, { icon: typeof Egg; tint: string; ink: string }> = {
  eggs: { icon: Egg, tint: "bg-gold-soft", ink: "text-gold-dark" },
  live_birds: { icon: Bird, tint: "bg-brand-soft", ink: "text-brand" },
  processed_birds: { icon: Drumstick, tint: "bg-critical-soft", ink: "text-critical" },
  spent_layers: { icon: Bird, tint: "bg-info-soft", ink: "text-info" },
  chicks: { icon: Sprout, tint: "bg-good-soft", ink: "text-good" },
  manure: { icon: Sprout, tint: "bg-surface-sunk", ink: "text-ink-soft" },
  feed: { icon: Wheat, tint: "bg-attention-soft", ink: "text-attention" },
  other: { icon: Boxes, tint: "bg-surface-sunk", ink: "text-ink-soft" },
};

export function ProductTile({
  product,
  currency,
  count,
  onAdd,
}: {
  product: Product;
  currency: string;
  count: number;
  onAdd: () => void;
}) {
  const photo = product.photo_url ?? CATEGORY_PHOTO[product.category] ?? null;
  const fallback = FALLBACK[product.category] ?? FALLBACK.other;
  const Icon = fallback.icon;

  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add ${product.name}, ${formatMoney(product.default_price_cents, { currency })} per ${product.unit}`}
      className={cn(
        "group relative aspect-[4/3] w-full overflow-hidden rounded-xl border text-left",
        "transition-all duration-150 active:scale-[0.98]",
        "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
        count > 0
          ? "border-brand ring-2 ring-brand/25"
          : "border-line hover:border-brand hover:shadow-raised",
      )}
    >
      {photo ? (
        /* eslint-disable-next-line @next/next/no-img-element --
           a product photograph is uploaded to storage and read through a
           signed URL, which next/image would cache past its expiry. The
           shipped defaults go through the same path for one code path only. */
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span
          className={cn("absolute inset-0 flex items-center justify-center", fallback.tint)}
        >
          <Icon className={cn("h-10 w-10", fallback.ink)} aria-hidden="true" />
        </span>
      )}

      {/* The scrim is what makes white type legible over an unknown photograph.
          Without it a pale egg tray and white text are the same thing. */}
      {photo && (
        <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      )}

      <span
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-2.5",
          photo ? "text-white" : "text-ink",
        )}
      >
        <span className="truncate text-sm leading-tight font-semibold drop-shadow-sm">
          {product.name}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-[0.9375rem] font-extrabold tnum drop-shadow-sm",
              photo ? "text-gold" : "text-brand",
            )}
          >
            {formatMoney(product.default_price_cents, { currency })}
          </span>
          <span
            className={cn(
              "text-[0.6875rem]",
              photo ? "text-white/75" : "text-ink-faint",
            )}
          >
            per {product.unit}
          </span>
        </span>
      </span>

      {count > 0 && (
        <span className="absolute top-2 right-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand px-2 text-sm font-bold text-white shadow-pop tnum">
          {count}
        </span>
      )}
    </button>
  );
}
