"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SelectInput, TextArea, TextInput } from "@/components/ui/field";

type State = "idle" | "sending" | "sent" | "error";

const FARM_SIZES = [
  "Under 500 birds",
  "500 – 2,000 birds",
  "2,000 – 10,000 birds",
  "Over 10,000 birds",
  "Several farms",
  "Not farming yet",
];

export function ContactForm() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setError(null);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { error: err } = await supabase.from("edoshatch360_contact_messages").insert({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim() || null,
      farm_size: String(form.get("farm_size") ?? "") || null,
      county: String(form.get("county") ?? "").trim() || null,
      message: String(form.get("message") ?? "").trim(),
    });

    if (err) {
      // The unique dedupe index fires when the same address submits twice
      // inside a minute — that is a duplicate, not a failure.
      if (err.code === "23505") {
        setState("sent");
        return;
      }
      setState("error");
      setError(
        "We could not send that just now. Check your connection and try again, or email us directly at info@edoscentre.co.ke.",
      );
      return;
    }

    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-good/25 bg-good-soft p-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-good" />
        <h3 className="font-display text-lg font-bold text-ink">Message received</h3>
        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
          Thank you — we have your message and will reply to the address you gave us,
          usually within one working day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Your name" name="name" required autoComplete="name" maxLength={120} />
        <TextInput label="Email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="07xx xxx xxx"
          hint="Optional — if you would rather we call"
        />
        <TextInput label="County" name="county" placeholder="e.g. Kiambu" hint="Optional" />
      </div>

      <SelectInput label="How big is your operation?" name="farm_size" defaultValue="">
        <option value="">Prefer not to say</option>
        {FARM_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </SelectInput>

      <TextArea
        label="What would you like to ask us?"
        name="message"
        required
        rows={5}
        minLength={5}
        maxLength={4000}
        placeholder="Tell us what you farm and what is hardest to keep track of right now."
      />

      {error && (
        <p role="alert" className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" busy={state === "sending"} className="self-start">
        {state !== "sending" && <Send className="h-4 w-4" />}
        {state === "sending" ? "Sending" : "Send message"}
      </Button>
    </form>
  );
}
