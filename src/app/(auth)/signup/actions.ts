"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSendEmail, sendEmail, signupConfirmEmail } from "@/lib/email";

export type SignupResult = { ok: true } | { ok: false; error: string };

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Creates the account and emails the confirmation, as Hatch360.
 *
 * supabase.auth.signUp() is not used, because it sends Supabase's stock
 * confirmation email -- a naked link from onboarding@edoscentre.co.ke, which
 * Gmail has already flagged on this project as a possible phishing attempt.
 * A farmer's very first message from us is the worst possible one to have
 * land in Spam.
 *
 * generateLink with type "signup" creates the user and returns the
 * confirmation token without sending anything, which leaves the email to us.
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
}): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!email.includes("@")) return { ok: false, error: "Please enter a valid email address." };
  if (input.password.length < 8) {
    return { ok: false, error: "Please use at least 8 characters for your password." };
  }

  if (!canSendEmail()) {
    return { ok: false, error: "Sign-up email isn't set up yet. Please contact support." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Sign-up isn't set up yet. Please contact support." };
  }

  const base = await origin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: input.password,
    options: {
      data: { full_name: fullName, phone: input.phone.trim() || null },
      redirectTo: `${base}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    // Unlike a reset, this one has to say so: the person is trying to create
    // an account and needs to know it already exists. Signing in reveals the
    // same thing anyway, so nothing is given away that was not already.
    if (message.includes("already") || message.includes("registered")) {
      return { ok: false, error: "There is already an account with that email. Try signing in instead." };
    }
    return { ok: false, error: "We couldn't create your account. Please try again." };
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) return { ok: false, error: "We couldn't create your account. Please try again." };

  const link = `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=signup&next=/onboarding`;
  const sent = await sendEmail({ to: email, ...signupConfirmEmail({ link, name: fullName || null }) });

  if (!sent.sent) {
    console.error("Hatch360 signup confirmation email failed:", sent.reason);
    return {
      ok: false,
      error: "Your account was created but we couldn't send the confirmation email. Use “Forgot your password?” to get in.",
    };
  }

  return { ok: true };
}
