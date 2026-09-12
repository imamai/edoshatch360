import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Hatch360 mark: an egg silhouette cut by a rising arc — hatch (the egg)
 * and 360 (the closing circle of the farm cycle) in one shape. Drawn rather
 * than imported so it inherits `currentColor` and stays crisp at any size.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("h-7 w-7", className)}
    >
      <path
        d="M16 3c4.8 0 9 5.6 9 12.1C25 21.2 21 26 16 26S7 21.2 7 15.1C7 8.6 11.2 3 16 3Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M16 3c4.8 0 9 5.6 9 12.1C25 21.2 21 26 16 26S7 21.2 7 15.1C7 8.6 11.2 3 16 3Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M10.5 18.2c2.2-3.6 4.6-5.4 7.2-5.4 1.9 0 3.4.6 4.6 1.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="21.6" cy="9.8" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  className,
  href = "/",
  tone = "ink",
}: {
  className?: string;
  href?: string | null;
  tone?: "ink" | "light";
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={tone === "light" ? "text-gold" : "text-brand"} />
      <span
        className={cn(
          "font-display text-[1.0625rem] leading-none font-extrabold tracking-tight",
          tone === "light" ? "text-white" : "text-ink",
        )}
      >
        EDOS<span className={tone === "light" ? "text-gold" : "text-brand"}> Hatch360</span>
      </span>
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="inline-flex" aria-label="EDOS Hatch360 home">
      {inner}
    </Link>
  );
}
