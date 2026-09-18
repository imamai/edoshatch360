"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSendEmail, passwordResetEmail, sendEmail } from "@/lib/email";

export type ResetResult = { ok: true } | { ok: false; error: string };

/**
 * Recent requests per address.
 *
 * In memory, so it resets on deploy and is per-instance. That is weak on its
 * own; it is not on its own, because a link is only ever generated for an
 * address that already has a Hatch360 account. This just stops one person
 * hammering the button.
 */
const recent = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 3;

function rateLimited(email: string): boolean {
  const now = Date.now();
  const seen = (recent.get(email) ?? []).filter((t) => now - t < WINDOW_MS);
  if (seen.length >= MAX_PER_WINDOW) {
    recent.set(email, seen);
    return true;
  }
  seen.push(now);
  recent.set(email, seen);
  return false;
}

/** The address this request arrived on, so the link comes back to the same place. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Emails a password-reset link, as Hatch360.
 *
 * Supabase's own resetPasswordForEmail is not used. Its SMTP sender and
 * template belong to the whole project, and its stock message — a naked link
 * from onboarding@edoscentre.co.ke — was being flagged by Gmail as a possible
 * phishing attempt, which is not a thing to ask farmers to look past.
 *
 * The link is built here with the token in the query string rather than taken
 * from Supabase's action_link, which returns its tokens in a URL fragment that
 * a server route can never read.
 *
 * It answers the same whether or not the address has an account: naming one
 * that does not would let anyone with this page check who farms with us.
 */
export async function requestPasswordReset(email: string): Promise<ResetResult> {
  const address = email.trim().toLowerCase();
  if (!address || !address.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // A misconfigured deployment is not a secret, and silence here would leave
  // nobody able to tell it apart from an address with no account.
  if (!canSendEmail()) {
    return { ok: false, error: "Password reset email isn't set up yet. Please contact support." };
  }

  if (rateLimited(address)) {
    return { ok: false, error: "Too many requests. Please wait a few minutes and try again." };
  }

  const indistinguishable: ResetResult = { ok: true };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "Password reset isn't set up yet. Please contact support." };
  }

  // Only for someone who actually has an account here.
  const { data: user } = await admin
    .from("edoshatch360_users")
    .select("id")
    .eq("email", address)
    .maybeSingle();
  if (!user) return indistinguishable;

  const base = await origin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: address,
    options: { redirectTo: `${base}/auth/callback?next=/reset-password` },
  });

  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return indistinguishable;

  const link = `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=/reset-password`;
  const sent = await sendEmail({ to: address, ...passwordResetEmail({ link }) });

  if (!sent.sent) {
    // Worth knowing in the logs; still not worth telling the browser, which
    // would confirm that the address exists.
    console.error("Hatch360 password reset email failed:", sent.reason);
  }

  return indistinguishable;
}
