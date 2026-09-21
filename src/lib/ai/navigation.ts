/**
 * Where things are in EDOS Hatch360 itself.
 *
 * Client-safe and static, mirroring src/lib/nav.ts's own labels and gates —
 * kept as a separate, hand-written list rather than reused directly because
 * a nav item needs one line of copy here ("what is this for"), and nav.ts's
 * job is only ever "what shows in the sidebar for this role right now".
 *
 * edos.ai reads this list as a tool result, the same way it reads a flock's
 * metrics: it can name a real path and a real restriction, but it can never
 * invent one that isn't in this list.
 */

export interface NavHelp {
  path: string;
  label: string;
  what: string;
  /** Who can reach it, when that isn't "everyone signed in". */
  restricted?: string;
}

export const NAV_HELP: NavHelp[] = [
  { path: "/app", label: "Dashboard", what: "Farm overview: total birds, active flocks, mortality to date, eggs today, and this month's margin." },
  { path: "/app/farms", label: "Farms & houses", what: "The physical places birds live — add a farm location, then the houses or pens inside it." },
  { path: "/app/flocks", label: "Flocks", what: "Every batch of birds. Open one for its full profile, timeline and daily-record history." },
  { path: "/app/flocks/new", label: "Add a flock", what: "Start a new batch: bird type, breed, placement count and date." },
  { path: "/app/record", label: "Record data", what: "The daily entry form — deaths, culls, eggs, feed, water, weight, notes — for one flock on one day.", restricted: "hidden for read-only accounts" },
  { path: "/app/production", label: "Production", what: "Egg, feed and mortality trends over time, across the farm." },
  { path: "/app/health", label: "Health", what: "Vaccination schedule and health events, by flock.", restricted: "needs the farm's plan to include vaccinations" },
  { path: "/app/tasks", label: "Tasks", what: "To-dos assigned to people on the farm's account." },
  { path: "/app/feed", label: "Feed", what: "Feed stock specifically, with a 30-day consumption chart and days-remaining at the current rate. The same stock ledger as Inventory, filtered to feed." },
  { path: "/app/inventory", label: "Inventory", what: "Every stock category — feed, vaccine, medication, equipment, packaging, cleaning — with purchase/usage history and reorder alerts.", restricted: "advanced mode only, needs the inventory plan feature" },
  { path: "/app/sales", label: "Sales", what: "Quotations, invoices, orders and receipts — the documents sent to customers.", restricted: "owner, manager, accountant or sales role; needs the invoicing plan feature" },
  { path: "/app/products", label: "Products", what: "What the farm sells and at what price — eggs, birds, manure and so on.", restricted: "owner, manager, accountant or sales role; needs the invoicing plan feature" },
  { path: "/app/customers", label: "Customers", what: "Buyer records and their balances.", restricted: "advanced mode; owner, manager, accountant or sales role; needs the invoicing plan feature" },
  { path: "/app/finance", label: "Finance", what: "Expenses and the farm's money summary — revenue, profit, margin.", restricted: "owner, manager, accountant or sales role" },
  { path: "/app/assistant", label: "edos.ai", what: "This chat, plus an Analysis tab with the automatic farm review — everything currently outside its target, in one place." },
  { path: "/app/reports", label: "Reports", what: "Exportable spreadsheets of production, flocks, sales and expenses.", restricted: "advanced mode only, needs the reports plan feature" },
  { path: "/app/analytics", label: "Analytics", what: "Production, mortality, weight and FCR trends benchmarked against targets, with period comparison.", restricted: "advanced mode only, needs the benchmarking plan feature" },
  { path: "/app/team", label: "Team", what: "Invite people to the farm's account and set their role.", restricted: "owner only" },
  { path: "/app/settings", label: "Settings", what: "Farm details, branding, currency and the simple/advanced mode switch.", restricted: "owner only" },
];
