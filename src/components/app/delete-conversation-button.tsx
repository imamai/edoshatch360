"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removeConversation } from "@/app/app/assistant/actions";
import { cn } from "@/lib/utils";

/**
 * Throw a saved conversation away.
 *
 * On its own rather than inside the assistant page, because the sidebar now
 * lists these conversations on every screen — importing the chat there to
 * get one button would ship the whole assistant to a page that never opens it.
 */
export function DeleteConversationButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      aria-label="Delete this conversation"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this conversation?")) return;
        start(async () => {
          await removeConversation(id);
          // Looking at the one being deleted: go back to a fresh chat rather
          // than a page about something that no longer exists. Anywhere
          // else, just drop it from the list without moving the person.
          if (active) router.replace("/app/assistant");
          else router.refresh();
        });
      }}
      className={cn("rounded p-1.5 text-ink-faint transition-colors hover:text-critical disabled:opacity-50")}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
