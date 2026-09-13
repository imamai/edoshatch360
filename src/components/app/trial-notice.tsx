import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import { FEATURE_LABEL, PLAN_LABEL, effectivePlan, featuresLost } from "@/lib/plans";
import type { TenantPlan } from "@/lib/data/plan";
import { cn, formatDate } from "@/lib/utils";

/**
 * What happens when the trial ends, said before it ends.
 *
 * A trial grants the Professional feature set whatever the farm is actually
 * billed for. That is right — a trial should show the product — but it means
 * the last day of the trial silently removes things the farmer has been using
 * all month. Without this bar the first they learn of it is a page that used
 * to work and now does not.
 *
 * So the bar names three things: how long is left, which plan they land on,
 * and exactly what stops working. It sharpens as the date approaches rather
 * than shouting from day one.
 */
export function TrialNotice({ plan }: { plan: TenantPlan }) {
  if (plan.status !== "trialing" || !plan.trialEndsAt || !plan.billedCode) return null;

  const ends = new Date(plan.trialEndsAt);
  const days = Math.ceil((ends.getTime() - Date.now()) / 86_400_000);

  // The plan they land on is whatever the subscription says once it is no
  // longer trialing — asked of the same function that decides entitlement, so
  // this cannot describe a different outcome than the one that happens.
  const after = effectivePlan(plan.billedCode, "active");
  const losing = featuresLost(plan.code, after);

  const urgent = days <= 3;
  const soon = days <= 7;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b px-4 py-2.5 text-sm sm:px-6 print:hidden",
        urgent
          ? "border-critical/25 bg-critical-soft text-critical"
          : soon
            ? "border-attention/30 bg-attention-soft text-ink"
            : "border-line bg-brand-soft text-ink",
      )}
    >
      {urgent ? (
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden="true" />
      )}

      <p className="min-w-0">
        <strong className="font-semibold">
          {days <= 0
            ? "Your trial has ended."
            : `${days} day${days === 1 ? "" : "s"} left in your trial.`}
        </strong>{" "}
        <span className={urgent ? undefined : "text-ink-soft"}>
          On {formatDate(plan.trialEndsAt, "long")} this farm moves to{" "}
          {after ? PLAN_LABEL[after] : "Starter"}
          {losing.length > 0 && (
            <>
              {" "}and loses{" "}
              {losing.slice(0, 3).map((f) => FEATURE_LABEL[f].toLowerCase()).join(", ")}
              {losing.length > 3 && ` and ${losing.length - 3} more`}
            </>
          )}
          .
        </span>
      </p>

      <Link
        href="/pricing"
        className="ml-auto shrink-0 rounded-md bg-brand px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-dark"
      >
        See plans
      </Link>
    </div>
  );
}
