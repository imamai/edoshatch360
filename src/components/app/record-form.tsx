"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, ChevronDown, CloudOff, Egg, Scale, Skull, TriangleAlert, Wheat,
} from "lucide-react";

import { useOffline } from "./offline-provider";
import { useStoredJson } from "@/lib/hooks/use-browser-state";
import { Button } from "@/components/ui/button";
import { NumberInput, TextArea } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import {
  checkDailyRecord, hasErrors, type DataIssue,
} from "@/lib/data-quality";
import type { DailyRecord, Flock } from "@/lib/database.types";
import { cn, today } from "@/lib/utils";

interface SectionDef {
  key: "losses" | "eggs" | "feed" | "weight" | "notes";
  label: string;
  icon: typeof Skull;
  optional: boolean;
}

const ALL_SECTIONS: SectionDef[] = [
  { key: "losses", label: "Losses & sales", icon: Skull, optional: false },
  { key: "eggs", label: "Egg collection", icon: Egg, optional: true },
  { key: "feed", label: "Feed & water", icon: Wheat, optional: true },
  { key: "weight", label: "Weight", icon: Scale, optional: true },
  { key: "notes", label: "Notes", icon: CheckCircle2, optional: true },
];

const PREFS_KEY = "hatch360:record-sections";

function num(form: FormData, key: string): number {
  const raw = String(form.get(key) ?? "").trim();
  const n = Number(raw);
  return raw === "" || Number.isNaN(n) ? 0 : Math.max(0, n);
}

function nullableNum(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : Math.max(0, n);
}

