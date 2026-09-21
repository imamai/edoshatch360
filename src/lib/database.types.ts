/**
 * Hand-maintained types for the EDOS Hatch360 slice of the shared database.
 *
 * This file deliberately covers ONLY the `edoshatch360_*` tables. The same
 * Postgres database also hosts an unrelated live POS application whose
 * unprefixed tables are none of this codebase's business — generating types
 * for the whole schema would pull thousands of lines of someone else's model
 * into our type surface and invite accidental cross-writes.
 *
 * Keep this in lockstep with supabase/migrations/*.sql by hand.
 */

export type Role =
  | "owner" | "manager" | "supervisor" | "worker"
  | "vet" | "accountant" | "sales" | "viewer";

export type BirdType =
  | "broiler" | "layer" | "kienyeji" | "improved_kienyeji"
  | "breeder" | "chick" | "pullet" | "turkey" | "other";

export type FlockStatus =
  | "planned" | "brooding" | "growing" | "laying"
  | "finishing" | "harvested" | "closed";

export type EntryFrequency = "daily" | "weekly" | "milestone";
export type FarmMode = "simple" | "advanced";

export type HealthEvent =
  | "disease_incident" | "vet_visit" | "treatment"
  | "mortality_cause" | "observation";

export type InventoryCategory =
  | "feed" | "vaccine" | "medication" | "equipment"
  | "packaging" | "cleaning" | "spare_parts" | "other";

export type StockTxn = "opening" | "purchase" | "usage" | "adjustment" | "wastage" | "transfer";

export type CustomerType =
  | "individual" | "retailer" | "wholesaler" | "hotel"
  | "restaurant" | "school" | "distributor" | "other";

export type ProductCategory =
  | "eggs" | "live_birds" | "processed_birds" | "spent_layers"
  | "chicks" | "manure" | "feed" | "other";

export type DocType = "quotation" | "order" | "invoice" | "receipt";
export type SaleStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
export type PayMethod = "cash" | "mpesa" | "bank" | "credit" | "cheque" | "other";

export type ExpenseCategory =
  | "feed" | "chicks" | "vaccines" | "medication" | "labour" | "electricity"
  | "water" | "transport" | "repairs" | "equipment" | "rent" | "marketing" | "other";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type Priority = "low" | "normal" | "high" | "urgent";
export type Severity = "info" | "attention" | "critical";

export type NoticeCategory =
  | "critical" | "health" | "production" | "inventory" | "finance" | "task" | "system";

export type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";

// ------------------------------------------------------------------ rows --

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  mode: FarmMode;
  country: string;
  currency: string;
  timezone: string;
  logo_url: string | null;
  brand_color: string | null;
  kra_pin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  locale: string;
  is_platform_admin: boolean;
  last_tenant_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: Role;
  status: "active" | "invited" | "suspended";
  invited_by: string | null;
  created_at: string;
}

