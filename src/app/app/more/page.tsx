import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut, UserRound } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { visibleGroups } from "@/lib/nav";
import { signOut, switchTenant } from "../actions";

import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";

export const metadata: Metadata = { title: "More" };

/**
 * The mobile bottom bar holds five destinations; everything else lives here.
 * This is also where the organisation switcher and sign-out live on a phone,
 * since the top bar has no room for them.
 */
export default async function MorePage() {
  const session = await requireSession();
  const groups = visibleGroups(
    session.role,
    session.mode,
    can(session.role, CAN_WRITE),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Card>
        <CardBody className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
            {initials(session.user.full_name ?? session.user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {session.user.full_name ?? session.user.email}
            </p>
            <p className="truncate text-xs text-ink-faint">{session.tenant.name}</p>
          </div>
          <Badge tone="brand">{session.role}</Badge>
        </CardBody>
      </Card>

      {groups.map((group, gi) => (
        <div key={group.title ?? `g${gi}`}>
          {group.title && (
            <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
              {group.title}
            </h2>
          )}
          <Card>
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-sunk"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium text-ink">{item.label}</span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      ))}

      {session.tenants.length > 1 && (
        <div>
          <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
            Switch organisation
          </h2>
          <Card>
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {session.tenants.map((t) => (
                  <li key={t.id}>
                    <form action={switchTenant.bind(null, t.id)}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-sunk"
                      >
                        <span className="flex-1 text-sm font-medium text-ink">{t.name}</span>
                        {t.id === session.tenant.id ? (
                          <Badge tone="good" dot>Current</Badge>
                        ) : (
                          <ChevronRight className="h-4 w-4 text-ink-faint" />
                        )}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          <ul className="divide-y divide-line">
            <li>
              <Link
                href="/app/profile"
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-sunk"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunk text-ink-soft">
                  <UserRound className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-medium text-ink">Your profile</span>
                <ChevronRight className="h-4 w-4 text-ink-faint" />
              </Link>
            </li>
            <li>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-critical-soft"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-critical-soft text-critical">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-critical">Sign out</span>
                </button>
              </form>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
