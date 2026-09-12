import {
  BarChart3, Bird, Boxes, ClipboardList, Coins, Egg, FileText,
  Home, LayoutGrid, MapPin, Receipt, Settings,
  ShieldCheck, Sparkles, Syringe, Tags, Users, Wheat,
} from "lucide-react";
import type { FarmMode, Role } from "@/lib/database.types";
import { planAllows, type PlanCode, type PlanFeature } from "@/lib/plans";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** Roles allowed to see this entry. Omitted means everyone. */
  roles?: Role[];
  /** Hidden while the tenant is in Simple mode (spec §31, §66). */
  advancedOnly?: boolean;
  /** Hidden for read-only accounts — the page only exists to record data. */
  writeOnly?: boolean;
  /**
   * Hidden unless the organisation's plan carries this capability.
   *
   * Separate from advancedOnly on purpose: that is a complexity preference a
   * farm sets for itself, this is what it has paid for. An entry with neither
   * is part of the product everyone gets.
   */
  feature?: PlanFeature;
  /** EDOS staff only — never shown to a farm, whatever their role. */
  platformAdminOnly?: boolean;
}

export interface NavGroup {
  title: string | null;
  items: NavItem[];
}

const MONEY: Role[] = ["owner", "accountant", "sales", "manager"];
const ADMIN: Role[] = ["owner"];

/**
 * Desktop navigation, grouped the way the reference management systems do it:
 * a flat Dashboard at the top, then labelled sections, then Settings pinned
 * at the bottom. Groups are stable — only the items inside them are filtered.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [{ href: "/app", label: "Dashboard", icon: Home }],
  },
  {
    title: "Farm",
    items: [
      { href: "/app/farms", label: "Farms & houses", icon: MapPin },
      { href: "/app/flocks", label: "Flocks", icon: Bird },
    ],
  },
  {
    title: "Daily",
    items: [
      { href: "/app/record", label: "Record data", icon: ClipboardList, writeOnly: true },
      { href: "/app/production", label: "Production", icon: Egg },
      { href: "/app/health", label: "Health", icon: Syringe, feature: "vaccinations" },
      { href: "/app/tasks", label: "Tasks", icon: LayoutGrid },
    ],
  },
  {
    title: "Stock",
    items: [
      { href: "/app/feed", label: "Feed", icon: Wheat },
      { href: "/app/inventory", label: "Inventory", icon: Boxes, advancedOnly: true, feature: "inventory" },
    ],
  },
  {
    title: "Business",
    items: [
      // Sales is a single destination. The Counter and the per-document views
      // are reached from buttons and filter chips on the page itself, which
      // keeps one list of documents rather than five entries pointing at it.
      { href: "/app/sales", label: "Sales", icon: Receipt, roles: MONEY, feature: "invoicing" },
      { href: "/app/products", label: "Products", icon: Tags, roles: MONEY, feature: "invoicing" },
      { href: "/app/customers", label: "Customers", icon: Users, roles: MONEY, advancedOnly: true, feature: "invoicing" },
      { href: "/app/finance", label: "Finance", icon: Coins, roles: MONEY },
    ],
  },
  {
    title: "Insight",
    items: [
      { href: "/app/assistant", label: "Assistant", icon: Sparkles },
      { href: "/app/reports", label: "Reports", icon: FileText, advancedOnly: true, feature: "reports_export" },
      { href: "/app/analytics", label: "Analytics", icon: BarChart3, advancedOnly: true, feature: "benchmarking" },
    ],
  },
  {
    title: null,
    items: [
      { href: "/app/settings", label: "Settings", icon: Settings, roles: ADMIN },
      {
        href: "/app/admin",
        label: "Platform",
        icon: ShieldCheck,
        platformAdminOnly: true,
      },
    ],
  },
];

/** Mobile bottom bar (spec §9). Five slots, no more — thumbs, not menus. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/app/flocks", label: "Flocks", icon: Bird },
  { href: "/app/production", label: "Production", icon: Egg },
  { href: "/app/feed", label: "Feed", icon: Wheat },
  { href: "/app/more", label: "More", icon: LayoutGrid },
];

function allowed(
  item: NavItem,
  role: Role,
  mode: FarmMode,
  canWrite: boolean,
  plan: PlanCode | null,
  isPlatformAdmin: boolean,
): boolean {
  // Checked first and on its own: a platform entry is not subject to the
  // farm's role, mode or plan, and nothing else may appear because of it.
  if (item.platformAdminOnly) return isPlatformAdmin;
  return (
    (!item.roles || item.roles.includes(role)) &&
    (!item.advancedOnly || mode === "advanced") &&
    (!item.writeOnly || canWrite) &&
    (!item.feature || planAllows(plan, item.feature))
  );
}

export function visibleGroups(
  role: Role,
  mode: FarmMode,
  canWrite = true,
  plan: PlanCode | null = null,
  isPlatformAdmin = false,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) =>
      allowed(item, role, mode, canWrite, plan, isPlatformAdmin),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Mobile bar, with the destinations a read-only account cannot use removed. */
export function visibleMobileNav(canWrite = true): NavItem[] {
  return MOBILE_NAV.filter((item) => !item.writeOnly || canWrite);
}

/**
 * Longest-prefix match, so /app/flocks/abc highlights "Flocks" while /app
 * stays highlighted only on the dashboard itself.
 */
export function activeHref(pathname: string, hrefs: string[]): string | undefined {
  return hrefs
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];
}
