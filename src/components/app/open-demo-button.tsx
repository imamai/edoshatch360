"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Joins the shared demonstration farm as a read-only viewer.
 *
 * Also reachable from onboarding, but it belongs here too: someone who
 * created their own farm first lands on an empty dashboard with no way to see
 * what a populated one looks like. Their own organisation is untouched — the
 * demo is simply added alongside it, switchable from the top bar.
 */
export function OpenDemoButton({
  variant = "secondary",
}: {
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);

    const { error: err } = await createClient().rpc("edoshatch360_join_demo");

    if (err) {
      setBusy(false);
      setError("The demo farm isn't available right now.");
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant={variant} onClick={open} busy={busy} size="sm">
        {!busy && <Eye className="h-4 w-4" />}
        {busy ? "Opening" : "Explore the demo farm"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
