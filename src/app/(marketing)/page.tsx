import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  ArrowRight, BarChart3, Bird, Boxes, CloudOff, Coins, Egg,
  HeartPulse, Quote, Shield, Smartphone, Users, Wheat,
} from "lucide-react";

import { Hero } from "@/components/marketing/hero";
import { FeatureBlock, SectionHeading } from "@/components/marketing/sections";
import { LaptopFrame, PhoneFrame } from "@/components/marketing/device-frames";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FaqList } from "@/components/marketing/faq-list";
import { getFaqs, getPlans, getTestimonials } from "@/lib/data/cms";

export const metadata: Metadata = {
  title: "Poultry farm management software for Kenya",
  description:
    "EDOS Hatch360 is poultry farm management software for Kenyan farms: flocks, egg production, bird health, feed, inventory, sales and profit in one mobile-first platform that works offline.",
  alternates: { canonical: "/" },
};

// Revalidate hourly: the marketing copy is CMS-driven, so a content edit
// appears within the hour without a redeploy.
export const revalidate = 3600;

const TRUST = [
  { icon: Smartphone, label: "Mobile first", note: "Built for the phone in your pocket" },
  { icon: CloudOff, label: "Works offline", note: "Record now, sync when signal returns" },
  { icon: Users, label: "Multi-farm", note: "One farm or twenty, one account" },
  { icon: Shield, label: "Your data stays yours", note: "Isolated per farm at the database" },
];

const KNOW = [
  {
    icon: Bird,
    title: "Know your flock",
    lines: ["Total birds", "Active batches", "Age & breed", "Mortality", "Average weight"],
  },
  {
    icon: Egg,
    title: "Know your production",
    lines: ["Eggs collected", "Production rate", "Daily trend", "By house", "By flock"],
  },
  {
    icon: Wheat,
    title: "Know your costs",
    lines: ["Feed", "Medication", "Labour", "Utilities", "Everything else"],
  },
  {
    icon: Coins,
    title: "Know your profit",
    lines: ["Revenue", "− Expenses", "= Profit", "Margin %", "Profit per bird"],
  },
];