export interface Farm {
  id: string;
  tenant_id: string;
  name: string;
  location: string | null;
  county: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface House {
  id: string;
  tenant_id: string;
  farm_id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  house_type: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Flock {
  id: string;
  tenant_id: string;
  farm_id: string;
  house_id: string | null;
  code: string;
  name: string | null;
  bird_type: BirdType;
  breed: string | null;
  placement_date: string;
  placement_count: number;
  current_count: number;
  source_hatchery: string | null;
  cost_per_bird_cents: number;
  expected_harvest_date: string | null;
  status: FlockStatus;
  entry_frequency: EntryFrequency;
  photo_url: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyRecord {
  id: string;
  tenant_id: string;
  flock_id: string;
  record_date: string;
  mortality: number;
  culls: number;
  birds_sold: number;
  eggs_collected: number | null;
  eggs_broken: number | null;
  eggs_rejected: number | null;
  feed_consumed_kg: number | null;
  water_consumed_liters: number | null;
  avg_weight_grams: number | null;
  weight_highest_grams: number | null;
  weight_lowest_grams: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  notes: string | null;
  photo_url: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightBenchmark {
  id: string;
  bird_type: BirdType;
  breed: string;
  age_days: number;
  weight_low_grams: number;
  weight_high_grams: number;
  source: string;
}

export interface Vaccination {
  id: string;
  tenant_id: string;
  flock_id: string;
  vaccine: string;
  disease_target: string | null;
  day_of_age: number | null;
  due_date: string;
  status: "due" | "done" | "skipped" | "overdue";
  administered_on: string | null;
  administered_by: string | null;
  route: string | null;
  dose: string | null;
  birds_covered: number | null;
  cost_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Who supervised, when that is a different person from the administrator. */
  supervised_by: string | null;
  /** Free-text names, for a visiting vet or casual worker with no account. */
  administered_name: string | null;
  supervisor_name: string | null;
  manufacturer: string | null;
  /** Vial batch number, so a bad batch can be traced across flocks. */
  batch_no: string | null;
  expiry_date: string | null;
  reaction_notes: string | null;
}

export interface Medication {
  id: string;
  tenant_id: string;
  flock_id: string;
  product_name: string;
  reason: string | null;
  started_on: string;
  ended_on: string | null;
  dosage: string | null;
  route: string | null;
  withdrawal_days: number;
  withdrawal_until: string;
  administered_by: string | null;
  cost_cents: number;
  notes: string | null;
  created_at: string;
}

export interface HealthRecord {
  id: string;
  tenant_id: string;
  flock_id: string;
  event_type: HealthEvent;
  occurred_on: string;
  title: string;
  symptoms: string | null;
  diagnosis: string | null;
  treatment: string | null;
  birds_affected: number | null;
  severity: "low" | "medium" | "high" | "critical" | null;
  vet_name: string | null;
  cost_cents: number;
  photo_url: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  farm_id: string | null;
  category: InventoryCategory;
  name: string;
  sku: string | null;
  unit: string;
  current_stock: number;
  reorder_level: number;
  unit_cost_cents: number;
  supplier: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryTxn {
  id: string;
  tenant_id: string;
  item_id: string;
  txn_type: StockTxn;
  quantity: number;
  unit_cost_cents: number;
  total_cents: number;
  reference: string | null;
  flock_id: string | null;
  house_id: string | null;
  occurred_on: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  customer_type: CustomerType;
  credit_limit_cents: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  category: ProductCategory;
  unit: string;
  default_price_cents: number;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Sale {
  id: string;
  tenant_id: string;
  farm_id: string | null;
  customer_id: string | null;
  doc_type: DocType;
  doc_number: string;
  sale_date: string;
  due_date: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  balance_cents: number;
  payment_method: PayMethod | null;
  status: SaleStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: string;
  tenant_id: string;
  sale_id: string;
  product_id: string | null;
  flock_id: string | null;
  description: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  line_total_cents: number;
  sort_order: number;
}

export interface CustomerPayment {
  id: string;
  tenant_id: string;
  sale_id: string;
  amount_cents: number;
  method: PayMethod;
  reference: string | null;
  paid_at: string;
  received_by: string | null;
  notes: string | null;
}

export interface Expense {
  id: string;
  tenant_id: string;
  farm_id: string | null;
  flock_id: string | null;
  category: ExpenseCategory;
  description: string;
  amount_cents: number;
  expense_date: string;
  vendor: string | null;
  payment_method: PayMethod | null;
  reference: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  farm_id: string | null;
  house_id: string | null;
  flock_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  assignee_id: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  photo_url: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  category: NoticeCategory;
  severity: Severity;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_period: "month" | "year";
  max_farms: number | null;
  max_houses: number | null;
  max_birds: number | null;
  max_users: number | null;
  features: string[];
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubStatus;
  started_at: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantSetting {
  id: string;
  tenant_id: string;
  key: string;
  value: Record<string, unknown>;
  updated_by: string | null;
  updated_at: string;
}

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  is_published: boolean;
  updated_at: string;
}

export interface CmsSection {
  id: string;
  page_id: string;
  section_key: string;
  sort_order: number;
  eyebrow: string | null;
  heading: string | null;
  subheading: string | null;
  body: string | null;
  image_url: string | null;
  image_alt: string | null;
  cta_label: string | null;
  cta_href: string | null;
  data: unknown[];
  is_visible: boolean;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  location: string | null;
  quote: string;
  avatar_url: string | null;
  rating: number | null;
  sort_order: number;
  is_published: boolean;
}

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

// --------------------------------------------------------------- derived --

/** Shape returned by the edoshatch360_flock_metrics(uuid) RPC. */
export interface FlockMetrics {
  flock_id: string;
  code: string;
  bird_type: BirdType;
  status: FlockStatus;
  age_days: number;
  placed: number;
  current: number;
  mortality: number;
  culls: number;
  birds_sold: number;
  mortality_pct: number;
  eggs_total: number;
  eggs_broken: number;
  eggs_rejected: number;
  eggs_saleable: number;
  eggs_last_7: number;
  lay_pct: number | null;
  feed_kg: number;
  feed_last_7_kg: number;
  water_liters: number;
  avg_weight_g: number | null;
  fcr: number | null;
  adg_g: number | null;
  days_recorded: number;
  last_record_date: string | null;
  recording_rate: number;
}

export interface HealthComponent {
  key: string;
  label: string;
  value: number;
  unit: string;
  target: number;
  score: number;
}

/** Shape returned by the edoshatch360_farm_health(uuid) RPC. */
export interface FarmHealth {
  farm_id: string;
  score: number | null;
  band: "excellent" | "good" | "attention" | "critical" | "unknown";
  components: HealthComponent[];
  reason?: string | null;
}
