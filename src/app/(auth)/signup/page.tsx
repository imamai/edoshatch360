import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a free EDOS Hatch360 account and start tracking your flock, production, feed and profit today.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Start with your first flock
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Free on the Starter plan. No card, no commitment.
      </p>

      <div className="mt-7">
        <SignupForm />
      </div>

      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
