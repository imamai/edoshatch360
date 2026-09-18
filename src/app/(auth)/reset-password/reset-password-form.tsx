"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const MIN_LENGTH = 10;

export function ResetPasswordForm() {
  const router = useRouter();
  // Undefined until we know: the emailed link is what creates the session, and
  // landing here without one means it expired or was never followed.
  const [hasSession, setHasSession] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    if (password.length < MIN_LENGTH) {
      setError(`Your new password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }

    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password });

    if (err) {
      setBusy(false);
      setError(
        err.message.toLowerCase().includes("different")
          ? "Choose a password you haven't used here before."
          : err.message,
      );
      return;
    }

    // Already signed in by the link, so straight into the app.
    router.push("/app");
    router.refresh();
  }

  if (hasSession === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6 text-brand" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col gap-4">
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          This link has expired or has already been used.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
          Send me a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PasswordInput
        label="New password"
        name="password"
        required
        autoFocus
        autoComplete="new-password"
        hint={`At least ${MIN_LENGTH} characters.`}
      />
      <PasswordInput
        label="Confirm new password"
        name="confirmPassword"
        required
        autoComplete="new-password"
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
        {busy ? "Saving" : "Set new password"}
      </Button>
    </form>
  );
}
