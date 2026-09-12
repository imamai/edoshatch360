import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BarChart3, Bell, Bird, Boxes, ClipboardList, CloudOff, Coins,
  Egg, FileText, HeartPulse, Languages, MapPin, Receipt, ShieldCheck,
  Smartphone, Sparkles, Syringe, Users, Wheat,
} from "lucide-react";

import { FeatureBlock, SectionHeading } from "@/components/marketing/sections";
import { LaptopFrame, PhoneFrame } from "@/components/marketing/device-frames";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Flock management, egg production, bird health, feed and inventory, sales, customers, finance, tasks, reports and analytics — everything EDOS Hatch360 does for a poultry farm.",
  alternates: { canonical: "/features" },
};

const MODULES = [
  { icon: Bird, title: "Flocks & batches", body: "Placement, age, breed, live count, mortality and weight for every batch you run." },
  { icon: Egg, title: "Egg production", body: "Morning and afternoon collection, breakages, rejects, hen-day production and trends." },
  { icon: Wheat, title: "Feed management", body: "Stock, consumption, wastage, days remaining and reorder alerts on your biggest cost." },
  { icon: Syringe, title: "Vaccination & health", body: "Schedules by day of age, treatment records, withdrawal periods and disease incidents." },
  { icon: Boxes, title: "Inventory", body: "Feed, vaccines, medication, equipment and packaging with a reconciling stock ledger." },
  { icon: Receipt, title: "Sales & invoicing", body: "Quotations, invoices, receipts, part-payments and who still owes you money." },
  { icon: Users, title: "Customers", body: "Wholesalers, hotels, schools and individuals with purchase history and balances." },
  { icon: Coins, title: "Finance", body: "Revenue and expenses by category, profit, margin and profit per bird." },
  { icon: ClipboardList, title: "Tasks", body: "Assign vaccination, cleaning, weighing and purchases with due dates and photos." },
  { icon: Sparkles, title: "Farm assistant", body: "Ask about your birds, feed or money in plain words and get an answer worked out from your records." },
  { icon: Bell, title: "Smart alerts", body: "High mortality, low feed stock, vaccination due, production drop — prioritised, not spammed." },
  { icon: BarChart3, title: "Analytics", body: "Production, mortality, weight, FCR, revenue and profit trends with period comparison." },
  { icon: FileText, title: "Reports", body: "Production, financial, health, inventory and management reports as PDF, Excel or CSV." },
  { icon: MapPin, title: "Multi-farm", body: "Several farms under one account, with managers restricted to their own." },
  { icon: ShieldCheck, title: "Roles & audit", body: "Eight roles, database-level isolation, and a log of who changed what and when." },
  { icon: CloudOff, title: "Offline recording", body: "Save on the device, sync when signal returns, with per-record sync status." },
  { icon: Smartphone, title: "Installable app", body: "Add Hatch360 to your home screen and open it like any other app." },
  { icon: Languages, title: "English & Kiswahili", body: "The daily recording flow speaks the language your team speaks." },
  { icon: HeartPulse, title: "Farm Health Score", body: "One score out of 100 from mortality, production, feed, vaccination and disease." },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <SectionHeading
            tone="dark"
            eyebrow="Features"
            title="Everything a poultry farm actually has to keep track of"
            lead="Not a generic farm app with chickens added. Every screen here exists because a poultry farmer has to answer that question on a normal Tuesday."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-line bg-surface p-5 shadow-card">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <h3 className="mt-3.5 text-[0.9375rem] font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- real screens -- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeading
            eyebrow="The actual product"
            title="Everyone sees the part of the farm they run"
            lead="These are real screens from EDOS Hatch360, not drawings. The owner and the farm manager work on a big screen; the person in the house records on a phone."
          />

          {/* The laptop leads at full width, with the phones in a single row
              beneath it. Side by side they would leave a tall void under the
              laptop, because four stacked phones are far taller than one
              screen. */}
          <div className="mt-12">
            <LaptopFrame
              className="mx-auto max-w-4xl"
              src="/images/app/desk-dashboard.png"
              alt="The EDOS Hatch360 dashboard on a laptop, showing total birds, active flocks, eggs collected today, mortality, feed used, revenue, expenses and profit, with an egg production chart and the Farm Health Score"
              caption="Owner and farm manager — the whole operation on one screen: birds, production, feed, money, and a Farm Health Score that shows the figure behind every component."
              priority
            />
          </div>

          <div className="mt-14 grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-4">
            <PhoneFrame
              src="/images/app/phone-record.png"
              alt="The daily recording screen on a phone, with large numeric fields for deaths, culls, birds sold and egg collection"
              caption="Farm worker — the sixty-second daily round, big numeric fields, saves with or without signal."
            />
            <PhoneFrame
              src="/images/app/phone-dashboard.png"
              alt="The EDOS Hatch360 dashboard on a phone, showing bird count, active flocks, eggs today and mortality as large tiles above a bottom navigation bar"
              caption="The same farm in your pocket, with the numbers that matter first."
            />
            <PhoneFrame
              src="/images/app/phone-flock.png"
              alt="A flock profile on a phone showing its life-cycle timeline, live bird count, mortality percentage and weight"
              caption="Supervisor — one batch, from placement through vaccination to harvest."
            />
            <PhoneFrame
              src="/images/app/phone-production.png"
              alt="The production screen on a phone showing hen-day production, saleable eggs and the collection trend"
              caption="Production at a glance: hen-day rate, saleable eggs, and the trend."
            />
          </div>

          {/* A second desktop view, because the manager's job is comparison. */}
          <div className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                For managers
              </p>
              <h3 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-ink">
                Compare houses, batches and farms side by side
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                A manager is not recording data — they are deciding where to put
                attention this week. Analytics puts every flock in one table against
                the standard for its bird type, so the batch that is drifting shows up
                before the month-end figures do.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {[
                  "Egg production, mortality and feed on one time axis",
                  "Every flock benchmarked on mortality, lay rate and feed conversion",
                  "Record-keeping discipline per flock, so you know which numbers to trust",
                  "Managers see only the farms assigned to them",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-ink">
                    <span
                      className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <LaptopFrame
              src="/images/app/desk-analytics.png"
              alt="The analytics screen on a laptop, showing egg production, mortality and feed consumption charts alongside a table benchmarking each flock"
            />
          </div>

          {/* ------------------------------------------------- assistant -- */}
          <div className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <LaptopFrame
              className="lg:order-2"
              src="/images/app/desk-assistant.png"
              alt="The Hatch360 assistant on a laptop, listing findings from the farm's records with the figures behind each one"
            />

            <div className="lg:order-1">
              <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                Farm assistant
              </p>
              <h3 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-ink">
                Ask your farm a question, in plain words
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                &ldquo;How much feed do I have left?&rdquo; &ldquo;Which flock needs
                attention?&rdquo; &ldquo;Am I making money this month?&rdquo; Every answer
                is calculated from your own records and shows the figures it used, so you
                can check the arithmetic rather than take it on trust.
              </p>
              <ul className="mt-5 flex flex-col gap-2.5">
                {[
                  "Answers come from your records — it never invents a number",
                  "Every reply shows the working, and the target it is measured against",
                  "Says so plainly when a question is outside what your data can answer",
                  "Anything about sick birds ends the same way: call your animal health officer",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-ink">
                    <span
                      className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden="true"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-ink-faint">
            Screens show Sunrise Poultry, the demonstration farm included with every new
            account. The figures are generated from real production curves, not invented.
          </p>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:px-6 lg:gap-24">
        <FeatureBlock
          id="flocks"
          eyebrow="Flock management"
          title="A record per batch, not a notebook per season"
          body="Open a flock and everything about it is on one screen: how many birds you placed, how many are alive today, their age in days, what they weigh, what they have eaten and when they are due for harvest."
          points={[
            "Live bird count derived from your daily records, so it cannot drift",
            "Mortality percentage against the benchmark for that bird type",
            "Feed conversion ratio and average daily gain for broilers",
            "Hen-day and hen-house production for layers",
            "Cost per bird and profit per batch when the batch closes",
          ]}
          image="/images/marketing/farm/pullets-flock.jpg"
          alt="A batch of brown pullets filling the floor of a deep-litter house"
        />

        <FeatureBlock
          id="production"
          eyebrow="Daily recording"
          title="Sixty seconds, standing in the house, one hand"
          body="The recording screen is the one farmers use most, so it is the one built most carefully: big numeric fields, a keypad instead of a keyboard, smart defaults, and a save that works whether or not you have signal."
          points={[
            "Mortality, culls, eggs, feed, water and weight in one pass",
            "Backdate an entry when yesterday got away from you",
            "Choose which sections you track and hide the rest",
            "Saves offline and syncs itself later",
            "Your recording streak, because consistency is what makes the data worth anything",
          ]}
          image="/images/marketing/farm/cage-rows.jpg"
          alt="A worker walking the aisle of a tiered layer cage house"
          flip
        />

        <FeatureBlock
          id="health"
          eyebrow="Health & the Farm Health Score"
          title="A number you can act on, with the working shown"
          body="The Farm Health Score combines mortality, egg production, feed conversion, vaccination compliance, disease reports and record-keeping discipline into one figure out of 100 — and lists every component with its value and its target."
          points={[
            "Withheld rather than guessed: a farm with no records shows 'not enough data', never a flattering 100",
            "Vaccination schedule by day of age with reminders before the due date",
            "Withdrawal periods calculated from the treatment you recorded",
            "Disease incidents with symptoms, severity, treatment and cost",
            "Insight is labelled as insight — Hatch360 never presents itself as a veterinary diagnosis",
          ]}
          image="/images/marketing/farm/pullets-close.jpg"
          alt="Brown pullets in close-up on deep litter, alert and in good condition"
        />

        <FeatureBlock
          id="finance"
          eyebrow="Money"
          title="Revenue minus expenses, at the level that matters"
          body="Profit for the farm is a start. Profit for this house, this batch, this product and this customer is what tells you what to do differently next cycle."
          points={[
            "Revenue from eggs, birds, chicks, manure and anything else you sell",
            "Expenses across feed, chicks, vaccines, labour, power, water, transport and repairs",
            "Profit and margin per farm, per house, per flock and per bird",
            "Outstanding balances, so credit customers do not quietly become losses",
            "Tax invoices and receipts you can hand over or email",
          ]}
          image="/images/marketing/feeding.jpg"
          alt="Brown hens feeding from a hanging feeder inside a poultry house"
          flip
        />
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            See it with your own birds in it
          </h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
            Create a farm, add a flock and record one day. It takes about five minutes,
            and it is free.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
