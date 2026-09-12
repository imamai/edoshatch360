"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell, Building2, Check, ChevronDown, LogOut, Search, Settings, UserRound,
} from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { SyncBadge } from "./sync-badge";
import { signOut, switchTenant } from "@/app/app/actions";
import type { Role } from "@/lib/database.types";
import { cn, initials } from "@/lib/utils";

interface TenantOption {
  id: string;
  name: string;
  role: Role;
}

/** Closes a popover on outside click and on Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function TenantSwitcher({
  tenants,
  activeId,
  activeName,
}: {
  tenants: TenantOption[];
  activeId: string;
  activeName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  // With one organisation there is nothing to switch between — show the name
  // as plain text rather than a control that does nothing.
  if (tenants.length <= 1) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
        <Building2 className="h-4 w-4 shrink-0 text-ink-faint" />
        <span className="truncate">{activeName}</span>
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink hover:bg-surface-sunk"
      >
        <Building2 className="h-4 w-4 shrink-0 text-ink-faint" />
        <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{activeName}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <p className="border-b border-line px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Your organisations
          </p>
          {tenants.map((t) => (
            <form key={t.id} action={switchTenant.bind(null, t.id)}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-sunk"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{t.name}</span>
                  <span className="block text-xs text-ink-faint capitalize">{t.role}</span>
                </span>
                {t.id === activeId && <Check className="h-4 w-4 shrink-0 text-brand" />}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({
  name,
  email,
  role,
  canAdmin,
}: {
  name: string;
  email: string;
  role: Role;
  canAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand hover:bg-brand hover:text-white"
      >
        {initials(name)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
        >
          <div className="border-b border-line px-3 py-3">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-faint">{email}</p>
            <p className="mt-1 inline-flex rounded-full bg-brand-soft px-2 py-0.5 text-[0.6875rem] font-medium text-brand capitalize">
              {role}
            </p>
          </div>

          <Link
            href="/app/profile"
            role="menuitem"
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-sunk hover:text-ink"
          >
            <UserRound className="h-4 w-4" />
            Your profile
          </Link>

          {canAdmin && (
            <Link
              href="/app/settings"
              role="menuitem"
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-sunk hover:text-ink"
            >
              <Settings className="h-4 w-4" />
              Farm settings
            </Link>
          )}

          <form action={signOut} className="border-t border-line">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-soft hover:bg-critical-soft hover:text-critical"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Topbar({
  tenants,
  activeTenantId,
  activeTenantName,
  userName,
  userEmail,
  role,
  unreadCount,
}: {
  tenants: TenantOption[];
  activeTenantId: string;
  activeTenantName: string;
  userName: string;
  userEmail: string;
  role: Role;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-sm sm:px-6 print:hidden">
      {/* The wordmark lives in the sidebar on desktop; on mobile it belongs here. */}
      <div className="md:hidden">
        <Wordmark href="/app" />
      </div>

      <div className="hidden min-w-0 md:block">
        <TenantSwitcher
          tenants={tenants}
          activeId={activeTenantId}
          activeName={activeTenantName}
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <SyncBadge className="hidden sm:inline-flex" />

        <Link
          href="/app/search"
          aria-label="Search"
          className="flex h-9 items-center gap-2 rounded-lg border border-line-strong px-2.5 text-sm text-ink-faint hover:border-brand hover:text-brand sm:w-56 sm:justify-start"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Search the farm…</span>
        </Link>

        <Link
          href="/app/notifications"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-sunk hover:text-ink"
        >
          <Bell className="h-[1.15rem] w-[1.15rem]" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1",
                "text-[0.625rem] font-bold text-white tnum",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <UserMenu
          name={userName}
          email={userEmail}
          role={role}
          canAdmin={role === "owner"}
        />
      </div>
    </header>
  );
}
