import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        Then we&rsquo;ll take you straight back to your flock.
      </p>

      <div className="mt-7">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
