"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { activeHref, visibleGroups } from "@/lib/nav";
import { useStoredJson } from "@/lib/hooks/use-browser-state";
import type { FarmMode, Role } from "@/lib/database.types";
import type { PlanCode } from "@/lib/plans";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "hatch360:sidebar-collapsed";

// Stable reference: useStoredJson returns this as-is when nothing is stored,
// so an inline literal here would change identity on every render.
const NONE_COLLAPSED: Record<string, boolean> = {};

export function Sidebar({
  role,
  mode,
  canWrite,
  plan,
}: {
  role: Role;
  mode: FarmMode;
  canWrite: boolean;
  /** Null for an organisation with no subscription — nothing is hidden. */
  plan: PlanCode | null;
}) {
  const pathname = usePathname();
  const groups = visibleGroups(role, mode, canWrite, plan);
  const active = activeHref(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );

  // Which groups the user has folded away, remembered between visits.
  const [collapsed, setCollapsed] = useStoredJson(COLLAPSE_KEY, NONE_COLLAPSED);

  function toggle(title: string) {
    setCollapsed({ ...collapsed, [title]: !collapsed[title] });
  }

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

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-w-0 items-center gap-2.5 rounded-md px-2.5 py-[0.4375rem] text-sm transition-colors",
                          isActive
                            ? "bg-brand-soft font-semibold text-brand"
                            : "text-ink-soft hover:bg-surface-sunk hover:text-ink",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-brand" : "text-ink-faint",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
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
