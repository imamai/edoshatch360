"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
    const supabase = createClient();

    // The link comes back through the existing /auth/callback route, which
    // exchanges the code for a session and then forwards to `next`. That
    // session is what allows the new password to be set on the next screen.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setBusy(false);

    // Rate limiting is worth passing on — it tells someone to wait rather than
    // to keep pressing a button that appears to work. Everything else reports
    // success either way: naming an address that has no account would let
    // anyone with this page check who farms with us.
    if (err && err.status === 429) {
      setError("Too many requests. Please wait a few minutes and try again.");
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
