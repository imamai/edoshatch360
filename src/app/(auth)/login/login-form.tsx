"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput, TextInput } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  // /auth/callback sends people back here when a link has been used already or
  // has expired. Without this it looked like nothing had happened at all.
  const linkExpired = params.get("error") === "link_expired";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();

    const { error: err } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    if (err) {
      setBusy(false);
      // Supabase returns the same message for a wrong password and an unknown
      // address, which is correct — confirming which one exists would leak it.
      setError(
        err.message === "Invalid login credentials"
          ? "That email and password don't match an account."
          : err.message === "Email not confirmed"
            ? "Please confirm your email address first — check your inbox for the link."
            : "We couldn't sign you in. Check your connection and try again.",
      );
      return;
    }

    router.push(next);
    router.refresh();
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
      />
      <PasswordInput
        label="Password"
        name="password"
        required
        autoComplete="current-password"
      />

      {linkExpired && !error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          That link has expired or has already been used. Ask for a new one below.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          {error}
        </p>
      )}

      <Button type="submit" size="lg" busy={busy}>
        {busy ? "Signing in" : "Sign in"}
      </Button>

      <Link
        href="/forgot-password"
        className="text-center text-sm text-ink-soft hover:text-brand hover:underline"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
