"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "./actions";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();

    // Sent by the app itself rather than by Supabase, so the message comes
    // from Hatch360 and the link is one the callback can actually read. See
    // ./actions.ts.
    const result = await requestPasswordReset(email);
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-good/25 bg-good-soft p-7 text-center">
          <CheckCircle2 className="h-8 w-8 text-good" />
          <h2 className="font-display text-lg font-bold text-ink">Check your email</h2>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            If that address has an account, a link to set a new password is on its way.
            It can be used once and expires shortly, so open it when it arrives.
          </p>
        </div>
        <p className="text-sm text-ink-soft">
          Nothing after a few minutes? Check your spam folder, then{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-medium text-brand hover:underline"
          >
            try a different address
          </button>
          .
        </p>
        <Link href="/login" className="text-sm font-medium text-brand hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextInput
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        placeholder="you@example.com"
        hint="The address you signed up with."
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" busy={busy}>
        {busy ? "Sending" : "Email me a link"}
      </Button>

      <Link href="/login" className="text-center text-sm text-ink-soft hover:text-brand">
        ← Back to sign in
      </Link>
    </form>
  );
}