export default async function LandingPage() {
  const [plans, faqs, testimonials] = await Promise.all([
    getPlans(),
    getFaqs(),
    getTestimonials(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "EDOS Centre",
        url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        email: "info@edoscentre.co.ke",
        areaServed: "KE",
      },
      {
        "@type": "SoftwareApplication",
        name: "EDOS Hatch360",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Android, iOS",
        description:
          "Poultry farm management platform covering flocks, egg production, bird health, feed, inventory, sales and profitability.",
        offers: plans
          .filter((p) => p.code !== "enterprise")
          .map((p) => ({
            "@type": "Offer",
            name: p.name,
            price: (p.price_cents / 100).toFixed(2),
            priceCurrency: p.currency,
          })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs.slice(0, 8).map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Hero />

      {/* ---------------------------------------------------- trust bar -- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <p className="text-center text-sm font-medium text-ink-soft">
            Built for the realities of modern poultry farming.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, label, note }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-ink-faint">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ product preview -- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading
          eyebrow="What you get"
          title="Four questions, answered every single day"
          lead="Most farm software tells you what you entered. Hatch360 tells you what it means — and what needs your attention this morning."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KNOW.map(({ icon: Icon, title, lines }) => (
            <div
              key={title}
              className="mk-lift rounded-xl border border-line bg-surface p-5 shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-ink">{title}</h3>
              <ul className="mt-3 flex flex-col gap-1.5">
                {lines.map((l) => (
                  <li key={l} className="text-sm text-ink-soft">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------- real screenshots -- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="The actual product"
            title="This is the software, not an illustration"
            lead="Real screens from a working farm. The owner sees the whole operation; the person in the house sees the round they have to do."
          />

          <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-12">
            <LaptopFrame
              src="/images/app/desk-dashboard.png"
              alt="The EDOS Hatch360 dashboard on a laptop, showing bird count, active flocks, eggs today, mortality, feed, revenue, expenses and profit alongside an egg production chart and the Farm Health Score"
            />

            <div className="grid grid-cols-2 gap-6">
              <PhoneFrame
                src="/images/app/phone-record.png"
                alt="The daily recording screen on a phone, with large numeric fields for deaths, culls and birds sold"
              />
              <PhoneFrame
                src="/images/app/phone-production.png"
                alt="The production screen on a phone showing hen-day production, saleable eggs and the collection trend"
              />
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-ink-soft">
            Every new account opens with this demonstration farm, so you can see what
            filled-in looks like before you record anything of your own.{" "}
            <Link href="/features" className="font-medium text-brand hover:underline">
              See more screens
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- farm health -- */}
      <section className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-20">
          <div>
            <SectionHeading
              align="left"
              tone="dark"
              eyebrow="Farm Health Score"
              title="One number that tells you whether today is fine"
              lead="Hatch360 reads your mortality, egg production, feed conversion, vaccination compliance and disease reports, then scores the farm out of 100. Not a gimmick — every component shows the figure behind it and the target it is measured against."
            />
            <Link
              href="/features#health"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-white"
            >
              How the score is calculated
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mk-glass rounded-2xl p-6">
            <div className="flex items-center gap-5">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="9" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" stroke="#e0a53c" strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - 0.92)}`}
                  />
                </svg>
                <span className="font-display text-2xl font-extrabold text-white tnum">92</span>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-gold uppercase">
                  Excellent
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Sunrise Poultry · 3 houses · 7,450 birds
                </p>
              </div>
            </div>

            <dl className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5">
              {[
                ["Mortality", "3.1%", "target 5%", 94],
                ["Egg production", "87.4%", "target 85%", 100],
                ["Feed conversion", "1.72", "target 1.80", 100],
                ["Vaccination compliance", "86%", "target 100%", 86],
              ].map(([label, value, target, pct]) => (
                <div key={label as string} className="flex items-center gap-3">
                  <dt className="w-44 shrink-0 text-xs text-white/65">{label}</dt>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gold"
                      style={{ width: `${pct as number}%` }}
                    />
                  </div>
                  <dd className="w-24 shrink-0 text-right text-xs text-white tnum">
                    {value}{" "}
                    <span className="text-white/40">{target}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- capabilities -- */}
      <section className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 lg:gap-24 lg:py-24">
        <FeatureBlock
          id="flocks"
          eyebrow="Flock management"
          title="Every batch, from placement to harvest"
          body="Each flock carries its own record: breed, placement count, age in days, live birds, mortality, average weight, feed consumed and the harvest date you are working towards."
          points={[
            "Broilers, layers, kienyeji, improved kienyeji, breeders, chicks, pullets and turkey",
            "Bird count that corrects itself from your daily records — never edited by hand",
            "Performance measured against the standard for that bird type and age",
            "A timeline from placement through brooding, vaccination, growth and finishing",
          ]}
          image="/images/marketing/farm/brooder.jpg"
          alt="Day-old chicks spread across newspaper bedding inside a brooder ring"
        />

        <FeatureBlock
          id="production"
          eyebrow="Production intelligence"
          title="Know the drop the week it starts, not the month after"
          body="Record collection in seconds and Hatch360 does the arithmetic: hen-day production, saleable eggs after breakages and rejects, and the trend across days, houses and flocks."
          points={[
            "Morning and afternoon collection, broken and rejected eggs",
            "Hen-day and hen-house production calculated for you",
            "Compare house against house, and this batch against your last",
            "Alerts when production falls faster than it should",
          ]}
          image="/images/marketing/eggs-trays.jpg"
          alt="A farmer's hand lifting a brown egg from stacked collection trays"
          flip
        />

        <FeatureBlock
          id="feed"
          eyebrow="Feed & inventory"
          title="Feed is most of your cost. Treat it that way."
          body="Track feed, vaccines, medication, equipment and packaging as real stock with opening balances, purchases, usage, wastage and a closing figure that always reconciles."
          points={[
            "Stock level maintained from transactions, never typed over",
            "Reorder alerts before you run out, not after",
            "Days of feed remaining, from your own consumption rate",
            "Cost per bird and cost per batch that include what you actually fed",
          ]}
          image="/images/marketing/farm/pullets-feeders.jpg"
          alt="Pullets gathered around hanging feeders and drinkers on deep litter"
        />

        <FeatureBlock
          id="health"
          eyebrow="Health management"
          title="Vaccinations that remind you, not the other way round"
          body="Build the vaccination programme once per flock and Hatch360 tracks what is due, what was given, and what is overdue — alongside disease incidents, treatments and withdrawal periods."
          points={[
            "Vaccination schedule by day of age, with reminders",
            "Medication records that calculate the withdrawal date for you",
            "Disease incidents with symptoms, treatment and severity",
            "A health timeline per flock any vet can read at a glance",
          ]}
          image="/images/marketing/farm/pullets-close.jpg"
          alt="Brown pullets in close-up on deep litter, alert and in good condition"
          flip
        />

        <FeatureBlock
          id="kienyeji"
          eyebrow="Kienyeji & small farms"
          title="Simple enough for 200 birds. Serious enough for 20,000."
          body="New accounts open in Simple mode: birds, eggs, feed, sales, expenses, profit. Feed conversion, production curves and benchmarking stay out of the way until you ask for them."
          points={[
            "Six numbers and five buttons on the small-farmer dashboard",
            "Advanced tools switch on when you are ready for them",
            "Kienyeji and improved kienyeji flows that do not assume a commercial shed",
            "English and Kiswahili",
          ]}
          image="/images/marketing/kienyeji.jpg"
          alt="Free-range indigenous chickens foraging on open ground"
        />
      </section>

      {/* ----------------------------------------------- multi-farm + offline -- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="At scale"
            title="One farm, or a network of them"
            lead="Managers see only the farms assigned to them. Owners see everything, side by side."
          />

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-xl border border-line bg-canvas p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <BarChart3 className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-ink">
                Compare farms honestly
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Birds, eggs, mortality and profit for every farm in one table you can
                sort. The one at the bottom is the conversation worth having.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Users className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-ink">
                Roles that actually restrict
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                A worker records and sees tasks. A manager runs assigned farms. Only
                owners and accountants see money. Enforced in the database, not the
                interface.
              </p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Boxes className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-base font-bold text-ink">
                Reports people will read
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Production, financial, health and inventory reports that export to
                PDF, Excel or CSV — for your bank, your vet or your own records.
              </p>
            </div>
          </div>

          <div className="mt-10 grid items-center gap-8 rounded-2xl border border-line bg-canvas p-6 lg:grid-cols-[1.2fr_1fr] lg:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-attention-soft px-3 py-1 text-xs font-semibold text-attention">
                <CloudOff className="h-3.5 w-3.5" />
                No signal? No problem.
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-ink sm:text-2xl">
                Your records do not depend on the network
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                Entries save to your phone first and sync the moment signal returns.
                Each record shows whether it is synced, pending or failed — so nothing
                is ever quietly lost because the connection dropped in the middle of a
                collection round.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-good/25 bg-good-soft px-2.5 py-1 text-xs font-medium text-good">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> Synced
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-attention/25 bg-attention-soft px-2.5 py-1 text-xs font-medium text-attention">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> Pending sync
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-critical/25 bg-critical-soft px-2.5 py-1 text-xs font-medium text-critical">
                  <span className="h-1.5 w-1.5 rounded-full bg-current" /> Needs attention
                </span>
              </div>
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line">
              <Image
                src="/images/marketing/eggs-carton.jpg"
                alt="Brown eggs arranged in a moulded cardboard carton"
                fill
                sizes="(max-width: 1024px) 100vw, 380px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- testimonials -- */}
      {testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="From the farm"
            title="What changes when you can actually see the numbers"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {testimonials.map((t) => (
              <figure
                key={t.id}
                className="flex flex-col rounded-xl border border-line bg-surface p-6 shadow-card"
              >
                <Quote className="h-6 w-6 text-brand/30" aria-hidden="true" />
                <blockquote className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-ink">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-4 border-t border-line pt-4 text-sm">
                  <span className="font-semibold text-ink">{t.name}</span>
                  <span className="text-ink-faint">
                    {t.role ? ` · ${t.role}` : ""}
                    {t.location ? ` · ${t.location}` : ""}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ pricing -- */}
      <section id="pricing" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="Pricing"
            title="Start free. Pay when the farm grows."
            lead="Every plan includes offline recording, the mobile app and your full data export. Pay by M-Pesa."
          />
          <div className="mt-10">
            <PricingTable plans={plans} />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- FAQ -- */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeading eyebrow="Questions" title="Things farmers ask us first" />
        <div className="mt-8">
          <FaqList faqs={faqs} />
        </div>
      </section>

      {/* ---------------------------------------------------------- CTA -- */}
      <section className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <HeartPulse className="mx-auto h-8 w-8 text-gold" aria-hidden="true" />
          <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Every bird. Every batch. Every farm.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Know what is happening on your farm, what needs attention, what you are
            spending, what you are producing — and whether you are actually making
            money.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gold px-6 text-[0.9375rem] font-semibold text-brand-darker transition-transform hover:-translate-y-0.5 hover:bg-white"
            >
              Create your free account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/25 px-6 text-[0.9375rem] font-medium text-white transition-colors hover:bg-white/10"
            >
              Talk to our team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
