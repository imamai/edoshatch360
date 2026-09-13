"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface AcceptState {
  error: string | null;
}

/**
 * Redeem an invitation.
 *
 * Every rule — the token being live, the address matching, the membership
 * being written — is inside edoshatch360_accept_invite, in one transaction.
 * Doing it here in three steps would leave a window where a token is spent and
 * no membership exists.
 */
export async function acceptInvite(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "That invitation link is incomplete." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("edoshatch360_accept_invite", { p_token: token });

  if (error) {
    // HB001 messages are written for the person reading them; anything else is
    // plumbing and should not be shown.
    return {
      error:
        error.code === "HB001" || /invitation|address|Sign in/i.test(error.message)
          ? error.message
          : "We couldn't accept that invitation. Try the link again.",
    };
  }

  redirect("/app/home");
}
