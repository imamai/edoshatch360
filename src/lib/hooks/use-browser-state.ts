"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Browser-only state, read the way React 19 wants it read.
 *
 * Each of these reads a value that exists only on the client (connection
 * status, scroll position, localStorage). Reading them in an effect and
 * calling setState causes a cascading render; reading them in a `useState`
 * initialiser breaks hydration, because the server renders one value and the
 * client's first render produces another.
 *
 * useSyncExternalStore solves both: it takes a separate server snapshot, so
 * the markup matches, and it subscribes rather than setting state.
 */

/* -------------------------------------------------------------- online -- */

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    // Assume online on the server: an "offline" banner flashing on every
    // first paint would be both wrong and alarming.
    () => true,
  );
}

/* -------------------------------------------------------------- scroll -- */

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

export function useScrolledPast(threshold = 8): boolean {
  return useSyncExternalStore(
    subscribeScroll,
    () => window.scrollY > threshold,
    () => false,
  );
}

/* -------------------------------------------------------- localStorage -- */

// localStorage fires `storage` only in OTHER tabs, so same-tab writes are
// broadcast through this set of listeners instead.
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribeStorage(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

// getSnapshot must return a stable reference or React re-renders forever, so
// each key's parsed value is memoised against the raw string it came from.
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

function readSnapshot<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback;
  }

  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value as T;

  let value: T = fallback;
  if (raw !== null) {
    try {
      value = { ...fallback, ...JSON.parse(raw) } as T;
    } catch {
      value = fallback;
    }
  }

  snapshots.set(key, { raw, value });
  return value;
}

/**
 * A JSON value in localStorage, with `fallback` used on the server and
 * whenever storage is unavailable or unreadable.
 *
 * `fallback` MUST be a stable reference (module-level constant or useMemo).
 * It is returned as-is when nothing is stored, so a fresh object literal on
 * every render would change the snapshot identity and re-render forever.
 */
export function useStoredJson<T extends object>(
  key: string,
  fallback: T,
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribeStorage,
    () => readSnapshot(key, fallback),
    () => fallback,
  );

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage blocked (private mode, or the user disabled site data).
        // Keep the in-memory snapshot so the UI still responds.
        snapshots.set(key, { raw: JSON.stringify(next), value: next });
      }
      notify();
    },
    [key],
  );

  return [value, setValue];
}
