import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge, type Tone } from "@/components/ui/badge";
import { BIRD_TYPE_LABEL, FLOCK_STATUS_LABEL, laysEggs } from "@/lib/data/flocks";
import { CYCLE_DAYS } from "@/lib/catalogues";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import type { Flock, FlockMetrics } from "@/lib/database.types";

/**
 * One flock, as a card you can read at arm's length.
 *
 * Deliberately without a picture or a glyph at the top: the code, the breed
 * and the numbers are what identify a batch, and an image of birds that are
 * not these birds was decoration rather than information. The default photo
 * set is still in public/images/flocks/ if it is ever wanted elsewhere.
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
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-all hover:border-brand/40 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-ink">{flock.code}</h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            {BIRD_TYPE_LABEL[flock.bird_type]}
            {flock.breed ? ` · ${flock.breed}` : ""} · day {age}
          </p>
        </div>
        <span className="shrink-0">
          <Badge tone={STATUS_TONE[flock.status]} dot>
            {FLOCK_STATUS_LABEL[flock.status]}
          </Badge>
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
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
    </Link>
  );
}
