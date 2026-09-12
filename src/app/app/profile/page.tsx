import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { UserRound } from "lucide-react";

import { requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectInput, TextInput } from "@/components/ui/field";
import { formatDate, initials } from "@/lib/utils";

export const metadata: Metadata = { title: "Your profile" };

async function updateProfile(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS on edoshatch360_users restricts an update to the caller's own row, and
  // a trigger blocks any change to is_platform_admin.
  await supabase
    .from("edoshatch360_users")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      locale: String(formData.get("locale") ?? "en"),
    })
    .eq("id", user.id);

  revalidatePath("/app", "layout");
}

export default async function ProfilePage() {
  const session = await requireSession();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
        Your profile
      </h1>

      <Card>
        <CardBody className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand">
            {initials(session.user.full_name ?? session.user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-ink">
              {session.user.full_name ?? "Add your name"}
            </p>
            <p className="truncate text-sm text-ink-soft">{session.user.email}</p>
            <p className="mt-1 text-xs text-ink-faint">
              With {session.tenant.name} since {formatDate(session.user.created_at)}
            </p>
          </div>
          <Badge tone="brand">{session.role}</Badge>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Your details"
          subtitle="How you appear to the rest of the team"
          icon={<UserRound className="h-4 w-4" />}
        />
        <CardBody>
          <form action={updateProfile} className="flex flex-col gap-4">
            <TextInput
              label="Full name"
              name="full_name"
              defaultValue={session.user.full_name ?? ""}
              placeholder="Jane Wanjiru"
            />
            <TextInput
              label="Phone"
              name="phone"
              type="tel"
              defaultValue={session.user.phone ?? ""}
              placeholder="07xx xxx xxx"
              hint="Used for SMS alerts and M-Pesa prompts."
            />
            <SelectInput label="Language" name="locale" defaultValue={session.user.locale}>
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </SelectInput>

            <Button type="submit" className="self-start">
              Save changes
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Your organisations" />
        <CardBody className="p-0">
          <ul className="divide-y divide-line">
            {session.tenants.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 truncate text-sm font-medium text-ink">{t.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">{t.role}</Badge>
                  {t.id === session.tenant.id && (
                    <Badge tone="good" dot>
                      Current
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <p className="text-xs leading-relaxed text-ink-faint">
        To change your email or password, sign out and use the password reset link on the
        sign-in page. Your farm records are not affected.
      </p>
    </div>
  );
}
