import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { SectionHeading } from "@/components/marketing/sections";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FaqList } from "@/components/marketing/faq-list";
import { getFaqs, getPlans } from "@/lib/data/cms";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "EDOS Hatch360 pricing for Kenyan poultry farms. Start free on the Starter plan; pay by M-Pesa as your farm grows. No card required.",
  alternates: { canonical: "/pricing" },
};

export const revalidate = 3600;

/** Rows in the comparison table, read from each plan's own limit columns. */
const LIMITS = [
  { key: "max_farms", label: "Farms" },
  { key: "max_houses", label: "Poultry houses" },
  { key: "max_birds", label: "Birds" },
  { key: "max_users", label: "Team members" },
] as const;

export default async function PricingPage() {
  const [plans, faqs] = await Promise.all([getPlans(), getFaqs()]);

  // Every distinct feature across all plans, in the order the plans list them,
  // so the comparison grid is built from the data rather than a second copy.
  const allFeatures: string[] = [];
  for (const p of plans) {
    for (const f of p.features) if (!allFeatures.includes(f)) allFeatures.push(f);
  }

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-16">
          <SectionHeading
            eyebrow="Pricing"
            title="Start free. Pay when the farm grows."
            lead="Every plan includes offline recording, the mobile app, role-based access and your full data export. Pay by M-Pesa, change plan any time."
          />
          <div className="mt-10">
            <PricingTable plans={plans} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- comparison -- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <SectionHeading
          eyebrow="Side by side"
          title="What is in each plan"
          align="left"
        />

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <caption className="sr-only">
              Feature and limit comparison across EDOS Hatch360 plans
            </caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th scope="col" className="w-64 py-3 text-left font-semibold text-ink">
                  Plan
                </th>
                {plans.map((p) => (
                  <th key={p.id} scope="col" className="px-3 py-3 text-center font-semibold text-ink">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMITS.map((limit) => (
                <tr key={limit.key} className="border-b border-line">
                  <th scope="row" className="py-3 text-left font-medium text-ink-soft">
                    {limit.label}
                  </th>
                  {plans.map((p) => {
                    const v = p[limit.key];
                    return (
                      <td key={p.id} className="px-3 py-3 text-center text-ink tnum">
                        {v === null ? "Unlimited" : formatNumber(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {allFeatures.map((feature) => (
                <tr key={feature} className="border-b border-line">
                  <th scope="row" className="py-3 pr-4 text-left font-normal text-ink-soft">
                    {feature}
                  </th>
                  {plans.map((p) => (
                    <td key={p.id} className="px-3 py-3 text-center">
                      {p.features.includes(feature) ? (
                        <>
                          <Check className="mx-auto h-4 w-4 text-good" aria-hidden="true" />
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <>
                          <Minus className="mx-auto h-4 w-4 text-ink-faint/50" aria-hidden="true" />
                          <span className="sr-only">Not included</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          Higher plans include everything in the plan below them. Enterprise pricing
          depends on the size of your operation —{" "}
          <Link href="/contact" className="text-brand hover:underline">
            tell us what you run
          </Link>
          .
        </p>
      </section>

      <section id="faq" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <SectionHeading eyebrow="Questions" title="Before you decide" />
          <div className="mt-8">
            <FaqList faqs={faqs} />
          </div>
        </div>
      </section>
    </>
  );
}
