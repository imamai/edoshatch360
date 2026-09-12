import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "./badge";

const CHIPS: Record<Tone, string> = {
  neutral: "bg-surface-sunk text-ink-soft",
  good: "bg-good-soft text-good",
  attention: "bg-attention-soft text-attention",
  critical: "bg-critical-soft text-critical",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand",
};

/**
 * A KPI tile. `delta` is the change against the comparison period, and
 * `higherIsBetter` decides whether an increase is rendered as good or bad —
 * a rise in mortality and a rise in eggs are not the same news.
 */
export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "brand",
  delta,
  deltaLabel,
  higherIsBetter = true,
  href,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  delta?: number | null;
  deltaLabel?: string;
  higherIsBetter?: boolean;
  href?: string;
  hint?: string;
  className?: string;
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const flat = hasDelta && Math.abs(delta) < 0.05;
  const positive = hasDelta && !flat && (delta > 0) === higherIsBetter;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              CHIPS[tone],
            )}
          >
            {icon}
          </span>
        )}
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tnum",
              flat
                ? "bg-surface-sunk text-ink-faint"
                : positive
                  ? "bg-good-soft text-good"
                  : "bg-critical-soft text-critical",
            )}
          >
            {flat ? (
              <Minus className="h-3 w-3" />
            ) : delta > 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      <p className="mt-3 text-2xl leading-none font-semibold tracking-tight text-ink tnum">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-ink-faint">{unit}</span>}
      </p>
      <p className="mt-1.5 text-xs font-medium text-ink-soft">{label}</p>
      {(hint || deltaLabel) && (
        <p className="mt-0.5 text-[0.6875rem] text-ink-faint">{hint ?? deltaLabel}</p>
      )}
    </>
  );

  const shell = cn(
    "rounded-xl border border-line bg-surface p-4 shadow-card",
    href && "transition-colors hover:border-brand/40 hover:bg-brand-tint",
    className,
  );

  return href ? (
    <Link href={href} className={cn(shell, "block")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
