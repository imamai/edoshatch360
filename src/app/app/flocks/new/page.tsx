import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { getHouses } from "@/lib/data/flocks";
import { ReadOnlyNotice } from "@/components/app/read-only-notice";
import { NewFlockForm } from "./new-flock-form";

export const metadata: Metadata = { title: "Add a flock" };

export default async function NewFlockPage() {
  const session = await requireSession();
  const houses = await getHouses(session.tenant.id);
  const canWrite = can(session.role, CAN_WRITE);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/app/flocks"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-brand"
      >
        <ChevronLeft className="h-4 w-4" />
        Flocks
      </Link>

      <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">
        Add a flock
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        Tell us what you placed and when. Everything else — mortality, feed,
        production, profit — builds up from the daily records you make against it.
      </p>

      <div className="mt-6">
        {canWrite ? (
          <NewFlockForm farms={session.farms} houses={houses} />
        ) : (
          <ReadOnlyNotice what="Adding a flock" tenantName={session.tenant.name} />
        )}
      </div>
    </div>
  );
}
