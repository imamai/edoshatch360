import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { SaleBuilder } from "./sale-builder";
import type { Customer, Product } from "@/lib/database.types";

export const metadata: Metadata = { title: "New sale" };

export default async function NewSalePage() {
  const session = await requireSession();
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

  const supabase = await createClient();
  const [productRes, customerRes] = await Promise.all([
    supabase
      .from("edoshatch360_products")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("edoshatch360_customers")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app/sales"
        className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-brand"
      >
        <ChevronLeft className="h-4 w-4" />
        Sales
      </Link>

      <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink">
        New sale
      </h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        A receipt for money in hand, an invoice for money owed, or a quotation for a
        price you have offered.
      </p>

      <div className="mt-6">
        <SaleBuilder
          products={(productRes.data ?? []) as Product[]}
          customers={(customerRes.data ?? []) as Customer[]}
          currency={session.tenant.currency}
        />
      </div>
    </div>
  );
}
