"use client";

import { AlertCircle, Check, CloudOff, RefreshCw } from "lucide-react";
import { useOffline } from "./offline-provider";
import { cn } from "@/lib/utils";

/**
 * Sync status, always visible while there is something to say (spec §37).
 * Silent when online with an empty queue — a green "synced" badge on every
 * screen forever is noise, not reassurance.
 */
export function SyncBadge({ className }: { className?: string }) {
  const { online, pending, failed, syncing, syncNow } = useOffline();

  if (online && pending === 0 && failed === 0 && !syncing) return null;

  if (failed > 0) {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-critical/25 bg-critical-soft px-2.5 py-1 text-xs font-medium text-critical",
          className,
        )}
      >
        <AlertCircle className="h-3.5 w-3.5" />
        {failed} didn&apos;t sync — retry
      </button>
    );
  }

  if (syncing) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-info/25 bg-info-soft px-2.5 py-1 text-xs font-medium text-info",
          className,
        )}
      >
        <RefreshCw className="spin h-3.5 w-3.5" />
        Syncing
      </span>
    );
  }

  if (!online) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-attention/25 bg-attention-soft px-2.5 py-1 text-xs font-medium text-attention",
          className,
        )}
      >
        <CloudOff className="h-3.5 w-3.5" />
        {pending > 0 ? `Offline · ${pending} waiting` : "Offline"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-attention/25 bg-attention-soft px-2.5 py-1 text-xs font-medium text-attention",
        className,
      )}
    >
      <Check className="h-3.5 w-3.5" />
      {pending} waiting to sync
    </span>
  );
}
