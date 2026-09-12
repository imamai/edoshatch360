import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/brand/logo";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Set up your farm",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/onboarding");

  // Someone who already belongs to an organisation has nothing to set up.
  const { data: memberships } = await supabase
    .from("edoshatch360_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);

  if (memberships && memberships.length > 0) redirect("/app");

  return (
    // Onboarding is the doorway into the system, so it carries the system's
    // typography rather than the marketing site's.
    <div className="app-ui min-h-screen bg-canvas">
      <div className="mx-auto flex max-w-lg flex-col px-4 py-10 sm:px-6">
        <Wordmark />

        <div className="mt-10">
          <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
            Step 1 of 1
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Tell us about your farm
          </h1>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            Two answers and you are in. You can add more farms, houses and people
            later — nothing here is locked.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
