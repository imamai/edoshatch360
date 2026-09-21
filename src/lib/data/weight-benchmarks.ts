import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { WeightBenchmark } from "@/lib/database.types";

/**
 * Published breed growth curves — reference data, not tenant data, so one
 * query serves every farm. Cached per request the same way getSession is:
 * the record page and the flock page each want it on the same request.
 */
export const getWeightBenchmarks = cache(async (): Promise<WeightBenchmark[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_weight_benchmarks")
    .select("*")
    .order("age_days")
    .returns<WeightBenchmark[]>();
  return data ?? [];
});
