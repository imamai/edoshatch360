import Link from "next/link";
import { ShieldQuestion } from "lucide-react";
import type { FarmHealth } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const BANDS = {
  excellent: { label: "Excellent", ring: "var(--color-good)", text: "text-good", chip: "bg-good-soft text-good" },
  good: { label: "Good", ring: "var(--color-brand-mid)", text: "text-brand", chip: "bg-brand-soft text-brand" },
  attention: { label: "Needs attention", ring: "var(--color-attention)", text: "text-attention", chip: "bg-attention-soft text-attention" },
  critical: { label: "Critical", ring: "var(--color-critical)", text: "text-critical", chip: "bg-critical-soft text-critical" },
  unknown: { label: "Not enough data", ring: "var(--color-line-strong)", text: "text-ink-faint", chip: "bg-surface-sunk text-ink-faint" },
} as const;

/**
 * Farm Health Score (spec §11). Every component is shown with the figure
 * behind it and the target it is judged against, so the headline number is
 * auditable rather than magic — and when there is not enough data the score is
 * withheld rather than guessed.
 */
export function HealthDial({
  health,
  farmName,
  href,
}: {
  health: FarmHealth;
  farmName: string;
  href?: string;
}) {
  const band = BANDS[health.band];
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const pct = (health.score ?? 0) / 100;

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center gap-5">
        <div className="relative flex h-[5.5rem] w-[5.5rem] shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-surface-sunk)" strokeWidth="9" />
            {health.score !== null && (
              <circle
                cx="50" cy="50" r={r} fill="none" stroke={band.ring} strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - pct)}
              />
            )}
          </svg>
          {health.score !== null ? (
            <span className="font-display text-2xl font-extrabold text-ink tnum">
              {health.score}
            </span>
          ) : (
            <ShieldQuestion className="h-7 w-7 text-ink-faint" />
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Farm Health Score
          </p>
          <p className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", band.chip)}>
            {band.label}
          </p>
          <p className="mt-1.5 truncate text-sm text-ink-soft">{farmName}</p>
          {health.reason && (
            <p className="mt-0.5 text-xs text-ink-faint">{health.reason}</p>
          )}
        </div>
      </div>

      {health.components.length > 0 && (
        <dl className="mt-5 flex flex-col gap-2.5 border-t border-line pt-4">
          {health.components.map((c) => (
            <div key={c.key} className="flex items-center gap-3">
              <dt className="w-36 shrink-0 truncate text-xs text-ink-soft">{c.label}</dt>
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunk"
                role="img"
                aria-label={`${c.label}: ${c.value}${c.unit}, target ${c.target}${c.unit}`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, c.score))}%`,
                    background:
                      c.score >= 85
                        ? "var(--color-good)"
                        : c.score >= 60
                          ? "var(--color-attention)"
                          : "var(--color-critical)",
                  }}
                />
              </div>
              <dd className="w-28 shrink-0 text-right text-xs text-ink tnum">
                {c.value}
                {c.unit}{" "}
                <span className="text-ink-faint">/ {c.target}{c.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}

      {href && (
        <Link
          href={href}
          className="mt-4 inline-block text-xs font-semibold text-brand hover:underline"
        >
          Open this farm →
        </Link>
      )}
    </div>
  );
}
