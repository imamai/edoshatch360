"use client";

import { useActionState } from "react";

import { acceptInvite, type AcceptState } from "./actions";
import { Button } from "@/components/ui/button";

const START: AcceptState = { error: null };

export function AcceptForm({ token, farm }: { token: string; farm: string }) {
  const [state, submit, pending] = useActionState(acceptInvite, START);

  return (
    <form action={submit} className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Joining…" : `Join ${farm}`}
      </Button>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-critical/25 bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
