import type { BirdType, WeightBenchmark } from "@/lib/database.types";

/**
 * Expected weight for one flock on one day, read off its breed's published
 * growth curve.
 *
 * Pure and synchronous, like data-quality.ts, so both the server (flock page)
 * and the client (record form) can call it against the same small benchmark
 * list without a second fetch.
 */
export interface ExpectedWeight {
  lowGrams: number;
  highGrams: number;
  /** The document this figure was copied from — always shown, never hidden. */
  source: string;
  /** The age fell outside the published range, so the nearest end was used
   *  rather than a genuine in-range figure. */
  extrapolated: boolean;
}

export function expectedWeightAt(
  benchmarks: WeightBenchmark[],
  birdType: BirdType,
  breed: string | null,
  ageDays: number,
): ExpectedWeight | null {
  if (!breed) return null;

  const rows = benchmarks
    .filter((b) => b.bird_type === birdType && b.breed === breed)
    .sort((a, b) => a.age_days - b.age_days);
  if (rows.length === 0) return null;

  const first = rows[0];
  if (ageDays <= first.age_days) {
    return {
      lowGrams: first.weight_low_grams,
      highGrams: first.weight_high_grams,
      source: first.source,
      extrapolated: ageDays < first.age_days,
    };
  }

  const last = rows[rows.length - 1];
  if (ageDays >= last.age_days) {
    return {
      lowGrams: last.weight_low_grams,
      highGrams: last.weight_high_grams,
      source: last.source,
      extrapolated: ageDays > last.age_days,
    };
  }

  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i];
    const b = rows[i + 1];
    if (ageDays >= a.age_days && ageDays <= b.age_days) {
      const t = (ageDays - a.age_days) / (b.age_days - a.age_days);
      const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
      return {
        lowGrams: lerp(a.weight_low_grams, b.weight_low_grams),
        highGrams: lerp(a.weight_high_grams, b.weight_high_grams),
        source: a.source,
        extrapolated: false,
      };
    }
  }

  return null;
}
