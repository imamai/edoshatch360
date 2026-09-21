import "server-only";

import { createClient } from "@/lib/supabase/server";
import { CAN_SEE_MONEY, can, type SessionContext } from "@/lib/data/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getFlocks } from "@/lib/data/flocks";
import { getWeightBenchmarks } from "@/lib/data/weight-benchmarks";
import type { AnalysisInput } from "./insights";
import type { FlockMetrics } from "@/lib/database.types";

/**
 * Everything edos.ai reads, in one round trip.
 *
 * Before this, the page's Analysis tab and the chat action each fetched the
 * dashboard, the flocks and every flock's metrics separately — the same five
 * queries, written twice, with no guarantee the two copies stayed in step.
 * Both now call this.
 */
export async function loadAnalysisInput(session: SessionContext): Promise<AnalysisInput> {
  const supabase = await createClient();

  const [data, flocks, weightBenchmarks] = await Promise.all([
    getDashboardData(session.tenant.id),
    getFlocks(session.tenant.id),
    getWeightBenchmarks(),
  ]);

  const metrics = await Promise.all(
    flocks.map(async (flock) => {
      const { data: m } = await supabase.rpc("edoshatch360_flock_metrics", { p_flock: flock.id });
      return { flock, metrics: (m as FlockMetrics) ?? null };
    }),
  );

  return {
    data,
    metrics,
    currency: session.tenant.currency,
    canSeeMoney: can(session.role, CAN_SEE_MONEY),
    weightBenchmarks,
  };
}
