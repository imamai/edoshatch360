import type { Metadata } from "next";
import Link from "next/link";
import { Bird, MapPin, Package, Receipt, Search, Users } from "lucide-react";

import { CAN_SEE_MONEY, can, requireSession } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Search" };

interface Hit {
  href: string;
  title: string;
  subtitle: string;
  group: string;
  icon: typeof Bird;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const showMoney = can(session.role, CAN_SEE_MONEY);

  let hits: Hit[] = [];

  if (q.length >= 2) {
    const supabase = await createClient();
    // PostgREST's `or` takes a comma-separated filter list; commas inside the
    // user's own text would split it, so they are stripped rather than escaped.
    const term = `%${q.replace(/[,()]/g, "")}%`;

    const [flocks, farms, customers, sales, items] = await Promise.all([
      supabase
        .from("edoshatch360_flocks")
        .select("id, code, name, bird_type, current_count")
        .eq("tenant_id", session.tenant.id)
        .or(`code.ilike.${term},name.ilike.${term},breed.ilike.${term}`)
        .limit(8),
      supabase
        .from("edoshatch360_farms")
        .select("id, name, location, county")
        .eq("tenant_id", session.tenant.id)
        .or(`name.ilike.${term},location.ilike.${term},county.ilike.${term}`)
        .limit(5),
      showMoney
        ? supabase
            .from("edoshatch360_customers")
            .select("id, name, phone, location")
            .eq("tenant_id", session.tenant.id)
            .or(`name.ilike.${term},phone.ilike.${term},location.ilike.${term}`)
            .limit(8)
        : Promise.resolve({ data: [] }),
      showMoney
        ? supabase
            .from("edoshatch360_sales")
            .select("id, doc_number, doc_type, total_cents, sale_date")
            .eq("tenant_id", session.tenant.id)
            .ilike("doc_number", term)
            .limit(8)
        : Promise.resolve({ data: [] }),
      supabase
        .from("edoshatch360_inventory")
        .select("id, name, category, current_stock, unit")
        .eq("tenant_id", session.tenant.id)
        .or(`name.ilike.${term},sku.ilike.${term},supplier.ilike.${term}`)
        .limit(8),
    ]);

    hits = [
      ...(flocks.data ?? []).map((f) => ({
        href: `/app/flocks/${f.id}`,
        title: f.code,
        subtitle: `${f.name ?? f.bird_type} · ${formatNumber(f.current_count)} birds`,
        group: "Flocks",
        icon: Bird,
      })),
      ...(farms.data ?? []).map((f) => ({
        href: "/app/farms",
        title: f.name,
        subtitle: [f.location, f.county].filter(Boolean).join(" · ") || "Farm",
        group: "Farms",
        icon: MapPin,
      })),
      ...((customers.data ?? []) as { id: string; name: string; phone: string | null; location: string | null }[]).map((c) => ({
        href: "/app/customers",
        title: c.name,
        subtitle: [c.phone, c.location].filter(Boolean).join(" · ") || "Customer",
        group: "Customers",
        icon: Users,
      })),
      ...((sales.data ?? []) as { id: string; doc_number: string; doc_type: string; total_cents: number; sale_date: string }[]).map((s) => ({
        href: `/app/sales/${s.id}`,
        title: s.doc_number,
        subtitle: `${s.doc_type} · ${formatMoney(s.total_cents, { currency: session.tenant.currency })} · ${s.sale_date}`,
        group: "Sales",
        icon: Receipt,
      })),
      ...(items.data ?? []).map((i) => ({
        href: i.category === "feed" ? "/app/feed" : "/app/inventory",
        title: i.name,
        subtitle: `${formatNumber(i.current_stock, { decimals: 1 })} ${i.unit} in stock`,
        group: "Inventory",
        icon: Package,
      })),
    ];
  }

  const grouped = hits.reduce<Record<string, Hit[]>>((acc, hit) => {
    (acc[hit.group] ??= []).push(hit);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">Search</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Flocks, farms, customers, documents and stock.
      </p>

      {/* A plain GET form: works with JavaScript off and the query stays in
          the URL, so a search can be bookmarked or shared. */}
      <form action="/app/search" method="get" className="mt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4.5 w-4.5 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="FL-2026-001, a customer name, a phone number…"
            className="h-12 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-10 text-[0.9375rem] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </div>
      </form>

      <div className="mt-5">
        {q.length < 2 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="Type at least two characters"
                description="Search a flock code, a customer, an invoice number or something you keep in stock."
              />
            </CardBody>
          </Card>
        ) : hits.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title={`Nothing matching "${q}"`}
                description="Check the spelling, or try a shorter piece of the name or code."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(grouped).map(([group, groupHits]) => (
              <div key={group}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-ink-faint uppercase">
                  {group}
                  <Badge tone="neutral">{groupHits.length}</Badge>
                </h2>
                <Card>
                  <CardBody className="p-0">
                    <ul className="divide-y divide-line">
                      {groupHits.map((hit, i) => {
                        const Icon = hit.icon;
                        return (
                          <li key={`${hit.href}-${i}`}>
                            <Link
                              href={hit.href}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-sunk sm:px-5"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-ink">
                                  {hit.title}
                                </span>
                                <span className="block truncate text-xs text-ink-faint">
                                  {hit.subtitle}
                                </span>
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </CardBody>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
