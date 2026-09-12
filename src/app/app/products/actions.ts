"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CAN_WRITE, can, requireSession } from "@/lib/data/session";
import type { ProductCategory } from "@/lib/database.types";

/**
 * The catalogue behind the Counter.
 *
 * Until now products only ever arrived from the tenant-creation seed or the
 * demo data — there was no way to add one, change a price or retire something
 * a farm had stopped selling. Every farm was stuck with the six starter
 * products it was given on day one.
 */

export interface ProductFormState {
  error: string | null;
  ok: string | null;
}

const CATEGORIES: ProductCategory[] = [
  "eggs", "live_birds", "processed_birds", "spent_layers",
  "chicks", "manure", "feed", "other",
];

/** Shillings in the form, integer cents in the database, always. */
function toCents(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

async function guard() {
  const session = await requireSession();
  if (!can(session.role, CAN_WRITE)) {
    return {
      session: null,
      denied: {
        error: "Your account has read-only access to this farm, so you cannot change the catalogue.",
        ok: null,
      } satisfies ProductFormState,
    };
  }
  return { session, denied: null };
}

export async function createProduct(
  _prev: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const { session, denied } = await guard();
  if (denied || !session) return denied!;

  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "other") as ProductCategory;
  const unit = String(form.get("unit") ?? "").trim() || "pc";
  const cents = toCents(form.get("price"));

  if (!name) return { error: "Give the product a name.", ok: null };
  if (!CATEGORIES.includes(category)) {
    return { error: "Choose what kind of product this is.", ok: null };
  }
  if (cents === null) {
    return { error: "Enter a price — use 0 if it varies and you set it at the till.", ok: null };
  }

  const supabase = await createClient();

  // Names are how the person serving finds a product, so two that read the
  // same are worse than useless. Checked here rather than with a unique
  // constraint: a farm that retires "Eggs" and later adds it back should be
  // allowed to, and the retired row still holds the name.
  const { data: clash } = await supabase
    .from("edoshatch360_products")
    .select("id")
    .eq("tenant_id", session.tenant.id)
    .eq("is_active", true)
    .ilike("name", name)
    .maybeSingle();

  if (clash) {
    return { error: `You already sell something called "${name}".`, ok: null };
  }

  const { error } = await supabase.from("edoshatch360_products").insert({
    tenant_id: session.tenant.id,
    name,
    category,
    unit,
    default_price_cents: cents,
    is_active: true,
  });

  if (error) return { error: "We couldn't save that product. Try again.", ok: null };

  revalidatePath("/app/products");
  revalidatePath("/app/sales/counter");
  return { error: null, ok: `${name} added to the catalogue.` };
}

export async function updateProduct(
  _prev: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  const { session, denied } = await guard();
  if (denied || !session) return denied!;

  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const category = String(form.get("category") ?? "other") as ProductCategory;
  const unit = String(form.get("unit") ?? "").trim() || "pc";
  const cents = toCents(form.get("price"));

  if (!id) return { error: "That product could not be found.", ok: null };
  if (!name) return { error: "Give the product a name.", ok: null };
  if (cents === null) return { error: "Enter a price of zero or more.", ok: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("edoshatch360_products")
    .update({ name, category, unit, default_price_cents: cents })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't save that change. Try again.", ok: null };

  // A price change applies to what is sold from now on. Documents already
  // issued keep the price they were issued at — sale items store their own
  // unit_price_cents rather than pointing at the catalogue.
  revalidatePath("/app/products");
  revalidatePath("/app/sales/counter");
  return { error: null, ok: `${name} updated.` };
}

/** Take a product off the till without losing what it has already sold. */
export async function setProductActive(
  id: string,
  active: boolean,
): Promise<ProductFormState> {
  const { session, denied } = await guard();
  if (denied || !session) return denied!;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edoshatch360_products")
    .update({ is_active: active })
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .select("name")
    .maybeSingle();

  if (error || !data) return { error: "We couldn't change that product. Try again.", ok: null };

  revalidatePath("/app/products");
  revalidatePath("/app/sales/counter");
  return {
    error: null,
    ok: active ? `${data.name} is back on the till.` : `${data.name} retired.`,
  };
}

/**
 * Delete a product outright.
 *
 * Safe for the books: edoshatch360_sale_items.product_id is ON DELETE SET
 * NULL and each line carries its own description and price, so every invoice
 * and receipt already issued still reads exactly as it did. What is lost is
 * the link back — those lines can no longer be grouped under this product in
 * a report. That is why retiring is offered first and this is the second
 * choice, and why the caller is told how many documents it appears on.
 */
export async function deleteProduct(id: string): Promise<ProductFormState> {
  const { session, denied } = await guard();
  if (denied || !session) return denied!;

  const supabase = await createClient();

  const { data: product } = await supabase
    .from("edoshatch360_products")
    .select("name")
    .eq("id", id)
    .eq("tenant_id", session.tenant.id)
    .maybeSingle();

  if (!product) return { error: "That product could not be found.", ok: null };

  const { error } = await supabase
    .from("edoshatch360_products")
    .delete()
    .eq("id", id)
    .eq("tenant_id", session.tenant.id);

  if (error) return { error: "We couldn't delete that product. Try again.", ok: null };

  revalidatePath("/app/products");
  revalidatePath("/app/sales/counter");
  return { error: null, ok: `${product.name} deleted.` };
}
