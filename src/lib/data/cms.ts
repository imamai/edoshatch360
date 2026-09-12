import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CmsSection, Faq, Plan, Testimonial } from "@/lib/database.types";

/**
 * Public marketing content. Every read here runs as the anonymous role, which
 * RLS restricts to published rows only — no service key is involved in
 * rendering the marketing site.
 */

export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  return (data ?? []) as Plan[];
}

export async function getFaqs(category?: string): Promise<Faq[]> {
  const supabase = await createClient();
  let query = supabase
    .from("edoshatch360_cms_faqs")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return (data ?? []) as Faq[];
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("edoshatch360_cms_testimonials")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  return (data ?? []) as Testimonial[];
}

/**
 * Sections for a CMS page, keyed by section_key for direct lookup.
 * Returns an empty map when the page has no CMS rows yet — callers render
 * their shipped defaults in that case, so the site never depends on the CMS
 * being populated to work.
 */
export async function getPageSections(
  slug: string,
): Promise<Record<string, CmsSection>> {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("edoshatch360_cms_pages")
    .select("id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!page) return {};

  const { data } = await supabase
    .from("edoshatch360_cms_sections")
    .select("*")
    .eq("page_id", page.id)
    .eq("is_visible", true)
    .order("sort_order");

  const map: Record<string, CmsSection> = {};
  for (const row of (data ?? []) as CmsSection[]) map[row.section_key] = row;
  return map;
}