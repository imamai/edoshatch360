import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";

import { SectionHeading } from "@/components/marketing/sections";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to the EDOS Centre team about EDOS Hatch360 — poultry farm management software for Kenya. Tell us what you farm and what is hardest to keep track of.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <section className="mk-dark relative overflow-hidden">
        <div className="mk-grid-lines absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <SectionHeading
            tone="dark"
            eyebrow="Contact"
            title="Tell us about your farm"
            lead="Whether you are running 300 kienyeji birds or twenty houses, we would like to hear what you actually need. We read every message."
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-14">
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Mail className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Email us</p>
                <a
                  href="mailto:info@edoscentre.co.ke"
                  className="mt-0.5 block text-sm break-all text-brand hover:underline"
                >
                  info@edoscentre.co.ke
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <MapPin className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Where we are</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  EDOS Centre — Kenya. Built here, for farms here.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <MessageSquare className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Already using Hatch360?</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                  Sign in and use the help link inside the app — that way your message
                  arrives with your farm details attached.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
