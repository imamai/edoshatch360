"use client";

/**
 * IndexedDB queue for records made without a connection.
 *
 * Native IndexedDB rather than a wrapper library: the schema is one object
 * store, and a farmer on a low-end Android over a slow connection should not
 * download a dependency to get it.
 */

const DB_NAME = "edoshatch360-offline";
const DB_VERSION = 1;
const STORE = "pending_daily_records";

export interface QueuedRecord {
  localId: string;
  tenantId: string;
  flockId: string;
  flockCode: string;
  recordDate: string; // YYYY-MM-DD
  payload: {
    mortality: number;
    culls: number;
    birds_sold: number;
    eggs_collected: number | null;
    eggs_broken: number | null;
    eggs_rejected: number | null;
    feed_consumed_kg: number | null;
    water_consumed_liters: number | null;
    avg_weight_grams: number | null;
    notes: string | null;
  };
  status: "pending" | "syncing" | "failed";
  error?: string;
  attempts: number;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueRecord(record: QueuedRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedRecords(): Promise<QueuedRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as QueuedRecord[]);
    request.onerror = () => reject(request.error);
  });
}

export async function removeQueuedRecord(localId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(localId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** IndexedDB is unavailable in some private-browsing modes — fail soft. */
export function offlineSupported(): boolean {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
}
