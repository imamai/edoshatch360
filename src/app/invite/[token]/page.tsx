import type { Metadata } from "next";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/brand/logo";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

const ROLE_LABEL: Record<string, string> = {
  owner: "owner",
  manager: "manager",
  supervisor: "supervisor",
  worker: "worker",
  vet: "vet",
  accountant: "accountant",
  sales: "sales officer",
  viewer: "viewer",
};

/**
 * The page an invitation link opens.
 *
 * It has to work for someone with no account at all, so it reads the
 * invitation through a security-definer function granted to anon — the token
 * is the only thing that identifies it. A token that is wrong, spent, revoked
 * or expired returns nothing, and all four look the same from here, which is
 * deliberate: a stranger holding a guess should not learn which it was.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: preview }, { data: auth }] = await Promise.all([
    supabase.rpc("edoshatch360_invite_preview", { p_token: token }),
    supabase.auth.getUser(),
  ]);

  const invite = (preview as { tenant_name: string; email: string; role: string }[] | null)?.[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <LogoMark className="h-9 w-9 text-brand" />

        {!invite ? (
          <>
            <h1 className="mt-4 font-display text-xl font-bold text-ink">
              This invitation is no longer open
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              It may already have been used, cancelled, or left to expire — invitations
              last fourteen days. Ask whoever invited you to send a new one.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
            >
              Go to EDOS Hatch360
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-xl font-bold text-ink">
              Join {invite.tenant_name}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              You have been invited to {invite.tenant_name} on EDOS Hatch360 as a{" "}
              <strong className="font-semibold text-ink">
                {ROLE_LABEL[invite.role] ?? invite.role}
              </strong>
              .
            </p>

            {auth?.user ? (
              auth.user.email?.toLowerCase() === invite.email.toLowerCase() ? (
                <AcceptForm token={token} farm={invite.tenant_name} />
              ) : (
                <div className="mt-5 rounded-lg border border-attention/30 bg-attention-soft px-3 py-2.5">
                  <p className="text-sm text-ink">
                    This invitation was sent to{" "}
                    <strong className="font-semibold">{invite.email}</strong>, but you are
                    signed in as {auth.user.email}.
                  </p>
                  <Link
                    href={`/login?next=/invite/${token}`}
                    className="mt-2 inline-block text-sm font-medium text-brand hover:underline"
                  >
                    Sign in as {invite.email}
                  </Link>
                </div>
              )
            ) : (
              <div className="mt-5 flex flex-col gap-2.5">
                <p className="text-sm text-ink-soft">
                  Sign in as{" "}
                  <strong className="font-semibold text-ink">{invite.email}</strong> to
                  accept. If you have never used EDOS Hatch360, create an account with
                  that same address first.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <Link
                    href={`/login?next=/invite/${token}`}
                    className="inline-flex h-11 items-center rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/signup?next=/invite/${token}`}
                    className="inline-flex h-11 items-center rounded-lg border border-line-strong px-5 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
                  >
                    Create an account
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
