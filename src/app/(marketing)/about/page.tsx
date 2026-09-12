import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { SectionHeading } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "About",
  description:
    "EDOS Hatch360 is built by EDOS Centre for Kenyan poultry farmers — mobile-first, offline-capable, and designed around how poultry is actually farmed here.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "The phone is the computer",
    body: "Most of the people who will use Hatch360 will never open it on a laptop. So it is designed for a phone held in one hand, in a poultry house, with the other hand busy — not shrunk down from a desktop screen afterwards.",
  },
  {
    title: "The network is optional",
    body: "Connectivity in rural Kenya is real but unreliable. A record saved on a phone with no signal is still a record. It waits, it syncs, and it tells you which state it is in. Nothing is lost quietly.",
  },
  {
    title: "Small farms are not small versions of big farms",
    body: "A farmer with 300 kienyeji birds does not need feed conversion ratios on day one. Hatch360 opens simple and grows into the advanced tools as the farm does, rather than presenting everything at once and hoping.",
  },
  {
    title: "Numbers should mean something",
    body: "Any system can store what you typed in. The harder and more useful job is turning it into the four things that actually matter: what you have, what it is producing, what it is costing, and whether you are ahead.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <SectionHeading
            tone="dark"
            eyebrow="About"
            title="Built in Kenya, for how poultry is actually farmed here"
            lead="EDOS Hatch360 is made by EDOS Centre. It exists because farm records in this market mostly live in notebooks, in WhatsApp messages, and in people's heads — and none of those tell you whether the last batch made money."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line shadow-raised">
            <Image
              src="/images/marketing/farm/layer-house-wide.jpg"
              alt="The full length of a tiered layer house, with workers at the far end"
              fill
              sizes="(max-width: 1024px) 100vw, 520px"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
              The problem is not that farmers don&apos;t keep records
            </h2>
            <div className="mt-4 flex flex-col gap-4 text-[0.9375rem] leading-relaxed text-ink-soft">
              <p>
                Most poultry farmers we speak to keep records carefully. The problem is
                that a notebook cannot tell you that House 3 is eating more feed per
                bird than House 1, or that your last broiler batch made less per bird
                than the one before it despite being bigger.
              </p>
              <p>
                That arithmetic is not hard. It is just tedious, and it never gets done
                at the end of a long day. So the decisions that depend on it —
                which breed, which supplier, which house, whether to expand — get made
                on impression rather than evidence.
              </p>
              <p>
                Hatch360 does the arithmetic. You record what happened; it tells you
                what it means.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <SectionHeading
            eyebrow="How we build it"
            title="Four things we refuse to compromise on"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} className="rounded-xl border border-line bg-canvas p-6">
                <span className="font-display text-sm font-bold text-brand tnum">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 font-display text-base font-bold text-ink">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Want to talk to the people building it?
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          We would rather hear what your farm actually needs than guess. Tell us what
          you run and what is currently hardest to keep track of.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brand px-6 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Get in touch
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center justify-center rounded-lg border border-line-strong px-6 text-[0.9375rem] font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Or just try it
          </Link>
        </div>
      </section>
    </>
  );
}
