"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { signUpWithEmail } from "./actions";
import { Button } from "@/components/ui/button";
import { PasswordInput, TextInput } from "@/components/ui/field";

export function SignupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("full_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();

    if (password.length < 8) {
      setError("Please use at least 8 characters for your password.");
      return;
    }

    setBusy(true);

    // Sent by the app rather than by Supabase, so a farmer's first message
    // from us carries our name and does not look like phishing. See ./actions.ts.
    const result = await signUpWithEmail({ email, password, fullName, phone });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmSent(email);
    return;

  }

  if (confirmSent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft p-7 text-center">
        <MailCheck className="h-8 w-8 text-brand" />
        <h2 className="font-display text-lg font-bold text-ink">Check your email</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          We sent a confirmation link to <strong className="text-ink">{confirmSent}</strong>.
          Open it and you will land straight in your new farm.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextInput
        label="Your name"
        name="full_name"
        required
        autoComplete="name"
        autoFocus
        placeholder="Jane Wanjiru"
      />
      <TextInput
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
      />
      <TextInput
        label="Phone"
        name="phone"
        type="tel"
        autoComplete="tel"
        placeholder="07xx xxx xxx"
        hint="Optional — used for M-Pesa and SMS alerts later"
      />
      <PasswordInput
        label="Password"
        name="password"
        required
        autoComplete="new-password"
        minLength={8}
        hint="At least 8 characters"
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
        {busy ? "Creating your account" : "Create free account"}
      </Button>

      <p className="text-xs leading-relaxed text-ink-faint">
        By creating an account you agree that your farm records are yours — we store
        them for you, isolated from every other organisation, and you can export them
        at any time.
      </p>
    </form>
  );
}
