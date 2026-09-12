import { cn } from "@/lib/utils";

export type Tone = "neutral" | "good" | "attention" | "critical" | "info" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-sunk text-ink-soft border-line-strong",
  good: "bg-good-soft text-good border-good/25",
  attention: "bg-attention-soft text-attention border-attention/25",
  critical: "bg-critical-soft text-critical border-critical/25",
  info: "bg-info-soft text-info border-info/25",
  brand: "bg-brand-soft text-brand border-brand/20",
};

/**
 * State is encoded in shape as well as colour — a filled dot plus a word, so
 * it still reads for anyone who cannot separate the hues.
 */
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
