"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, MessageSquarePlus, Plus } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { AssistantGlyph } from "@/components/app/assistant-glyph";
import { DeleteConversationButton } from "@/components/app/delete-conversation-button";
import { activeHref, visibleGroups } from "@/lib/nav";
import { useStoredJson } from "@/lib/hooks/use-browser-state";
import { startNewConversation } from "@/lib/ai/new-conversation";
import type { HistoryGroup } from "@/lib/ai/history";
import type { FarmMode, Role } from "@/lib/database.types";
import type { PlanCode } from "@/lib/plans";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "hatch360:sidebar-collapsed";
const HISTORY_KEY = "hatch360:sidebar-history";

/** How many conversations are shown before "Show all". */
const HISTORY_SHOWN = 10;

// Stable references: useStoredJson returns these as-is when nothing is
// stored, so an inline literal here would change identity on every render.
const NONE_COLLAPSED: Record<string, boolean> = {};
const HISTORY_DEFAULT: { open: boolean; all: boolean } = { open: true, all: false };

export function Sidebar({
  role,
  mode,
  canWrite,
  plan,
  isPlatformAdmin,
  history = [],
}: {
  role: Role;
  mode: FarmMode;
  canWrite: boolean;
  /** Null for an organisation with no subscription — nothing is hidden. */
  plan: PlanCode | null;
  isPlatformAdmin: boolean;
  /**
   * Saved edos.ai conversations, already grouped by when they were last
   * touched. They fold away under edos.ai instead of sitting in a column
   * beside the chat, which cost the conversation a quarter of its width on
   * every screen the assistant can show, whether or not anyone was reading
   * either.
   */
  history?: HistoryGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  // Which conversation is open, so its row can say so.
  const current = search.get("c");
  const groups = visibleGroups(role, mode, canWrite, plan, isPlatformAdmin);
  const active = activeHref(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );

  // Which groups the user has folded away, remembered between visits.
  const [collapsed, setCollapsed] = useStoredJson(COLLAPSE_KEY, NONE_COLLAPSED);
  // The conversation history is its own fold, open by default so a returning
  // reader sees what they asked last without hunting for it.
  const [historyState, setHistoryState] = useStoredJson(HISTORY_KEY, HISTORY_DEFAULT);

  function toggle(title: string) {
    setCollapsed({ ...collapsed, [title]: !collapsed[title] });
  }

  // A long history is a scrollbar in the middle of the navigation, so only
  // the most recent handful show until someone asks for the rest.
  const totalConversations = history.reduce((n, g) => n + g.items.length, 0);
  const shownHistory = historyState.all ? history : trimHistory(history, HISTORY_SHOWN);

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface md:flex print:hidden">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
        <Wordmark href="/app" />
      </div>

      {/* A read-only account is shown the farm, not invited to change it. */}
      {canWrite && (
        <div className="px-3 py-3">
          <Link
            href="/app/record"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" />
            Record data
          </Link>
        </div>
      )}

      <nav className="scroll-slim flex-1 overflow-y-auto px-2 pb-4" aria-label="Main">
        {groups.map((group, gi) => {
          const title = group.title;
          // A group holding the current page never starts folded — otherwise
          // the sidebar would hide where the user actually is.
          const holdsActive = group.items.some((i) => i.href === active);
          const isCollapsed = title ? Boolean(collapsed[title]) && !holdsActive : false;
          const sectionId = `nav-group-${gi}`;

          return (
            <div key={title ?? `g${gi}`} className={cn(gi > 0 && "mt-3")}>
              {title && (
                <button
                  type="button"
                  onClick={() => toggle(title)}
                  aria-expanded={!isCollapsed}
                  aria-controls={sectionId}
                  className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-ink-faint uppercase hover:text-ink-soft"
                >
                  {title}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                  />
                </button>
              )}

              <ul id={sectionId} className="flex flex-col gap-px" hidden={isCollapsed}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.href;
                  // edos.ai carries its own fold: the saved conversations hang
                  // under it, opened and closed from the row itself rather
                  // than from a column beside the conversation.
                  const foldable = item.href === "/app/assistant" && history.length > 0;
                  const showHistory = foldable && historyState.open;

                  return (
                    <li key={item.href}>
                      <div className="flex items-stretch">
                        <Link
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm transition-colors",
                            isActive
                              ? "bg-brand-soft font-semibold text-brand"
                              : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                          )}
                        >
                          {/* edos.ai wears Hatch360's own mark rather than a
                              stock icon — it is the product speaking. */}
                          {item.href === "/app/assistant" ? (
                            <AssistantGlyph className="h-[1.15rem] w-[1.15rem]" />
                          ) : (
                            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "text-ink-faint")} />
                          )}
                          <span className="truncate">{item.label}</span>
                        </Link>
                        {foldable && (
                          <button
                            type="button"
                            onClick={() => setHistoryState({ ...historyState, open: !historyState.open })}
                            aria-expanded={showHistory}
                            aria-controls="nav-assistant-history"
                            aria-label={showHistory ? "Hide saved conversations" : "Show saved conversations"}
                            className="flex w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-sunk hover:text-ink"
                          >
                            <ChevronDown
                              className={cn("h-3.5 w-3.5 transition-transform", !showHistory && "-rotate-90")}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>

                      {/* Saved conversations live under edos.ai, where the
                          rest of the app's navigation is, instead of taking a
                          column away from the conversation itself. */}
                      {foldable && (
                        <div
                          id="nav-assistant-history"
                          hidden={!showHistory}
                          className="mt-0.5 mb-1.5 ml-[1.05rem] border-l border-line pl-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              startNewConversation();
                              router.push("/app/assistant");
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-soft transition-colors hover:bg-surface-sunk hover:text-ink"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            New conversation
                          </button>

                          {shownHistory.map((bucket) => (
                            <div key={bucket.label} className="mt-1.5">
                              <p className="px-2 pb-0.5 text-[0.625rem] font-semibold tracking-[0.08em] text-ink-faint uppercase">
                                {bucket.label}
                              </p>
                              <ul className="flex flex-col gap-px">
                                {bucket.items.map((c) => {
                                  const open = current === c.id && isActive;
                                  return (
                                    <li key={c.id} className="group/row flex items-center gap-0.5">
                                      <Link
                                        href={`/app/assistant?c=${c.id}`}
                                        aria-current={open ? "page" : undefined}
                                        title={c.title}
                                        className={cn(
                                          "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                                          open
                                            ? "bg-surface-sunk font-medium text-ink"
                                            : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                                        )}
                                      >
                                        {c.title}
                                      </Link>
                                      {/* Out of the way until the row is under
                                          the cursor or the keyboard — a column
                                          of bins invites an accident. */}
                                      <span
                                        className={cn(
                                          "shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100",
                                          open && "opacity-100",
                                        )}
                                      >
                                        <DeleteConversationButton id={c.id} active={open} />
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}

                          {totalConversations > HISTORY_SHOWN && (
                            <button
                              type="button"
                              onClick={() => setHistoryState({ ...historyState, all: !historyState.all })}
                              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[0.6875rem] text-ink-faint transition-colors hover:bg-surface-sunk hover:text-ink"
                            >
                              {historyState.all ? "Show fewer" : `Show all ${totalConversations}`}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

/** The first `limit` conversations, keeping their day headings. */
function trimHistory(groups: HistoryGroup[], limit: number): HistoryGroup[] {
  const kept: HistoryGroup[] = [];
  let left = limit;
  for (const group of groups) {
    if (left <= 0) break;
    kept.push({ label: group.label, items: group.items.slice(0, left) });
    left -= group.items.length;
  }
  return kept;
}