export function RecordForm({
  tenantId,
  flock,
  date,
  existing,
  laysEggs,
  previousWeight = null,
}: {
  tenantId: string;
  flock: Flock;
  date: string;
  existing: DailyRecord | null;
  laysEggs: boolean;
  /** Last recorded average weight before this date, for a drop check. */
  previousWeight?: number | null;
}) {
  const router = useRouter();
  const { submitRecord, online } = useOffline();
  const formRef = useRef<HTMLFormElement>(null);

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ queued: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Everything the entry rules object to, errors first. */
  const [issues, setIssues] = useState<DataIssue[]>([]);
  /**
   * Set once warnings have been shown. A warning is unusual, not impossible,
   * so the second press means "yes, that really is what I measured" — the
   * farm having a bad day is exactly what these records are for.
   */
  const [acknowledged, setAcknowledged] = useState(false);

  // Which optional sections this user wants to see. The defaults come from
  // the bird type; a saved preference overrides them. Read through
  // useStoredJson so the server renders the defaults and the client picks up
  // localStorage without a hydration mismatch.
  const defaults = useMemo<Record<string, boolean>>(
    () => ({
      losses: true,
      eggs: laysEggs,
      feed: true,
      weight: !laysEggs,
      notes: true,
    }),
    [laysEggs],
  );

  const [visible, setVisible] = useStoredJson(PREFS_KEY, defaults);
  const [pickerOpen, setPickerOpen] = useState(false);

  function toggleSection(key: string) {
    setVisible({ ...visible, [key]: !visible[key] });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const mortality = num(form, "mortality");
    const culls = num(form, "culls");
    const birdsSold = num(form, "birds_sold");
    const eggsCollected = visible.eggs ? nullableNum(form, "eggs_collected") : null;
    const eggsBroken = visible.eggs ? nullableNum(form, "eggs_broken") : null;
    const eggsRejected = visible.eggs ? nullableNum(form, "eggs_rejected") : null;
    const feedKg = visible.feed ? nullableNum(form, "feed_consumed_kg") : null;
    const waterLitres = visible.feed ? nullableNum(form, "water_consumed_liters") : null;
    const weightGrams = visible.weight ? nullableNum(form, "avg_weight_grams") : null;

    // The same rules the database enforces, run here so the farmer gets a
    // sentence they can act on instead of a rejection after the fact — and so
    // the merely unusual can be explained rather than refused.
    const found = checkDailyRecord(
      {
        recordDate: date,
        mortality, culls, birdsSold,
        eggsCollected, eggsBroken, eggsRejected,
        feedKg, waterLitres, weightGrams,
      },
      {
        code: flock.code,
        birdType: flock.bird_type,
        placementDate: flock.placement_date,
        placementCount: flock.placement_count,
        currentCount: flock.current_count,
        alreadyRecordedToday: existing
          ? existing.mortality + existing.culls + existing.birds_sold
          : 0,
        previousWeightGrams: previousWeight,
      },
      today(),
    );

    setIssues(found);

    // Impossible data never saves. Unusual data saves on the second press.
    if (hasErrors(found)) {
      setBusy(false);
      setAcknowledged(false);
      return;
    }
    if (found.length > 0 && !acknowledged) {
      setBusy(false);
      setAcknowledged(true);
      return;
    }

    const res = await submitRecord({
      tenantId,
      flockId: flock.id,
      flockCode: flock.code,
      recordDate: date,
      payload: {
        mortality,
        culls,
        birds_sold: birdsSold,
        eggs_collected: eggsCollected,
        eggs_broken: eggsBroken,
        eggs_rejected: eggsRejected,
        feed_consumed_kg: feedKg,
        water_consumed_liters: waterLitres,
        avg_weight_grams: weightGrams,
        notes: String(form.get("notes") ?? "").trim() || null,
      },
    });

    setBusy(false);

    if (!res.ok) {
      setError(res.message);
      return;
    }

    setResult({ queued: res.queued });
    router.refresh();
  }

  /* ------------------------------------------------------ confirmation -- */

  if (result) {
    return (
      <Card className="p-6 text-center">
        <span
          className={cn(
            "mx-auto flex h-12 w-12 items-center justify-center rounded-xl",
            result.queued ? "bg-attention-soft text-attention" : "bg-good-soft text-good",
          )}
        >
          {result.queued ? <CloudOff className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
        </span>

        <h2 className="mt-4 font-display text-lg font-bold text-ink">
          {result.queued ? "Saved on this device" : "Record saved"}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          {result.queued
            ? "You're offline, so we kept this on your phone. It will sync by itself as soon as you have signal — you don't need to do anything."
            : `${flock.code} is recorded for ${date}.`}
        </p>

        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              formRef.current?.reset();
            }}
          >
            Record another flock
          </Button>
          <Button onClick={() => router.push("/app")}>Back to dashboard</Button>
        </div>
      </Card>
    );
  }

  /* ------------------------------------------------------------- form -- */

  const sections = ALL_SECTIONS.filter((s) => !s.optional || visible[s.key]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* What to track — hides the sections this farm does not use. */}
      <div className="relative self-start">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand hover:text-brand"
        >
          Choose what to track
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", pickerOpen && "rotate-180")} />
        </button>

        {pickerOpen && (
          <div className="absolute top-full left-0 z-20 mt-1.5 w-60 rounded-xl border border-line bg-surface p-2 shadow-pop">
            {ALL_SECTIONS.filter((s) => s.optional).map((s) => (
              <label
                key={s.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-surface-sunk"
              >
                <input
                  type="checkbox"
                  checked={!!visible[s.key]}
                  onChange={() => toggleSection(s.key)}
                  className="h-4 w-4 accent-[var(--color-brand)]"
                />
                {s.label}
              </label>
            ))}
            <p className="px-2.5 pt-1.5 pb-1 text-[0.6875rem] leading-snug text-ink-faint">
              Hidden sections are simply not recorded — nothing already saved is
              removed.
            </p>
          </div>
        )}
      </div>

      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <Card key={section.key}>
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3 sm:px-5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-ink">{section.label}</h2>
            </div>

            <div className="px-4 py-4 sm:px-5">
              {section.key === "losses" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberInput
                    label="Deaths"
                    name="mortality"
                    min={0}
                    defaultValue={existing?.mortality ?? ""}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Culled"
                    name="culls"
                    min={0}
                    defaultValue={existing?.culls ?? ""}
                    placeholder="0"
                    hint="Birds removed deliberately"
                  />
                  <NumberInput
                    label="Birds sold"
                    name="birds_sold"
                    min={0}
                    defaultValue={existing?.birds_sold ?? ""}
                    placeholder="0"
                  />
                </div>
              )}

              {section.key === "eggs" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberInput
                    label="Eggs collected"
                    name="eggs_collected"
                    min={0}
                    defaultValue={existing?.eggs_collected ?? ""}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Broken"
                    name="eggs_broken"
                    min={0}
                    defaultValue={existing?.eggs_broken ?? ""}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Rejected"
                    name="eggs_rejected"
                    min={0}
                    defaultValue={existing?.eggs_rejected ?? ""}
                    placeholder="0"
                    hint="Dirty, misshapen or undersized"
                  />
                </div>
              )}

              {section.key === "feed" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    label="Feed used"
                    name="feed_consumed_kg"
                    unit="kg"
                    decimals
                    min={0}
                    defaultValue={existing?.feed_consumed_kg ?? ""}
                    placeholder="0"
                  />
                  <NumberInput
                    label="Water used"
                    name="water_consumed_liters"
                    unit="L"
                    decimals
                    min={0}
                    defaultValue={existing?.water_consumed_liters ?? ""}
                    placeholder="0"
                  />
                </div>
              )}

              {section.key === "weight" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    label="Average bird weight"
                    name="avg_weight_grams"
                    unit="g"
                    decimals
                    min={0}
                    defaultValue={existing?.avg_weight_grams ?? ""}
                    placeholder="0"
                    hint="Weigh a sample and enter the average"
                  />
                </div>
              )}

              {section.key === "notes" && (
                <TextArea
                  label="Anything worth remembering?"
                  name="notes"
                  defaultValue={existing?.notes ?? ""}
                  placeholder="Water pressure low in the morning. Two birds limping in the corner pen."
                />
              )}
            </div>
          </Card>
        );
      })}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          {error}
        </p>
      )}

      {/* Every objection carries its reason. "That is more eggs than birds"
          on its own reads as the form being difficult; the sentence after it
          is what lets someone find the mistake — usually trays entered as
          eggs, or a figure belonging to the other house. */}
      {issues.length > 0 && (
        <div role="alert" className="flex flex-col gap-2">
          {issues.map((issue, i) => {
            const bad = issue.level === "error";
            const Icon = bad ? TriangleAlert : AlertTriangle;
            return (
              <div
                key={`${issue.field ?? "form"}-${i}`}
                className={cn(
                  "flex gap-2.5 rounded-lg border px-3 py-2.5",
                  bad
                    ? "border-critical/25 bg-critical-soft"
                    : "border-attention/30 bg-attention-soft",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    bad ? "text-critical" : "text-attention",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      bad ? "text-critical" : "text-attention",
                    )}
                  >
                    {issue.message}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{issue.why}</p>
                </div>
              </div>
            );
          })}

          {!hasErrors(issues) && acknowledged && (
            <p className="text-xs leading-relaxed text-ink-soft">
              Nothing here is impossible, so you can save it as it is — press
              the button again. If the farm really had a day like this, the
              record should say so.
            </p>
          )}
        </div>
      )}

      <div className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-xl border border-line bg-surface/95 p-3 shadow-raised backdrop-blur-sm md:bottom-4 md:flex-row md:items-center md:justify-between">
        <p className="text-xs text-ink-faint">
          {existing
            ? "This updates the record already saved for this day."
            : online
              ? "Saves straight away."
              : "You're offline — this will be kept on your phone and synced later."}
        </p>
        <Button type="submit" size="lg" busy={busy} className="w-full md:w-auto">
          {busy
            ? "Saving"
            : !hasErrors(issues) && acknowledged && issues.length > 0
              ? "Save it anyway"
              : existing
                ? "Update record"
                : "Save record"}
        </Button>
      </div>
    </form>
  );
}
