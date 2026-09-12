"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once the app shell has mounted.
 *
 * Only in production: a worker caching build assets during development makes
 * every code change look like it did not take effect.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A blocked or unsupported worker costs the offline page, nothing
        // more — the IndexedDB record queue works without it.
      });
    };

    // Wait for load so registration never competes with the first paint on a
    // slow device.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
