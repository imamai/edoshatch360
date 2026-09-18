import "server-only";

import { Resend } from "resend";

/**
 * Sending email as Hatch360.
 *
 * Supabase can send auth email itself, and until now it did — from
 * onboarding@edoscentre.co.ke, using the stock template, which Gmail marked
 * "This message might be dangerous". That verdict was fair: a bare line of
 * text and a naked link, from a domain that is not the one the app runs on,
 * is the exact shape of a phishing attempt. Farmers should never be asked to
 * tell the difference.
 *
 * So the app sends its own, with its own from-address and a message that says
 * who it is from and what it is for.
 */

export type EmailResult = { sent: true } | { sent: false; reason: string };

export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      sent: false,
      reason: "Email is not configured — set RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    // A plain-text part as well as HTML: some mail clients show only the text,
    // and a message without one scores worse with spam filters.
    const { error } = await resend.emails.send({
      from: `edoshatch360 <${from}>`,
      to,
      subject,
      html,
      text,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (cause) {
    return {
      sent: false,
      reason: cause instanceof Error ? cause.message : "Could not send the email.",
    };
  }
}

/**
 * The shell every Hatch360 email shares.
 *
 * One place for the wrapper means a farmer who has seen one of our emails
 * recognises the next, which is most of what stops a genuine message being
 * mistaken for a forgery.
 */
function shell({ heading, body, cta, link }: { heading: string; body: string; cta: string; link: string }): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#161a17;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3e6e2;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.04em;color:#1b5e42;">EDOS Hatch360</p>
          <h1 style="margin:12px 0 0;font-size:20px;line-height:1.3;color:#161a17;">${heading}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px 0;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${body}</p>
          <p style="margin:0 0 20px;">
            <a href="${link}" style="display:inline-block;background:#1b5e42;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">${cta}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#5a635c;">
            If the button doesn&rsquo;t work, copy this address into your browser:
          </p>
          <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#5a635c;">${link}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;border-top:1px solid #e3e6e2;">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#5a635c;">
            EDOS Hatch360 &middot; flock records for Kenyan poultry farms
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Confirming a new account. */
export function signupConfirmEmail({ link, name }: { link: string; name?: string | null }) {
  const greeting = name ? `${name}, welcome` : "Welcome";
  return {
    subject: "Confirm your Hatch360 account",
    html: shell({
      heading: `${greeting} to Hatch360`,
      body: "Confirm this address and you&rsquo;ll land straight in your new farm, ready to record your first day.",
      cta: "Confirm my account",
      link,
    }),
    text: [
      `${greeting} to EDOS Hatch360.`,
      "",
      "Confirm this address to finish setting up your account:",
      link,
      "",
      "The link can be used once and expires shortly.",
      "",
      "If you didn't sign up, ignore this email — no account will be activated.",
      "",
      "EDOS Hatch360",
    ].join("\n"),
  };
}

/** Inviting someone to an existing farm. */
export function teamInviteEmail({
  link,
  farmName,
  invitedBy,
  role,
}: {
  link: string;
  farmName: string;
  invitedBy?: string | null;
  role: string;
}) {
  const who = invitedBy ? `${invitedBy} has invited you` : "You have been invited";
  return {
    subject: `You've been invited to ${farmName} on Hatch360`,
    html: shell({
      heading: `Join ${farmName}`,
      body: `${who} to help run <strong>${farmName}</strong> on Hatch360, as ${role}. Accept the invitation to get started.`,
      cta: "Accept invitation",
      link,
    }),
    text: [
      `${who} to help run ${farmName} on EDOS Hatch360, as ${role}.`,
      "",
      "Accept the invitation here:",
      link,
      "",
      "If you weren't expecting this, you can ignore this email.",
      "",
      "EDOS Hatch360",
    ].join("\n"),
  };
}

/**
 * The reset email.
 *
 * Deliberately plain, and deliberately specific: it names the product, says
 * what was asked for, and says what to do if it wasn't you. Those are the
 * three things the stock template left out and the three things that make an
 * email read as genuine.
 */
export function passwordResetEmail({ link }: { link: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Reset your Hatch360 password";

  const text = [
    "Someone asked to reset the password for your EDOS Hatch360 account.",
    "",
    "Open this link to choose a new password:",
    link,
    "",
    "The link can be used once and expires shortly.",
    "",
    "If this wasn't you, ignore this email — your password has not changed.",
    "",
    "EDOS Hatch360",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#161a17;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e3e6e2;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.04em;color:#1b5e42;">
            EDOS Hatch360
          </p>
          <h1 style="margin:12px 0 0;font-size:20px;line-height:1.3;color:#161a17;">Reset your password</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 28px 0;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
            Someone asked to reset the password for your Hatch360 account. Choose a new one here:
          </p>
          <p style="margin:0 0 20px;">
            <a href="${link}" style="display:inline-block;background:#1b5e42;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:600;">
              Set a new password
            </a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#5a635c;">
            The link can be used once and expires shortly. If the button doesn&rsquo;t work, copy this address into your browser:
          </p>
          <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;color:#5a635c;">${link}</p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;">
            If this wasn&rsquo;t you, you can ignore this email &mdash; your password has not changed.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 28px;border-top:1px solid #e3e6e2;">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#5a635c;">
            EDOS Hatch360 &middot; flock records for Kenyan poultry farms
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}
