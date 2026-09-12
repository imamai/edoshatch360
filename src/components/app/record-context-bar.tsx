"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Flock } from "@/lib/database.types";
import { addDays, today } from "@/lib/utils";

/**
 * Which flock, which day. Both live in the URL so a half-filled entry
 * survives a refresh and a farmer can bookmark "yesterday's round".
 */
export function RecordContextBar({
  flocks,
  flockId,
  date,
}: {
  flocks: Flock[];
  flockId: string;
  date: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(next: { flock?: string; date?: string }) {
    const q = new URLSearchParams(params.toString());
    if (next.flock) q.set("flock", next.flock);
    if (next.date) q.set("date", next.date);
    router.push(`/app/record?${q.toString()}`);
  }

  const isToday = date === today();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-end sm:gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor="flock-select" className="mb-1.5 block text-xs font-medium text-ink-soft">
          Which flock?
        </label>
        <select
          id="flock-select"
          value={flockId}
          onChange={(e) => go({ flock: e.target.value })}
          className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-[0.9375rem] font-medium text-ink focus:border-brand focus:outline-none"
        >
          {flocks.map((f) => (
            <option key={f.id} value={f.id}>
              {f.code}
              {f.name ? ` · ${f.name}` : ""} ({f.current_count} birds)
            </option>
          ))}
        </select>
      </div>

      <div className="sm:w-64">
        <label htmlFor="record-date" className="mb-1.5 block text-xs font-medium text-ink-soft">
          Which day?
        </label>
        <div className="flex items-stretch gap-1.5">
          <button
            type="button"
            onClick={() => go({ date: addDays(date, -1) })}
            aria-label="Previous day"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-soft hover:border-brand hover:text-brand"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="relative flex-1">
            <CalendarDays className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              id="record-date"
              type="date"
              value={date}
              max={today()}
              onChange={(e) => e.target.value && go({ date: e.target.value })}
              className="h-11 w-full rounded-lg border border-line-strong bg-surface pr-2 pl-8 text-sm font-medium text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => go({ date: addDays(date, 1) })}
            disabled={isToday}
            aria-label="Next day"
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-soft hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
