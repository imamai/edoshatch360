"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SelectInput, TextInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/** The 47 counties, so "where" is a pick rather than a free-text guess. */
const COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
  "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa",
  "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

const MODES = [
  {
    value: "simple" as const,
    title: "Keep it simple",
    body: "Birds, eggs, feed, sales, expenses, profit. Advanced tools stay hidden until you want them.",
  },
  {
    value: "advanced" as const,
    title: "Give me everything",
    body: "Feed conversion, production curves, benchmarking, multi-house comparison and full reports from day one.",
  },
];

export function OnboardingForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDemo() {
    setDemoBusy(true);
    setError(null);

    const { error: err } = await createClient().rpc("edoshatch360_join_demo");

    if (err) {
      setDemoBusy(false);
      setError("The demo farm isn't available right now. Create your own farm instead.");
      return;
    }

    router.push("/app");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    // One RPC provisions the organisation, the owner membership, the first
    // farm, a starter product list and a trial subscription atomically —
    // a half-created account is not a state this app can end up in.
    const { error: err } = await supabase.rpc("edoshatch360_create_tenant", {
      p_name: String(form.get("name") ?? "").trim(),
      p_farm_name: String(form.get("farm_name") ?? "").trim() || null,
      p_county: String(form.get("county") ?? "") || null,
      p_mode: mode,
    });

    if (err) {
      setBusy(false);
      setError(
        err.message.includes("organisation name")
          ? "Please give your farm or business a name."
          : "We could not finish setting up your farm. Check your connection and try again.",
      );
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <TextInput
        label="Farm or business name"
        name="name"
        required
        autoFocus
        placeholder="e.g. Sunrise Poultry"
        hint="This is what appears on your invoices and receipts."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Name this first farm"
          name="farm_name"
          placeholder="e.g. Home farm"
          hint="Optional"
        />
        <SelectInput label="County" name="county" defaultValue="">
          <option value="">Select a county</option>
          {COUNTIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">
          How much do you want to see to start with?
        </legend>
        {MODES.map((m) => (
          <label
            key={m.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              mode === m.value
                ? "border-brand bg-brand-tint ring-1 ring-brand/20"
                : "border-line hover:border-line-strong",
            )}
          >
            <input
              type="radio"
              name="mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">{m.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                {m.body}
              </span>
            </span>
          </label>
        ))}
        <p className="mt-1 text-xs text-ink-faint">
          You can switch this at any time in Settings.
        </p>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" busy={busy}>
        {!busy && <ArrowRight className="h-4 w-4" />}
        {busy ? "Setting up your farm" : "Create my farm"}
      </Button>

      <div className="border-t border-line pt-4">
        <p className="text-sm font-medium text-ink">Want to look around first?</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Open Sunrise Poultry — a demonstration farm with three flocks, ninety days of
          records, real production curves and its own sales history. You get read-only
          access, and can still create your own farm afterwards.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={openDemo}
          busy={demoBusy}
          className="mt-3"
        >
          {!demoBusy && <Eye className="h-4 w-4" />}
          {demoBusy ? "Opening" : "Explore the demo farm"}
        </Button>
      </div>
    </form>
  );
}
