import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CAN_SEE_MONEY, CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { getBrandingWithUrls } from "@/lib/data/branding";
import { createClient } from "@/lib/supabase/server";
import { Counter } from "@/components/app/counter/counter";
import { ReadOnlyNotice } from "@/components/app/read-only-notice";
import type { SaleDocumentBusiness } from "@/components/app/sale-document";
import type { Customer, Product } from "@/lib/database.types";

export const metadata: Metadata = { title: "Counter" };

export default async function CounterPage() {
  const session = await requireSession();
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

  // A read-only account is told why rather than shown a till it cannot use.
  if (!can(session.role, CAN_WRITE)) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Counter</h1>
        <div className="mt-4">
          <ReadOnlyNotice what="record sales" tenantName={session.tenant.name} />
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [productRes, customerRes, branding] = await Promise.all([
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
    getBrandingWithUrls(session.tenant.id),
  ]);

  const tenant = session.tenant;
  const business: SaleDocumentBusiness = {
    name: tenant.name,
    address: tenant.address,
    phone: tenant.phone,
    email: tenant.email,
    kraPin: tenant.kra_pin,
  };

  return (
    <Counter
      products={(productRes.data ?? []) as Product[]}
      customers={(customerRes.data ?? []) as Customer[]}
      currency={tenant.currency}
      business={business}
      branding={{
        logoUrl: branding.logoUrl,
        signatureUrl: branding.signatureUrl,
        signatoryName: branding.signatoryName,
        signatoryTitle: branding.signatoryTitle,
      }}
    />
  );
}
