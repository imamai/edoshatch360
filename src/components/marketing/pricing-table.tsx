import Link from "next/link";
import { Check } from "lucide-react";
import type { Plan } from "@/lib/database.types";
import { cn, formatNumber } from "@/lib/utils";

function priceLabel(plan: Plan) {
  if (plan.code === "enterprise") return "Let's talk";
  if (plan.price_cents === 0) return "Free";
  return `${plan.currency} ${formatNumber(plan.price_cents / 100)}`;
}

function limitLine(plan: Plan) {
  const birds = plan.max_birds ? `${formatNumber(plan.max_birds)} birds` : "Unlimited birds";
  const farms = plan.max_farms
    ? `${plan.max_farms} farm${plan.max_farms > 1 ? "s" : ""}`
    : "Unlimited farms";
  return `${farms} · ${birds}`;
}

export function PricingTable({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-4">
      {plans.map((plan) => {
        const featured = plan.is_popular;
        return (
          <div
            key={plan.id}
            className={cn(
              "flex flex-col rounded-2xl border bg-surface p-6",
              featured
                ? "border-brand shadow-raised ring-1 ring-brand/20"
                : "border-line shadow-card",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-ink">{plan.name}</h3>
              {featured && (
                <span className="rounded-full bg-brand px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wide text-white uppercase">
                  Most chosen
                </span>
              )}
            </div>
            {plan.tagline && (
              <p className="mt-1 text-sm text-ink-faint">{plan.tagline}</p>
            )}

            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-extrabold tracking-tight text-ink tnum">
                {priceLabel(plan)}
              </span>
              {plan.price_cents > 0 && (
                <span className="text-sm text-ink-faint">/{plan.billing_period}</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">{limitLine(plan)}</p>

            <Link
              href={plan.code === "enterprise" ? "/contact" : "/signup"}
              className={cn(
                "mt-5 inline-flex h-11 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                featured
                  ? "bg-brand text-white hover:bg-brand-dark"
                  : "border border-line-strong text-ink hover:border-brand hover:text-brand",
              )}
            >
              {plan.code === "enterprise"
                ? "Talk to us"
                : plan.price_cents === 0
                  ? "Start free"
                  : "Choose " + plan.name}
            </Link>

            <ul className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
