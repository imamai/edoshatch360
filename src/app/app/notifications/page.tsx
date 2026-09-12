import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellOff, CheckCheck } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { computeAlerts, getDashboardData } from "@/lib/data/dashboard";
import { markAllNotificationsRead } from "../actions";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertList } from "@/components/app/alert-list";
import { relativeDay } from "@/lib/utils";
import type { Notification, Severity } from "@/lib/database.types";

export const metadata: Metadata = { title: "Notifications" };

const SEVERITY_TONE: Record<Severity, Tone> = {
  info: "info",
  attention: "attention",
  critical: "critical",
};

export default async function NotificationsPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [{ data }, dashboard] = await Promise.all([
    supabase
      .from("edoshatch360_notifications")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(50),
    getDashboardData(session.tenant.id),
  ]);

  const notifications = (data ?? []) as Notification[];
  const unread = notifications.filter((n) => !n.is_read).length;
  // Live alerts are derived from current data, so they sit alongside stored
  // notifications rather than being written into the table and going stale.
  const alerts = computeAlerts(dashboard);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            What the farm is telling you right now, and what we have sent you.
          </p>
        </div>

        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          </form>
        )}
      </div>

      <section>
        <h2 className="mb-3 font-display text-base font-bold text-ink">Needs your attention</h2>
        <AlertList alerts={alerts} />
      </section>

      <Card>
        <CardHeader
          title="Messages"
          subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
          icon={<Bell className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<BellOff className="h-6 w-6" />}
              title="No messages"
              description="Reminders and system messages will appear here. The live alerts above come straight from your records."
            />
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((n) => {
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${n.is_read ? "text-ink-soft" : "font-semibold text-ink"}`}
                      >
                        {n.title}
                      </p>
                      <Badge tone={SEVERITY_TONE[n.severity]} dot>
                        {n.category}
                      </Badge>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{n.body}</p>
                    )}
                    <p className="mt-1 text-[0.6875rem] text-ink-faint">
                      {relativeDay(n.created_at)}
                    </p>
                  </>
                );

                return (
                  <li key={n.id} className="px-4 py-3 sm:px-5">
                    {n.link ? (
                      <Link href={n.link} className="block hover:opacity-80">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
