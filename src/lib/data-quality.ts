import type { BirdType } from "@/lib/database.types";
import { formatNumber } from "@/lib/utils";

/**
 * What counts as a believable day on a poultry farm.
 *
 * One module, three consumers: the entry form uses it to explain a bad number
 * before it is saved, the Assistant uses it to flag records already in the
 * database, and migration 0023 mirrors the *impossible* half of it as
 * Postgres triggers. Keeping the thresholds here means the three can never
 * drift into disagreeing about what "too much feed" means.
 *
 * Two levels, and the difference matters:
 *
 *   error   — arithmetic that cannot be true. More eggs than birds, a record
 *             dated before the birds arrived. These are refused.
 *   warning — possible but unusual. Twice the normal feed, a tenth of the
 *             usual eggs. These are shown and can be saved anyway, because a
 *             farm having a genuinely strange day is exactly the thing the
 *             records exist to capture.
 *
 * Refusing a warning would teach people to type a number the form accepts
 * rather than the number they measured, which is worse than no check at all.
 */

export type IssueLevel = "error" | "warning";

export interface DataIssue {
  /** Form field this belongs beside, where there is one. */
  field?: string;
  level: IssueLevel;
  /** What is wrong, in words a farmer would use. */
  message: string;
  /** Why it is wrong, or what to check. Always shown — the "why" matters. */
  why: string;
}

/**
 * Thresholds. The feed and water figures are per bird per day and are wide on
 * purpose: they are meant to catch a decimal point in the wrong place or a
 * whole-bag entry typed as kilogrammes, not to second-guess a farmer's
 * rationing.
 */
export const LIMITS = {
  /** Feed per bird per day, kg. A layer eats ~0.12; a finishing broiler ~0.17. */
  feedKgPerBirdHigh: 0.35,
  feedKgPerBirdLow: 0.01,
  /** Water per bird per day, litres. Roughly twice feed by weight. */
  waterLPerBirdHigh: 1.0,
  /** A hen cannot lay more than one egg a day; near it is remarkable. */
  layRateWarn: 0.95,
  /** Losing this share of the flock in a single day is an event, not a day. */
  dailyLossPctWarn: 2,
  /** Breakages above this are usually handling, not chance. */
  brokenPctWarn: 5,
  /** Heaviest plausible bird, grams. A big turkey stag is ~ 20 kg. */
  weightGramsMax: 20000,
  /** A flock losing weight between weighings is worth a second look. */
  weightDropPctWarn: 5,
  temperatureCMin: -10,
  temperatureCMax: 55,
} as const;

export interface DailyRecordValues {
  recordDate: string;
  mortality: number;
  culls: number;
  birdsSold: number;
  eggsCollected: number | null;
  eggsBroken: number | null;
  eggsRejected: number | null;
  feedKg: number | null;
  waterLitres: number | null;
  weightGrams: number | null;
}

export interface FlockContext {
  code: string;
  birdType: BirdType;
  placementDate: string;
  placementCount: number;
  /** Live birds before this record is applied. */
  currentCount: number;
  /**
   * Losses already recorded on this same date, when an existing record is
   * being edited. They are added back before the "more birds than you have"
   * test, or correcting yesterday's entry would fail against itself.
   */
  alreadyRecordedToday?: number;
  /** The most recent weighing before this date, for a drop check. */
  previousWeightGrams?: number | null;
}

/** Bird types that produce eggs worth recording. */
const LAYING_TYPES: BirdType[] = ["layer", "kienyeji", "improved_kienyeji", "breeder"];

function n(value: number): string {
  return formatNumber(value);
}

/**
 * Every problem with one day's entry, worst first.
 *
 * Pure and synchronous so the form can run it on every keystroke and the
 * Assistant can run it over a year of history without touching the network.
 */
