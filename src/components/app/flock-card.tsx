import Link from "next/link";
import { ArrowRight, Bird } from "lucide-react";

import { Badge, type Tone } from "@/components/ui/badge";
import { BIRD_TYPE_LABEL, FLOCK_STATUS_LABEL, laysEggs } from "@/lib/data/flocks";
import { CYCLE_DAYS } from "@/lib/catalogues";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { BirdType, Flock, FlockMetrics } from "@/lib/database.types";

/**
 * One flock, as a card you can read at arm's length.
 *
 * A photograph of the birds does more work here than a glyph did: a farmer
 * with four batches running recognises "the broilers" and "the young ones" by
 * sight long before reading a code. The picture is a default per bird type,
 * not a photograph of these particular birds — which is why the code, breed
 * and age sit over it rather than the picture standing alone.
 */

const STATUS_TONE: Record<Flock["status"], Tone> = {
  planned: "neutral",
  brooding: "info",
  growing: "brand",
  laying: "good",
  finishing: "attention",
  harvested: "neutral",
  closed: "neutral",
};

/** See public/images/flocks/ and the credits in images/marketing/CREDITS.md. */
const BIRD_PHOTO: Partial<Record<BirdType, string>> = {
  layer: "/images/flocks/layer.jpg",
  broiler: "/images/flocks/broiler.jpg",
  kienyeji: "/images/flocks/kienyeji.jpg",
  improved_kienyeji: "/images/flocks/kienyeji.jpg",
  breeder: "/images/flocks/breeder.jpg",
  chick: "/images/flocks/chick.jpg",
  pullet: "/images/flocks/pullet.jpg",
  turkey: "/images/flocks/turkey.jpg",
};

/**
 * A flock still under the brooder gets the brooder picture whatever it will
 * grow into. A four-day-old layer batch is chicks, and showing a full-grown
 * hen beside "day 4" would be a small lie on the first screen a farmer sees.
 */
const BROODING_PHOTO = "/images/flocks/brooding.jpg";
const BROODING_DAYS = 21;

/** Hen-day production a healthy flock in lay should be reaching. */
const GOOD_LAY_PCT = 75;

export function FlockCard({
  flock,
  metrics,
  age,
}: {
  flock: Flock;
  metrics: Pick<FlockMetrics, "mortality_pct" | "lay_pct"> | null;
  age: number;
}) {
  const brooding = flock.status === "brooding" || age < BROODING_DAYS;
  const photo = brooding
    ? BROODING_PHOTO
    : (BIRD_PHOTO[flock.bird_type] ?? null);

  const lossPct = metrics?.mortality_pct ?? 0;
  const layPct = metrics?.lay_pct ?? null;
  const cycle = CYCLE_DAYS[flock.bird_type];

  const survivalPct =
    flock.placement_count > 0
      ? (flock.current_count / flock.placement_count) * 100
      : 100;

  // Two different questions, depending on what the birds are for. A meat bird
  // is on a clock; a layer is not, so its bar shows how well it is laying.
  //
  // laysEggs, not a null check on lay_pct: the database returns 0 rather than
  // null for any flock with live birds, so a broiler would otherwise be shown
  // a lay rate of 0% — true arithmetic, and a nonsense thing to tell anyone
  // about a meat bird.
  const bar =
    laysEggs(flock) && layPct !== null
      ? {
          label: "Lay rate",
          detail: `${formatPercent(layPct)} of the flock, daily`,
          pct: Math.min(100, layPct),
          tone: layPct >= GOOD_LAY_PCT ? "bg-good" : "bg-attention",
        }
      : cycle
        ? {
            label: "Cycle",
            detail: `Day ${age} of ${cycle}`,
            pct: Math.min(100, (age / cycle) * 100),
            tone: age > cycle ? "bg-attention" : "bg-brand",
          }
        : {
            label: "Surviving",
            detail: `${formatNumber(flock.current_count)} of ${formatNumber(flock.placement_count)} placed`,
            pct: Math.min(100, survivalPct),
            tone: survivalPct >= 95 ? "bg-good" : "bg-attention",
          };

  return (
    <Link
      href={`/app/flocks/${flock.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-all hover:border-brand/40 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {/* ------------------------------------------------------- picture -- */}
      {/* The ratio is an inline style, not an `aspect-[12/5]` utility, and
          deliberately so: everything in this band is absolutely positioned, so
          the band's own height is the only thing giving it size. If that came
          from a class and the class were missing for any reason — a stale
          stylesheet in an open tab, a purge that did not see this file — the
          band would collapse to zero and take the photograph, the code and the
          status badge down with it, silently, while the rest of the card
          carried on looking fine. An inline style ships with the markup and
          cannot go missing. */}
      <div
        style={{ aspectRatio: "12 / 5" }}
        className="relative w-full overflow-hidden bg-surface-sunk"
      >
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element --
             a fixed, shipped asset rather than a signed URL; next/image would
             add a loader round-trip for a file that is already sized for this
             exact slot. */
          <img
            src={photo}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-brand-soft">
            <Bird className="h-8 w-8 text-brand" aria-hidden="true" />
          </span>
        )}

        {/* Without the scrim the code is white type over an unknown photo —
            the pale end of a brooder picture and white text are one thing. */}
        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />

        <span className="absolute top-2 right-2">
          <Badge tone={STATUS_TONE[flock.status]} dot>
            {FLOCK_STATUS_LABEL[flock.status]}
          </Badge>
        </span>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h2 className="font-display text-base font-extrabold text-white drop-shadow-sm">
            {flock.code}
          </h2>
          <p className="text-xs text-white/85 drop-shadow-sm">
            {BIRD_TYPE_LABEL[flock.bird_type]}
            {flock.breed ? ` · ${flock.breed}` : ""} · day {age}
          </p>
        </div>
      </div>

      {/* --------------------------------------------------------- facts -- */}
      <div className="flex flex-1 flex-col p-4">
        <dl className="grid grid-cols-3 gap-2">
          <div>
            <dt className="text-[0.6875rem] text-ink-faint">Birds</dt>
            <dd className="text-sm font-semibold text-ink tnum">
              {formatNumber(flock.current_count)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-ink-faint">Placed</dt>
            <dd className="text-sm font-semibold text-ink tnum">
              {formatNumber(flock.placement_count)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] text-ink-faint">Losses</dt>
            <dd
              className={cn(
                "text-sm font-semibold tnum",
                lossPct > 5 ? "text-critical" : "text-ink",
              )}
            >
              {formatPercent(lossPct)}
            </dd>
          </div>
        </dl>

        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-faint uppercase">
              {bar.label}
            </span>
            <span className="text-[0.6875rem] text-ink-soft tnum">{bar.detail}</span>
          </div>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk"
            role="progressbar"
            aria-valuenow={Math.round(bar.pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${bar.label}: ${bar.detail}`}
          >
            <span
              className={cn("block h-full rounded-full transition-all duration-500", bar.tone)}
              style={{ width: `${Math.max(2, bar.pct)}%` }}
            />
          </div>
        </div>

        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">
          Open
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
