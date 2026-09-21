import { BENCHMARK } from "./insights";

/**
 * Terms used inside EDOS Hatch360, in plain words.
 *
 * The benchmark figures below are read from BENCHMARK rather than typed in
 * again, for the same reason insights.ts gives for that constant existing at
 * all: one number, so the glossary can never quote a target that disagrees
 * with the one the record form and the automatic review actually use.
 *
 * edos.ai reads this list as a tool result — it can explain a term that is
 * in it, but it must not invent a definition for one that isn't.
 */

export interface GlossaryTerm {
  term: string;
  meaning: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: "FCR (Feed Conversion Ratio)", meaning: `Kilograms of feed used for every kilogram of live bird weight standing. Lower is better — around ${BENCHMARK.fcr} is a healthy target.` },
  { term: "Hen-day production (lay rate)", meaning: `Eggs collected divided by the number of live hens, per day, as a percentage — not eggs per hen per week or per cycle. Around ${BENCHMARK.layPct}% is a strong target at peak.` },
  { term: "ADG (Average Daily Gain)", meaning: "Grams a bird gains per day on average, worked out from a ~40 g day-old chick to its most recent weighing." },
  { term: "Mortality", meaning: "Birds that died on their own — not birds removed on purpose, which are culls." },
  { term: "Culls", meaning: "Birds removed from the flock deliberately — a runt, an injured or a sick bird taken out — counted separately from mortality even though both reduce the live count." },
  { term: "Birds sold", meaning: "Live birds that left the flock because they were sold, not because they died or were culled." },
  { term: "Recording rate", meaning: "The share of days since a flock was placed that actually have a daily record. It measures how complete the record-keeping is, not the health of the birds." },
  { term: "Placement", meaning: "The day a batch of birds arrived and how many arrived — the starting point a flock's age, losses and gains are all measured from." },
  { term: "Flock code", meaning: "The short code identifying one batch, e.g. RUI-LAY-001 — the farm's initials, the bird type, the breed, then a sequence number." },
  { term: "Bird type vs breed", meaning: "Bird type is the broad category (broiler, layer, kienyeji, improved kienyeji, breeder, chick, pullet, turkey). Breed is the specific line within it — Cobb 500, Isa Brown, Kenbro, and so on." },
  { term: "Point of lay", meaning: "The age a pullet starts laying eggs — around 18 weeks for the commercial layer breeds this app has weight data for." },
  { term: "Expected weight", meaning: "What a flock's breed should weigh at its current age, taken from that breed's own published growth chart. Shown alongside the flock's own recorded weight, never in place of it, and only for breeds with a real published chart." },
  { term: "Opening stock / opening balance", meaning: "The starting quantity of a stock item, recorded as its first transaction rather than typed straight into a total — so the running stock figure always equals the sum of everything that happened to it." },
  { term: "Reorder level", meaning: "The stock quantity at or below which an item is flagged as needing to be bought again. Set to zero to turn the alert off for that item." },
  { term: "Stock movement", meaning: "Any change to how much of an item is held: bought (purchase), used on the farm (usage), spoiled or lost (wastage), moved between locations (transfer), or a manual correction (adjustment)." },
  { term: "Feed vs Inventory (the screens)", meaning: "The same stock ledger. Inventory shows every category (feed, vaccine, medication, equipment, packaging, cleaning); Feed shows the same records filtered to feed only, plus a consumption trend chart on top." },
  { term: "Simple vs advanced mode", meaning: "A farm-wide setting, changed in Settings. Simple hides screens a small farm may not need yet — Inventory, Reports, Analytics, Customers; advanced shows everything the farm's plan allows." },
  { term: "Margin", meaning: "Profit as a percentage of revenue. 15–30% is a healthy range for a poultry operation once feed is accounted for." },
  { term: "Debtors / receivables", meaning: "Money customers owe the farm — the unpaid balance still outstanding on invoices and receipts." },
  { term: "Quotation, order, invoice, receipt", meaning: "The stages a sale can move through: a quotation is a price offered, not yet a sale; an order and an invoice both request payment; a receipt confirms it was paid." },
  { term: "Egg breakage / rejected", meaning: "Eggs collected but broken, or rejected for being dirty, misshapen or undersized, before they could be sold — tracked separately from the eggs collected total." },
  { term: "Role", meaning: "What a person on the farm's account can do. Owner and manager can do everything; accountant and sales can see money; supervisor, worker and vet record daily data; viewer can only look, never write." },
  { term: "Tenant / organisation", meaning: "One farm's account on EDOS Hatch360 — its own flocks, records, stock and team, kept completely separate from every other farm's." },
];
