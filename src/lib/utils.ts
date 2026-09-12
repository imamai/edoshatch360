import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ *
 * Money
 *
 * Every amount in this system is stored as an integer number of cents.
 * Nothing anywhere holds a floating-point shilling value — rounding a
 * farmer's revenue is not a bug anyone should have to find twice.
 * ------------------------------------------------------------------ */

export function formatMoney(
  cents: number | null | undefined,
  opts: { currency?: string; compact?: boolean; decimals?: boolean } = {},
) {
  const { currency = "KES", compact = false, decimals = false } = opts;
  const value = (cents ?? 0) / 100;

  if (compact && Math.abs(value) >= 1_000_000) {
    return `${currency} ${(value / 1_000_000).toFixed(1)}M`;
  }
  if (compact && Math.abs(value) >= 10_000) {
    return `${currency} ${Math.round(value / 1000)}K`;
  }

  return `${currency} ${value.toLocaleString("en-KE", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  })}`;
}

export function formatNumber(
  value: number | null | undefined,
  opts: { decimals?: number; compact?: boolean } = {},
) {
  const { decimals = 0, compact = false } = opts;
  const n = value ?? 0;

  if (compact && Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`;

  return n.toLocaleString("en-KE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(decimals)}%`;
}

/* ------------------------------------------------------------------- *
 * Dates
 *
 * Record dates are plain YYYY-MM-DD strings, never Date objects, so a
 * farmer in Nairobi recording "yesterday" never lands on a different day
 * because the server happens to run in UTC.
 * ------------------------------------------------------------------- */

export function today(): string {
  return new Date().toLocaleDateString("en-CA"); // en-CA renders as YYYY-MM-DD
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatDate(
  iso: string | null | undefined,
  style: "short" | "long" | "day" = "short",
) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";

  if (style === "long") {
    return d.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  }
  if (style === "day") {
    return d.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
  }
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/** "Today", "Yesterday", "3 days ago", then falls back to a real date. */
export function relativeDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = daysBetween(iso.slice(0, 10), today());
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  if (diff === -1) return "Tomorrow";
  if (diff < -1 && diff > -7) return `In ${Math.abs(diff)} days`;
  return formatDate(iso);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
