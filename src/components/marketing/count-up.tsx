"use client";

import { useEffect, useState } from "react";

/**
 * Counts a number up to its final value once, on mount.
 *
 * The finished value is what renders on the server and what a
 * reduced-motion viewer sees immediately — the animation is an enhancement
 * over a correct number, never the thing that produces it. That also means a
 * screen reader announces the real figure rather than a blur of intermediates.
 */
export function CountUp({
  to,
  duration = 1400,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [value, setValue] = useState(to);

  // No "have I already run?" ref here: React invokes effects twice in
  // development, and a guard like that lets the first pass schedule a frame,
  // the cleanup cancel it, and the second pass return early — leaving the
  // counter stuck on zero. Setting up and tearing down cleanly on every run
  // is both correct and idempotent.
  useEffect(() => {
    // State already initialises to the final figure, so a reduced-motion
    // viewer needs nothing done at all — just never start the animation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let cancelled = false;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic: fast at first, settling gently on the real figure.
      setValue(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      // Whatever interrupts the animation, the real figure is what remains.
      setValue(to);
    };
  }, [to, duration]);

  return (
    <span className={className}>
      {prefix}
      {value.toLocaleString("en-KE", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
