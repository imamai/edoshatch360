import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges a one-time credential from an emailed link for a session cookie,
 * then forwards to wherever the user was heading.
 *
 * Two shapes arrive here. Supabase's own confirmation and magic-link emails
 * carry a PKCE `code`. Password resets, which this app sends itself, carry a
 * `token_hash` and a `type` — deliberately, because Supabase's own reset link
 * returns its tokens in a URL fragment, and a browser never sends a fragment
 * to the server, so the route could not read them at all.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/app";

  // Only ever redirect to a path on this origin — an open redirect here would
  // let a crafted confirmation link bounce a freshly signed-in user offsite.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  } else if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery" | "invite" | "email",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
