import { Lock } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PLAN_LABEL, type PlanCode } from "@/lib/plans";

/**
 * Shown where a screen exists but the organisation's plan does not carry it.
 *
 * Deliberately not a 404. The farmer did not mistype a URL — the feature is
 * real, it is simply not theirs yet, and saying so plainly is both more honest
 * and the only version that can lead anywhere. It names the plan that carries
 * it rather than saying "upgrade", because "upgrade to what, for how much" is
 * the actual question.
 */
export function UpgradeNotice({
  what,
  from,
  detail,
}: {
  /** The capability in the farmer's words: "Invoices and receipts". */
  what: string;
  from: PlanCode;
  detail?: string;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardBody className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-soft text-gold-dark">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>

        <h1 className="font-display text-lg font-bold text-ink">
          {what} comes with {PLAN_LABEL[from]}
        </h1>

        <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
          {detail ??
            `Your farm is on a plan that does not include this yet. Everything you have already recorded stays exactly where it is.`}
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <ButtonLink href="/app/settings?tab=billing" size="sm">
            See plans
          </ButtonLink>
          <ButtonLink href="/app" size="sm" variant="secondary">
            Back to the dashboard
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}
