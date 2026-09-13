"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Print, which on every current platform is also "save as PDF".
 *
 * There is no PDF library here on purpose. The browser's own print pipeline
 * renders the page to PDF, honours the print stylesheet, repeats table
 * headings across pages and lets the farmer pick the paper — and it works
 * offline and over a slow connection, which a generated PDF would not.
 *
 * One definition, used by both the sale documents and the reports, so the
 * two cannot end up printing through different buttons.
 */
export function PrintButton({
  label = "Print or save as PDF",
  size = "sm",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <Button variant="secondary" size={size} onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      {label}
    </Button>
  );
}
