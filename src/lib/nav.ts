import {
  BarChart3, Bird, Boxes, ClipboardList, Coins, Egg, FileSignature, FileText,
  Home, LayoutGrid, MapPin, Receipt, ScrollText, Settings, ShoppingCart,
  Sparkles, Syringe, Users, Wheat,
} from "lucide-react";
import type { FarmMode, Role } from "@/lib/database.types";

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
   * Nested destinations, revealed by a chevron on the desktop sidebar.
   *
   * The mobile bar deliberately ignores these: five thumb-sized slots is the
   * whole point of it, and a tree is the wrong shape for a phone. Small
   * screens reach the same places through filters on the list itself.
   */
  children?: NavItem[];
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
      { href: "/app/health", label: "Health", icon: Syringe },
      { href: "/app/tasks", label: "Tasks", icon: LayoutGrid },
    ],
  },
  {
    title: "Stock",
    items: [
      { href: "/app/feed", label: "Feed", icon: Wheat },
      { href: "/app/inventory", label: "Inventory", icon: Boxes, advancedOnly: true },
    ],
  },
  {
    title: "Business",
    items: [
      {
        href: "/app/sales",
        label: "Sales",
        icon: Receipt,
        roles: MONEY,
        children: [
          {
            href: "/app/sales/counter",
            label: "Counter",
            icon: ShoppingCart,
            roles: MONEY,
            writeOnly: true,
          },
          { href: "/app/sales?type=invoice", label: "Invoices", icon: FileText, roles: MONEY },
          { href: "/app/sales?type=receipt", label: "Receipts", icon: Receipt, roles: MONEY },
          {
            href: "/app/sales?type=quotation",
            label: "Quotations",
            icon: FileSignature,
            roles: MONEY,
          },
          { href: "/app/sales?type=order", label: "Sales orders", icon: ScrollText, roles: MONEY },
        ],
      },
      { href: "/app/customers", label: "Customers", icon: Users, roles: MONEY, advancedOnly: true },
      { href: "/app/finance", label: "Finance", icon: Coins, roles: MONEY },
    ],
  },
  {
    title: "Insight",
    items: [
      { href: "/app/assistant", label: "Assistant", icon: Sparkles },
      { href: "/app/reports", label: "Reports", icon: FileText, advancedOnly: true },
      { href: "/app/analytics", label: "Analytics", icon: BarChart3, advancedOnly: true },
    ],
  },
  {
    title: null,
    items: [{ href: "/app/settings", label: "Settings", icon: Settings, roles: ADMIN }],
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

function allowed(item: NavItem, role: Role, mode: FarmMode, canWrite: boolean): boolean {
  return (
    (!item.roles || item.roles.includes(role)) &&
    (!item.advancedOnly || mode === "advanced") &&
    (!item.writeOnly || canWrite)
  );
}

export function visibleGroups(
  role: Role,
  mode: FarmMode,
  canWrite = true,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    title: group.title,
    items: group.items
      .filter((item) => allowed(item, role, mode, canWrite))
      // Children are filtered by the same rules — a viewer must not be offered
      // the Counter just because it is nested.
      .map((item) =>
        item.children
          ? {
              ...item,
              children: item.children.filter((c) => allowed(c, role, mode, canWrite)),
            }
          : item,
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

/**
 * Whether a child entry is the page currently open.
 *
 * Children are distinguished by a query string as often as by a path — the
 * document lists are all `/app/sales` with a different `?type=` — so a plain
 * prefix match is not enough to tell them apart.
 */
export function isChildActive(href: string, pathname: string, search: string): boolean {
  const [path, query] = href.split("?");
  if (query) {
    const wanted = new URLSearchParams(query);
    const actual = new URLSearchParams(search);
    if (pathname !== path) return false;
    for (const [key, value] of wanted) {
      if (actual.get(key) !== value) return false;
    }
    return true;
  }
  // A pathname child (the Counter) matches the way top-level entries do.
  return pathname === path || pathname.startsWith(`${path}/`);
}
