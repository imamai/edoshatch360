"use client";

import { Printer } from "lucide-react";

/**
 * Print, which on every current browser is also "Save as PDF".
 *
 * There is no PDF library here on purpose. The browser's own print pipeline
 * already renders the page to PDF, honours the print stylesheet, repeats table
 * headings across pages and lets the farmer choose paper size — and it works
 * offline, which a server-rendered PDF would not.
 */
export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong px-4 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
