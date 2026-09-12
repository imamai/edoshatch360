import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, ListChecks, TriangleAlert } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getFlocks } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ReopenButton, TaskForm, TaskToggle } from "./task-ui";
import { relativeDay, today } from "@/lib/utils";
import type { AppUser, Priority, Task } from "@/lib/database.types";

export const metadata: Metadata = { title: "Tasks" };

const PRIORITY_TONE: Record<Priority, Tone> = {
  low: "neutral",
  normal: "info",
  high: "attention",
  urgent: "critical",
};

export default async function TasksPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [taskRes, memberRes, flocks] = await Promise.all([
    supabase
      .from("edoshatch360_tasks")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("due_date", { nullsFirst: false })
      .limit(200),
    supabase
      .from("edoshatch360_memberships")
      .select("user_id, edoshatch360_users(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .eq("status", "active"),
    getFlocks(session.tenant.id),
  ]);

  const tasks = (taskRes.data ?? []) as Task[];
  const people = ((memberRes.data ?? []) as unknown as {
    edoshatch360_users: Pick<AppUser, "id" | "full_name" | "email"> | null;
  }[])
    .map((m) => m.edoshatch360_users)
    .filter((u): u is Pick<AppUser, "id" | "full_name" | "email"> => u !== null);

  const personName = new Map(people.map((p) => [p.id, p.full_name ?? p.email ?? "Team member"]));
  const flockCode = new Map(flocks.map((f) => [f.id, f.code]));

  const t = today();
  const open = tasks.filter((x) => x.status !== "done" && x.status !== "cancelled");
  const done = tasks.filter((x) => x.status === "done");
  const overdue = open.filter((x) => x.due_date && x.due_date < t);
  const dueToday = open.filter((x) => x.due_date === t);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Tasks</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What the farm owes itself this week, and who is doing it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open"
          value={open.length}
          icon={<ListChecks className="h-4.5 w-4.5" />}
          tone="brand"
        />
        <StatCard
          label="Due today"
          value={dueToday.length}
          icon={<CalendarClock className="h-4.5 w-4.5" />}
          tone={dueToday.length > 0 ? "attention" : "neutral"}
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          icon={<TriangleAlert className="h-4.5 w-4.5" />}
          tone={overdue.length > 0 ? "critical" : "good"}
        />
        <StatCard
          label="Done"
          value={done.length}
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
          tone="good"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="To do"
              subtitle={`${open.length} open`}
              icon={<ListChecks className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {open.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="Nothing outstanding"
                  description="Add the jobs the farm needs doing and assign them, so nothing depends on someone remembering."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {[...overdue, ...open.filter((x) => !overdue.includes(x))].map((task) => {
                    const late = task.due_date && task.due_date < t;
                    return (
                      <li key={task.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                        <div className="pt-0.5">
                          <TaskToggle id={task.id} done={false} title={task.title} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">{task.title}</p>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {task.due_date ? relativeDay(task.due_date) : "No due date"}
                            {task.assignee_id
                              ? ` · ${personName.get(task.assignee_id) ?? "Assigned"}`
                              : ""}
                            {task.flock_id ? ` · ${flockCode.get(task.flock_id) ?? ""}` : ""}
                          </p>
                          {task.description && (
                            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                              {task.description}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge tone={late ? "critical" : PRIORITY_TONE[task.priority]} dot>
                            {late ? "Overdue" : task.priority}
                          </Badge>
                          {task.category && (
                            <span className="text-[0.6875rem] text-ink-faint">
                              {task.category}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {done.length > 0 && (
            <Card>
              <CardHeader title="Recently done" icon={<CheckCircle2 className="h-4 w-4" />} />
              <CardBody className="p-0">
                <ul className="divide-y divide-line">
                  {done.slice(0, 10).map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink-faint line-through">
                          {task.title}
                        </p>
                        <p className="text-xs text-ink-faint">
                          {task.completed_at ? relativeDay(task.completed_at) : ""}
                        </p>
                      </div>
                      <ReopenButton id={task.id} />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>

        <TaskForm farms={session.farms} flocks={flocks} people={people} />
      </div>
    </div>
  );
}
