"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, UserPlus, X } from "lucide-react";

import {
  changeRole, inviteMember, removeMember, revokeInvite, type TeamState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import type { Role } from "@/lib/database.types";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSelf: boolean;
  joinedAt: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
}

/** Owner is deliberately absent: a farm has one, and it is not granted here. */
const ASSIGNABLE: { value: Role; label: string; what: string }[] = [
  { value: "manager", label: "Manager", what: "Runs the farm day to day, sees the money" },
  { value: "supervisor", label: "Supervisor", what: "Runs houses and flocks, no money" },
  { value: "worker", label: "Worker", what: "Records the day's eggs, feed and deaths" },
  { value: "vet", label: "Vet", what: "Health records and vaccinations" },
  { value: "accountant", label: "Accountant", what: "Sales, expenses and reports" },
  { value: "sales", label: "Sales", what: "The Counter, customers and invoices" },
  { value: "viewer", label: "Viewer", what: "Reads everything, changes nothing" },
];

const START: TeamState = { error: null, ok: null };

export function TeamManager({
  members,
  invites,
  seatsUsed,
  seatLimit,
}: {
  members: TeamMember[];
  invites: TeamInvite[];
  seatsUsed: number;
  seatLimit: number | null;
}) {
  const router = useRouter();
  const [state, submit, sending] = useActionState(inviteMember, START);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TeamState | null>(null);
  const [copied, setCopied] = useState(false);

  const full = seatLimit !== null && seatsUsed >= seatLimit;

  function run(fn: () => Promise<TeamState>) {
    start(async () => {
      const r = await fn();
      setResult(r);
      if (!r.error) router.refresh();
    });
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const note = result ?? (state.error || state.ok ? state : null);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Invite someone"
          subtitle={
            seatLimit === null
              ? `${seatsUsed} on this farm`
              : `${seatsUsed} of ${seatLimit} seats used`
          }
          icon={<UserPlus className="h-4 w-4" />}
        />
        <CardBody>
          {full ? (
            <p className="text-sm text-ink-soft">
              Every seat on your plan is taken. Cancel an outstanding invitation,
              remove someone, or move to a bigger plan to add more people.
            </p>
          ) : (
            <form action={submit} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-faint">Email address</span>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="them@example.com"
                    className="h-10 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink-faint">Role</span>
                  <select
                    name="role"
                    defaultValue="worker"
                    className="h-10 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink focus:border-brand focus:outline-none"
                  >
                    {ASSIGNABLE.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label} — {r.what}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <Button type="submit" disabled={sending} className="self-start">
                {sending ? "Creating…" : "Create invitation"}
              </Button>
            </form>
          )}

          {note && (
            <p
              role="alert"
              className={cn(
                "mt-3 rounded-lg border px-3 py-2 text-sm",
                note.error
                  ? "border-critical/25 bg-critical-soft text-critical"
                  : "border-good/25 bg-good-soft text-good",
              )}
            >
              {note.error ?? note.ok}
            </p>
          )}

          {/* Shown once. Email delivery is not wired up, so the owner passes
              the link on themselves — by WhatsApp, usually. */}
          {state.link && !state.error && (
            <div className="mt-3 rounded-lg border border-line bg-surface-sunk p-3">
              <p className="text-xs text-ink-soft">
                Send them this link. It works once, and expires in 14 days.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink">
                  {state.link}
                </code>
                <Button size="sm" variant="secondary" onClick={() => copy(state.link!)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader
            title="Waiting to be accepted"
            subtitle={`${invites.length} outstanding`}
            icon={<Mail className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{i.email}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {ASSIGNABLE.find((r) => r.value === i.role)?.label ?? i.role} · expires{" "}
                      {formatDate(i.expiresAt, "long")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => revokeInvite(i.id))}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="On this farm" subtitle={`${members.length} people`} />
        <CardBody className="p-0">
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {m.name}
                    {m.isSelf && <Badge tone="neutral">you</Badge>}
                    {m.role === "owner" && <Badge tone="brand">owner</Badge>}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-faint">
                    {m.email} · joined {formatDate(m.joinedAt, "long")}
                  </p>
                </div>

                {m.role === "owner" ? (
                  <span className="text-xs text-ink-faint">Owns this farm</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      disabled={pending || m.isSelf}
                      onChange={(e) => run(() => changeRole(m.id, e.target.value as Role))}
                      className="h-8 rounded-md border border-line bg-canvas px-2 text-sm text-ink focus:border-brand focus:outline-none disabled:opacity-50"
                    >
                      {ASSIGNABLE.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending || m.isSelf}
                      onClick={() => run(() => removeMember(m.id))}
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