export function checkDailyRecord(
  values: DailyRecordValues,
  flock: FlockContext,
  todayIso: string,
): DataIssue[] {
  const issues: DataIssue[] = [];

  const {
    recordDate, mortality, culls, birdsSold,
    eggsCollected, eggsBroken, eggsRejected,
    feedKg, waterLitres, weightGrams,
  } = values;

  /* ------------------------------------------------------------ dates -- */

  if (recordDate > todayIso) {
    issues.push({
      field: "record_date",
      level: "error",
      message: "This day has not happened yet.",
      why: "A record dated in the future would count towards averages and feed costs before the birds have eaten anything.",
    });
  }

  if (recordDate < flock.placementDate) {
    issues.push({
      field: "record_date",
      level: "error",
      message: `${flock.code} was not on the farm on that date.`,
      why: `These birds arrived on ${flock.placementDate}. A record before that belongs to a different batch.`,
    });
  }

  /* ----------------------------------------------------------- losses -- */

  const lost = mortality + culls + birdsSold;
  const available = flock.currentCount + (flock.alreadyRecordedToday ?? 0);

  if (lost > available) {
    issues.push({
      field: "mortality",
      level: "error",
      message: `That is ${n(lost)} birds leaving a flock of ${n(available)}.`,
      why: `${flock.code} cannot lose more birds than it has. Check whether one of these numbers belongs to another house.`,
    });
  } else if (available > 0 && (lost / available) * 100 > LIMITS.dailyLossPctWarn) {
    const pct = ((lost / available) * 100).toFixed(1);
    issues.push({
      field: "mortality",
      level: "warning",
      message: `${pct}% of the flock in one day.`,
      why: "Losing more than 2% in a day usually means disease, heat or a predator rather than ordinary wastage. Save it if it is right, and tell your animal health officer.",
    });
  }

  /* ------------------------------------------------------------- eggs -- */

  const collected = eggsCollected ?? 0;
  const broken = eggsBroken ?? 0;
  const rejected = eggsRejected ?? 0;
  const birdsAfter = Math.max(0, available - lost);

  if (collected > 0 && !LAYING_TYPES.includes(flock.birdType)) {
    issues.push({
      field: "eggs_collected",
      level: "warning",
      message: "These birds are not kept for eggs.",
      why: `${flock.code} is recorded as ${flock.birdType.replace(/_/g, " ")}. If it is laying, the bird type on the flock is probably wrong.`,
    });
  }

  if (broken + rejected > collected) {
    issues.push({
      field: "eggs_broken",
      level: "error",
      message: `${n(broken + rejected)} broken and rejected out of ${n(collected)} collected.`,
      why: "Broken and rejected eggs are part of what was collected, not extra to it. Collected should be the total picked up.",
    });
  }

  if (collected > 0 && birdsAfter > 0) {
    const rate = collected / birdsAfter;
    if (rate > 1) {
      issues.push({
        field: "eggs_collected",
        level: "error",
        message: `${n(collected)} eggs from ${n(birdsAfter)} birds.`,
        why: "A hen lays at most one egg a day, so this is more eggs than there are birds to lay them. If you are entering trays, multiply by 30.",
      });
    } else if (rate > LIMITS.layRateWarn) {
      issues.push({
        field: "eggs_collected",
        level: "warning",
        message: `That is a ${(rate * 100).toFixed(0)}% lay rate.`,
        why: "Almost every bird laying on the same day is possible at peak, but rare. Worth a second look before saving.",
      });
    }
  }

  if (collected > 0 && broken > 0 && (broken / collected) * 100 > LIMITS.brokenPctWarn) {
    issues.push({
      field: "eggs_broken",
      level: "warning",
      message: `${((broken / collected) * 100).toFixed(0)}% of the eggs broke.`,
      why: "Above about 5% is usually handling, thin shells or nest boxes rather than bad luck. Worth checking the collection routine.",
    });
  }

  /* ------------------------------------------------------------- feed -- */

  if (feedKg !== null && feedKg > 0 && birdsAfter > 0) {
    const perBird = feedKg / birdsAfter;
    if (perBird > LIMITS.feedKgPerBirdHigh) {
      issues.push({
        field: "feed_consumed_kg",
        level: "warning",
        message: `${perBird.toFixed(2)} kg per bird in one day.`,
        why: `A bird eats roughly 0.05–0.17 kg a day. ${n(feedKg)} kg across ${n(birdsAfter)} birds is far above that — check whether this is a whole bag rather than what was fed today.`,
      });
    } else if (perBird < LIMITS.feedKgPerBirdLow) {
      issues.push({
        field: "feed_consumed_kg",
        level: "warning",
        message: `Only ${perBird.toFixed(3)} kg per bird.`,
        why: "That is far below what a bird eats in a day. If feed ran out, it is worth a note — it will show up later as lost weight or lost eggs.",
      });
    }
  }

  if (waterLitres !== null && waterLitres > 0 && birdsAfter > 0) {
    const perBird = waterLitres / birdsAfter;
    if (perBird > LIMITS.waterLPerBirdHigh) {
      issues.push({
        field: "water_consumed_liters",
        level: "warning",
        message: `${perBird.toFixed(2)} litres per bird in one day.`,
        why: "Birds drink roughly twice what they eat by weight. This is well above that — check for a leak, or whether the figure is the tank rather than what was drunk.",
      });
    }
  }

  /* ----------------------------------------------------------- weight -- */

  if (weightGrams !== null && weightGrams > LIMITS.weightGramsMax) {
    issues.push({
      field: "avg_weight_grams",
      level: "error",
      message: `${n(weightGrams)} g is heavier than any farmed bird.`,
      why: "This field is the average weight of one bird in grams. A 2 kg broiler is 2000.",
    });
  }

  if (
    weightGrams !== null &&
    weightGrams > 0 &&
    flock.previousWeightGrams &&
    flock.previousWeightGrams > 0
  ) {
    const drop = ((flock.previousWeightGrams - weightGrams) / flock.previousWeightGrams) * 100;
    if (drop > LIMITS.weightDropPctWarn) {
      issues.push({
        field: "avg_weight_grams",
        level: "warning",
        message: `Down ${drop.toFixed(0)}% since the last weighing.`,
        why: `The last recorded average was ${n(flock.previousWeightGrams)} g. Birds losing weight point to feed, water or disease — or to a sample that was too small.`,
      });
    }
  }

  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));
}

export function hasErrors(issues: DataIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/**
 * Turn a Postgres rejection into something worth reading.
 *
 * The triggers in migration 0023 raise SQLSTATE HB001 with a sentence already
 * written for a person, so those pass through untouched. Anything else gets a
 * plain fallback rather than a constraint name, which tells a farmer nothing.
 */
export function describeWriteError(error: { code?: string; message?: string } | null): string {
  if (!error) return "We couldn't save that. Try again.";

  // Raised by our own validation triggers: already in plain words.
  if (error.code === "HB001" && error.message) return error.message;

  if (error.code === "23514") {
    return "One of those numbers is outside what this field allows. Check for a negative value.";
  }
  if (error.code === "23505") {
    return "There is already a record for that flock on that date.";
  }
  if (error.code === "23503") {
    return "That flock no longer exists. Refresh the page and try again.";
  }

  return "We couldn't save that. Check your connection and try again.";
}
