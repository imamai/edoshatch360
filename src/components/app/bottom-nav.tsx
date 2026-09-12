"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { MOBILE_NAV, activeHref } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom bar with a raised centre action. The nav itself holds five
 * destinations; the floating button is the one thing a farmer opens the app to
 * do, so it does not compete with them for a slot.
 */
export function BottomNav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  const active = activeHref(pathname, MOBILE_NAV.map((i) => i.href));

  return (
    <>
      {/* A read-only account is shown the farm, not invited to change it. */}
      {canWrite && (
        <Link
          href="/app/record"
          aria-label="Record data"
          className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-pop transition-transform active:scale-95 md:hidden print:hidden"
        >
          <Plus className="h-6 w-6" />
        </Link>
      )}

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.6875rem] font-medium transition-colors",
                    isActive ? "text-brand" : "text-ink-faint",
                  )}
                >
                  <Icon className={cn("h-5 w-5", isActive && "stroke-[2.4]")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
