import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CAN_SEE_MONEY, CAN_WRITE, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getTenantPlan } from "@/lib/data/plan";
import { featureFrom } from "@/lib/plans";
import { UpgradeNotice } from "@/components/app/upgrade-notice";
import { ProductManager } from "./product-manager";
import { ReadOnlyNotice } from "@/components/app/read-only-notice";
import type { Product } from "@/lib/database.types";

export const metadata: Metadata = { title: "Products" };

/**
 * The catalogue the Counter sells from.
 *
 * Prices are money, so this sits behind the same permission as Sales rather
 * than being visible to everyone who can record a day's eggs.
 */
export default async function ProductsPage() {
  const session = await requireSession();
  // Hidden in the navigation, but a URL still resolves — so the page
  // itself has to know what the plan carries.
  const plan = await getTenantPlan(session.tenant.id);
  if (!plan.allows("invoicing")) {
    return <UpgradeNotice what="Products" from={featureFrom("invoicing")} />;
  }
  if (!can(session.role, CAN_SEE_MONEY)) notFound();

  const supabase = await createClient();

  // Retired products are included: the whole point of this screen is to bring
  // one back, and they are invisible everywhere else in the app.
  const [{ data: products }, { data: soldRows }] = await Promise.all([
    supabase
      .from("edoshatch360_products")
      .select("*")
      .eq("tenant_id", session.tenant.id)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("edoshatch360_sale_items")
      .select("product_id")
      .eq("tenant_id", session.tenant.id)
      .not("product_id", "is", null),
  ]);

  // How many document lines each product appears on, so "delete" can say what
  // it costs rather than asking for blind confirmation.
  const soldCount = new Map<string, number>();
  for (const row of soldRows ?? []) {
    const id = (row as { product_id: string }).product_id;
    soldCount.set(id, (soldCount.get(id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Products</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What your farm sells, and what it sells for. Everything here appears as a
          tile on the Counter.
        </p>
      </div>

      {can(session.role, CAN_WRITE) ? (
        <ProductManager
          products={(products ?? []) as Product[]}
          currency={session.tenant.currency}
          soldCount={Object.fromEntries(soldCount)}
        />
      ) : (
        <ReadOnlyNotice what="change the catalogue" tenantName={session.tenant.name} />
      )}
    </div>
  );
}
