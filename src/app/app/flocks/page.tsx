import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bird, Plus } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { BIRD_TYPE_LABEL, FLOCK_STATUS_LABEL, flockAgeDays, getFlocks } from "@/lib/data/flocks";

import { Card, CardBody } from "@/components/ui/card";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { Flock } from "@/lib/database.types";

export const metadata: Metadata = { title: "Flocks" };

const STATUS_TONE: Record<Flock["status"], Tone> = {
  planned: "neutral",
  brooding: "info",
  growing: "brand",
  laying: "good",
  finishing: "attention",
  harvested: "neutral",
  closed: "neutral",
};

export default async function FlocksPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const includeClosed = params.show === "all";

  const flocks = await getFlocks(session.tenant.id, { includeClosed });

  // Mortality per flock, from the same Postgres function the dashboard and
  // reports use — the figure on this list cannot disagree with the one on the
  // flock's own page.
  const supabase = await createClient();
  const metrics = await Promise.all(
    flocks.map(async (f) => {
      const { data } = await supabase.rpc("edoshatch360_flock_metrics", { p_flock: f.id });
      return { id: f.id, m: data as { mortality_pct: number; lay_pct: number | null } | null };
    }),
  );
  const metricById = new Map(metrics.map((x) => [x.id, x.m]));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Flocks</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {flocks.length} {includeClosed ? "total" : "active"} ·{" "}
            {formatNumber(flocks.reduce((a, f) => a + f.current_count, 0))} birds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={includeClosed ? "/app/flocks" : "/app/flocks?show=all"}
            className="rounded-lg border border-line-strong px-3 py-2 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand"
          >
            {includeClosed ? "Active only" : "Include closed"}
          </Link>
          {can(session.role, CAN_WRITE) && (
            <ButtonLink href="/app/flocks/new" size="sm">
              <Plus className="h-4 w-4" />
              Add flock
            </ButtonLink>
          )}
        </div>
      </div>

      {flocks.length === 0 ? (
        <Card className="mt-5">
          <CardBody>
            <EmptyState
              icon={<Bird className="h-6 w-6" />}
              title="No flocks yet"
              description="Your first flock is only a few taps away. Add the birds you have and Hatch360 starts tracking them."
              action={<ButtonLink href="/app/flocks/new">Add a flock</ButtonLink>}
            />
          </CardBody>
        </Card>
      ) : (
        <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {flocks.map((flock) => {
            const m = metricById.get(flock.id);
            const age = flockAgeDays(flock);
            const lossPct = m?.mortality_pct ?? 0;

            return (
              <li key={flock.id}>
                <Link
                  href={`/app/flocks/${flock.id}`}
                  className="group flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Bird className="h-5 w-5" />
                    </span>
                    <Badge tone={STATUS_TONE[flock.status]} dot>
                      {FLOCK_STATUS_LABEL[flock.status]}
                    </Badge>
                  </div>

                  <h2 className="mt-3 font-display text-base font-bold text-ink">
                    {flock.code}
                  </h2>
                  <p className="text-xs text-ink-faint">
                    {BIRD_TYPE_LABEL[flock.bird_type]}
                    {flock.breed ? ` · ${flock.breed}` : ""} · day {age}
                  </p>

                  <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <div>
                      <dt className="text-[0.6875rem] text-ink-faint">Birds</dt>
                      <dd className="text-sm font-semibold text-ink tnum">
                        {formatNumber(flock.current_count)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-faint">Placed</dt>
                      <dd className="text-sm font-semibold text-ink tnum">
                        {formatNumber(flock.placement_count)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.6875rem] text-ink-faint">Losses</dt>
                      <dd
                        className={`text-sm font-semibold tnum ${
                          lossPct > 5 ? "text-critical" : "text-ink"
                        }`}
                      >
                        {formatPercent(lossPct)}
                      </dd>
                    </div>
                  </dl>

                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
