import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import type { FarmAlert } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

const TONE = {
  critical: {
    icon: AlertTriangle,
    wrap: "border-critical/25 bg-critical-soft",
    chip: "bg-critical text-white",
    title: "text-critical",
  },
  attention: {
    icon: AlertTriangle,
    wrap: "border-attention/25 bg-attention-soft",
    chip: "bg-attention text-white",
    title: "text-attention",
  },
  info: {
    icon: Info,
    wrap: "border-info/25 bg-info-soft",
    chip: "bg-info text-white",
    title: "text-info",
  },
} as const;

export function AlertList({ alerts }: { alerts: FarmAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-good/25 bg-good-soft p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-good" />
        <div>
          <p className="text-sm font-semibold text-good">Nothing needs your attention</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            No high mortality, low stock or overdue vaccinations right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {alerts.map((alert) => {
        const tone = TONE[alert.tone];
        const Icon = tone.icon;
        return (
          <li key={alert.id}>
            <Link
              href={alert.href}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-3.5 transition-shadow hover:shadow-card",
                tone.wrap,
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  tone.chip,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold", tone.title)}>
                  {alert.title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                  {alert.body}
                </span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
