import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, Pill, Stethoscope, Syringe } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { getFlocks } from "@/lib/data/flocks";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import {
  AddIncidentForm, AddVaccinationForm, ProgrammeForm, type Person,
} from "./health-forms";
import { VaccinationRow } from "./vaccination-row";
import { IncidentRow } from "./incident-row";
import { relativeDay, today } from "@/lib/utils";
import type { HealthRecord, Medication, Vaccination } from "@/lib/database.types";
import { Bird } from "lucide-react";

export const metadata: Metadata = { title: "Health" };

export default async function HealthPage() {
  const session = await requireSession();
  const canManage = can(session.role, CAN_WRITE);
  // Hidden in the navigation, but a URL still resolves — so the page
  // itself has to know what the plan carries.
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("vaccinations")) {
    return <UpgradeNotice what="Health and vaccinations" from={featureFrom("vaccinations")} />;
  }
  const flocks = await getFlocks(session.tenant.id);

  if (flocks.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Health</h1>
        <Card className="mt-5">
          <CardBody>
            <EmptyState
              icon={<Bird className="h-6 w-6" />}
              title="No flocks to look after yet"
              description="Vaccination schedules and health records attach to a flock, so add one first."
              action={<ButtonLink href="/app/flocks/new">Add a flock</ButtonLink>}
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [vaccRes, medRes, incidentRes, memberRes] = await Promise.all([
    supabase
      .from("edoshatch360_vaccinations")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("due_date"),
    supabase
      .from("edoshatch360_medications")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("started_on", { ascending: false })
      .limit(20),
    supabase
      .from("edoshatch360_health_records")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("occurred_on", { ascending: false })
      .limit(20),
    supabase
      .from("edoshatch360_memberships")
      .select("edoshatch360_users(id, full_name, email)")
      .eq("tenant_id", session.tenant.id)
      .eq("status", "active"),
  ]);

  const vaccinations = (vaccRes.data ?? []) as Vaccination[];
  const medications = (medRes.data ?? []) as Medication[];
  const incidents = (incidentRes.data ?? []) as HealthRecord[];

  const people = ((memberRes.data ?? []) as unknown as {
    edoshatch360_users: Person | null;
  }[])
    .map((m) => m.edoshatch360_users)
    .filter((u): u is Person => u !== null);

  const personName = new Map(
    people.map((p) => [p.id, p.full_name ?? p.email ?? "Team member"]),
  );

  const t = today();
  const flockCode = new Map(flocks.map((f) => [f.id, f.code]));
  const flockBirds = new Map(flocks.map((f) => [f.id, f.current_count]));

  const overdue = vaccinations.filter((v) => v.status !== "done" && v.due_date < t);
  const upcoming = vaccinations.filter((v) => v.status !== "done" && v.due_date >= t);
  const done = vaccinations.filter((v) => v.status === "done");
  const compliance =
    overdue.length + done.length > 0
      ? Math.round((done.length / (done.length + overdue.length)) * 100)
      : null;

  // Medications whose withdrawal period has not yet expired — birds and eggs
  // from these flocks must not be sold.
  const inWithdrawal = medications.filter((m) => m.withdrawal_until >= t);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Health</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Vaccination programme, treatments and anything that has gone wrong.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overdue doses"
          value={overdue.length}
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
          tone={overdue.length > 0 ? "critical" : "good"}
        />
        <StatCard
          label="Due next"
          value={upcoming.length}
          hint={upcoming[0] ? relativeDay(upcoming[0].due_date) : "Nothing scheduled"}
          icon={<Syringe className="h-4.5 w-4.5" />}
          tone="info"
        />
        <StatCard
          label="Compliance"
          value={compliance !== null ? `${compliance}%` : "—"}
          hint="Doses given on schedule"
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
          tone={compliance !== null && compliance >= 90 ? "good" : "attention"}
        />
        <StatCard
          label="In withdrawal"
          value={inWithdrawal.length}
          hint={inWithdrawal.length > 0 ? "Do not sell from these flocks" : "Safe to sell"}
          icon={<Pill className="h-4.5 w-4.5" />}
          tone={inWithdrawal.length > 0 ? "attention" : "neutral"}
        />
      </div>

      {inWithdrawal.length > 0 && (
        <div className="rounded-xl border border-attention/25 bg-attention-soft p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-attention">
            <AlertTriangle className="h-4 w-4" />
            Withdrawal periods in force
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {inWithdrawal.map((m) => (
              <li key={m.id} className="text-xs text-ink-soft">
                <strong className="text-ink">{flockCode.get(m.flock_id) ?? "Flock"}</strong> ·{" "}
                {m.product_name} — safe to sell from {m.withdrawal_until} (
                {relativeDay(m.withdrawal_until)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Vaccination schedule"
              subtitle={`${vaccinations.length} doses across ${flocks.length} flock${flocks.length === 1 ? "" : "s"}`}
              icon={<Syringe className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {vaccinations.length === 0 ? (
                <EmptyState
                  icon={<Syringe className="h-6 w-6" />}
                  title="No vaccinations scheduled"
                  description="Use the panel alongside to schedule the standard programme for a flock in one step."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {[...overdue, ...upcoming, ...done.slice(0, 8)].map((v) => {
                    const isOverdue = v.status !== "done" && v.due_date < t;
                    const givenBy =
                      v.administered_name ??
                      (v.administered_by ? (personName.get(v.administered_by) ?? null) : null);
                    const supervisedBy =
                      v.supervisor_name ??
                      (v.supervised_by ? (personName.get(v.supervised_by) ?? null) : null);

                    return (
                      <VaccinationRow
                        key={v.id}
                        v={v}
                        flockCode={flockCode.get(v.flock_id) ?? "Flock"}
                        givenBy={givenBy}
                        supervisedBy={supervisedBy}
                        isOverdue={isOverdue}
                        people={people}
                        suggestedBirds={flockBirds.get(v.flock_id) ?? 0}
                        canManage={canManage}
                      />
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Health problems"
              subtitle="Most recent first"
              icon={<Stethoscope className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              {incidents.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  title="Nothing reported"
                  description="When something goes wrong, record it here — the pattern across batches is often what explains it."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {incidents.map((h) => (
                    <IncidentRow
                      key={h.id}
                      h={h}
                      flockCode={flockCode.get(h.flock_id) ?? "Flock"}
                      canManage={canManage}
                    />
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <ProgrammeForm flocks={flocks} />
          <AddVaccinationForm flocks={flocks} />
          <AddIncidentForm flocks={flocks} />
        </div>
      </div>
    </div>
  );
}
