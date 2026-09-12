import type { Metadata } from "next";
import Link from "next/link";
import { Bird, Plus } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import type { FlockMetrics } from "@/lib/database.types";
import { flockAgeDays, getFlocks } from "@/lib/data/flocks";

import { Card, CardBody } from "@/components/ui/card";
import { FlockCard } from "@/components/app/flock-card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Flocks" };

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
      return { id: f.id, m: data as Pick<FlockMetrics, "mortality_pct" | "lay_pct"> | null };
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
          {flocks.map((flock) => (
            <li key={flock.id}>
              <FlockCard
                flock={flock}
                metrics={metricById.get(flock.id) ?? null}
                age={flockAgeDays(flock)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
