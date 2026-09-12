"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

/**
 * The hero's motion layer, for phones only.
 *
 * The footage is a 480x864 clip shot on a phone in one of the customer's
 * houses. At phone width that is roughly a 1.6x upscale and reads well; on a
 * desktop hero it would be stretched past 3x and turns to mush, which is why
 * this never loads above the `md` breakpoint — wide screens keep the stills.
 *
 * It sits ON TOP of the still carousel rather than replacing it, so the
 * photograph is what shows until the video is genuinely playing, and what
 * stays if it never does: blocked autoplay, a stalled download, a codec the
 * browser will not take. There is no failure case that leaves an empty hero.
 */

const SRC = "/video/farm-hero.mp4";
const POSTER = "/video/farm-hero-poster.jpg";

/** Subscribes to a media query and reports whether it currently matches. */
function subscribeQuery(query: string) {
  return (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  };
}

/**
 * Whether it is reasonable to spend ~930KB of someone's data on decoration.
 *
 * Three things have to hold: a small screen (where the clip is the right
 * shape and resolution), no reduced-motion preference, and a connection that
 * has not told us to go easy. The last one matters for this product in
 * particular — it sells itself on working over poor rural connections, so
 * pushing an autoplaying video down a 2G link would contradict the pitch.
 */
function useShouldPlay(): boolean {
  const small = useSyncExternalStore(
    subscribeQuery("(max-width: 767px)"),
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false, // server: assume desktop, so nothing is ever sent in the HTML
  );
  const stillness = useSyncExternalStore(
    subscribeQuery("(prefers-reduced-motion: reduce)"),
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  if (!small || stillness) return false;

  // Network Information API — Chrome and most Android browsers. Absent on
  // iOS, where the check simply does not apply and the video loads.
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /^(slow-)?2g$/.test(connection.effectiveType)) {
    return false;
  }
  return true;
}

export function HeroVideo() {
  const shouldPlay = useShouldPlay();
  const [playing, setPlaying] = useState(false);

  // Fading in on `playing` rather than on mount means the still underneath is
  // never swapped for a black box while the first frames decode.
  const onPlaying = useCallback(() => setPlaying(true), []);

  if (!shouldPlay) return null;

  return (
    <video
      src={SRC}
      poster={POSTER}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={onPlaying}
      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
        playing ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
