"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import { useOnlineStatus } from "@/lib/hooks/use-browser-state";
import { describeWriteError } from "@/lib/data-quality";
import {
  getQueuedRecords, offlineSupported, queueRecord, removeQueuedRecord,
  type QueuedRecord,
} from "@/lib/offline/db";

type SubmitResult = { ok: true; queued: boolean } | { ok: false; message: string };

interface OfflineValue {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  submitRecord: (
    record: Omit<QueuedRecord, "localId" | "status" | "attempts" | "createdAt">,
  ) => Promise<SubmitResult>;
  syncNow: () => Promise<void>;
}

/**
 * Did the database refuse this record, or was it simply unreachable?
 *
 * The difference decides whether a record waits in the queue or comes back to
 * the farmer. HB001 is raised by the validation triggers; the 23xxx family is
 * Postgres rejecting a constraint. Anything else — a timeout, a dropped
 * connection, a 502 — is worth retrying.
 */
function isRejection(error: { code?: string } | null): boolean {
  const code = error?.code ?? "";
  return code === "HB001" || code.startsWith("23") || code === "22P02";
}

const OfflineContext = createContext<OfflineValue | null>(null);

export function useOffline(): OfflineValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside <OfflineProvider>");
  return ctx;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  // Subscribed rather than stored: useOnlineStatus reports "online" on the
  // server so hydration matches, then tracks the real connection.
  const online = useOnlineStatus();
  const [queue, setQueue] = useState<QueuedRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!offlineSupported()) return;
    try {
      setQueue(await getQueuedRecords());
    } catch {
      // A browser that refuses IndexedDB simply has no queue to show.
    }
  }, []);

  /**
   * Push one queued record to Postgres.
   *
   * Resolves to null when it lands, and to the error when it does not — the
   * caller has to tell a refusal from an outage, because only one of the two
   * is worth retrying.
   */
  const push = useCallback(async (record: QueuedRecord): Promise<PostgrestError | null> => {
    const supabase = createClient();
    const { error } = await supabase.from("edoshatch360_daily_records").upsert(
      {
        tenant_id: record.tenantId,
        flock_id: record.flockId,
        record_date: record.recordDate,
        ...record.payload,
      },
      // One record per flock per day: a re-sync or an edit updates the same
      // row rather than creating a duplicate.
      { onConflict: "flock_id,record_date" },
    );
    return error ?? null;
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !offlineSupported()) return;
    syncingRef.current = true;
    setSyncing(true);

    try {
      const items = await getQueuedRecords();
      for (const item of items) {
        const error = await push(item);
        if (!error) {
          await removeQueuedRecord(item.localId);
        } else if (isRejection(error)) {
          // The database will refuse this every time — retrying it forever
          // would keep a permanent "waiting to sync" badge on the phone for a
          // record that can never land. It is marked failed and left for the
          // farmer to correct rather than retried.
          await queueRecord({
            ...item,
            status: "failed",
            attempts: item.attempts + 1,
            message: describeWriteError(error),
          });
        } else {
          await queueRecord({ ...item, status: "pending", attempts: item.attempts + 1 });
        }
      }
    } catch {
      // Leave everything queued; the next online event tries again.
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refresh();
    }
  }, [push, refresh]);

  const submitRecord = useCallback<OfflineValue["submitRecord"]>(
    async (record) => {
      const entry: QueuedRecord = {
        ...record,
        localId: `${record.flockId}:${record.recordDate}`,
        status: "pending",
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      // Try the network first while online — an immediate success is the
      // common case and keeps the queue empty.
      if (navigator.onLine) {
        const error = await push(entry);
        if (!error) {
          await refresh();
          return { ok: true, queued: false };
        }
        // Data the database refuses must never be queued: the farmer would be
        // told it was saved and would find out days later that it was not.
        if (isRejection(error)) {
          return { ok: false, message: describeWriteError(error) };
        }
      }

      if (!offlineSupported()) {
        return {
          ok: false,
          message:
            "We couldn't save that and this browser won't let us hold it on the device. Check your connection and try again.",
        };
      }

      await queueRecord(entry);
      await refresh();
      return { ok: true, queued: true };
    },
    [push, refresh],
  );

  // Read the queue that IndexedDB is holding, and flush it whenever the
  // connection is available. This is the "subscribe to an external system"
  // case: nothing here sets state synchronously — both calls are async and
  // only touch state after awaiting IndexedDB — but the lint rule cannot see
  // through the async boundary, so it is disabled with that reasoning stated.
  useEffect(() => {
    if (online) void syncNow();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else void refresh();
  }, [online, syncNow, refresh]);

  const value = useMemo<OfflineValue>(
    () => ({
      online,
      pending: queue.filter((q) => q.status !== "failed").length,
      failed: queue.filter((q) => q.status === "failed").length,
      syncing,
      submitRecord,
      syncNow,
    }),
    [online, queue, syncing, submitRecord, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
