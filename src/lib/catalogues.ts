import type { BirdType, InventoryCategory } from "@/lib/database.types";

/**
 * Pick-lists for the things farmers were previously typing by hand.
 *
 * Free text is how a system ends up with "Layers Mash", "layers mash" and
 * "LAYER MASH" as three different stock items that never reconcile. Every
 * list here ends with an "Other" escape so an unusual product is still
 * possible — the point is to make the common answer the easy one, not to
 * refuse the uncommon one.
 *
 * Names follow how these products are actually sold in Kenya.
 */

export const OTHER = "__other__";

/* ------------------------------------------------------------------ feed -- */

export const FEED_TYPES = [
  { group: "Chicks & growers", items: [
    "Chick mash (0–8 weeks)",
    "Chick & duck mash",
    "Growers mash (9–18 weeks)",
    "Pullet developer",
  ]},
  { group: "Layers", items: [
    "Layers mash",
    "Layers pellets",
    "Breeder mash",
  ]},
  { group: "Broilers", items: [
    "Broiler starter crumbs",
    "Broiler grower",
    "Broiler finisher",
  ]},
  { group: "Kienyeji", items: [
    "Kienyeji chick mash",
    "Kienyeji growers mash",
    "Kienyeji layers mash",
  ]},
  { group: "Raw materials & supplements", items: [
    "Maize germ",
    "Wheat bran (pollard)",
    "Sunflower cake",
    "Soya meal",
    "Omena / fishmeal",
    "Cotton seed cake",
    "Limestone / oyster shell",
    "Bone meal",
    "Vitamin premix",
    "Toxin binder",
  ]},
];

/* -------------------------------------------------------------- vaccines -- */

export const VACCINE_TYPES = [
  { group: "Newcastle disease", items: [
    "Newcastle (NDV) — Hitchner B1",
    "Newcastle (NDV) — Lasota",
    "Newcastle (NDV) — I-2 thermostable",
    "Newcastle + Infectious bronchitis combined",
  ]},
  { group: "Gumboro & bronchitis", items: [
    "Infectious bursal disease (Gumboro) — intermediate",
    "Infectious bursal disease (Gumboro) — intermediate plus",
    "Infectious bronchitis (IB) — H120",
  ]},
  { group: "Other diseases", items: [
    "Fowl pox",
    "Fowl typhoid",
    "Marek's disease",
    "Infectious coryza",
    "Fowl cholera",
    "Avian encephalomyelitis",
    "Deworming (not a vaccine)",
  ]},
];

export const VACCINE_ROUTES = [
  "Drinking water",
  "Eye drop",
  "Nasal drop",
  "Beak dip",
  "Spray / aerosol",
  "Wing web stab",
  "Subcutaneous injection",
  "Intramuscular injection",
  "Feed",
];

/* ------------------------------------------------------------ medication -- */

export const MEDICATION_TYPES = [
  { group: "Antibiotics", items: [
    "Oxytetracycline",
    "Amprolium",
    "Enrofloxacin",
    "Tylosin",
    "Sulphonamide",
  ]},
  { group: "Coccidiosis", items: [
    "Amprolium (coccidiostat)",
    "Toltrazuril",
    "Sulphaquinoxaline",
  ]},
  { group: "Supplements & other", items: [
    "Multivitamin",
    "Vitamin + electrolytes",
    "Liver tonic",
    "Dewormer — piperazine",
    "Dewormer — levamisole",
    "Probiotic",
  ]},
];

/* ------------------------------------------------------------------ misc -- */

export const EQUIPMENT_TYPES = [
  { group: "Feeding & watering", items: [
    "Tube feeder",
    "Chick feeder tray",
    "Drinker — 5 litre",
    "Drinker — 10 litre",
    "Nipple drinker line",
    "Automatic feeder",
  ]},
  { group: "Housing", items: [
    "Brooder lamp",
    "Infrared bulb",
    "Gas brooder",
    "Nest box",
    "Laying cage",
    "Chick guard",
    "Wood shavings (litter)",
  ]},
];

export const PACKAGING_TYPES = [
  { group: "Packaging", items: [
    "Egg tray (30 eggs)",
    "Egg crate",
    "Feed sack",
    "Crate — live birds",
    "Polythene bags",
    "Labels",
  ]},
];

export const CLEANING_TYPES = [
  { group: "Cleaning & biosecurity", items: [
    "Disinfectant",
    "Footbath disinfectant",
    "Formalin",
    "Lime powder",
    "Detergent",
    "Fumigation tablets",
  ]},
];

/** Which pick-list belongs to which stock category. */
export function itemsForCategory(
  category: InventoryCategory,
): { group: string; items: string[] }[] {
  switch (category) {
    case "feed": return FEED_TYPES;
    case "vaccine": return VACCINE_TYPES;
    case "medication": return MEDICATION_TYPES;
    case "equipment": return EQUIPMENT_TYPES;
    case "packaging": return PACKAGING_TYPES;
    case "cleaning": return CLEANING_TYPES;
    default: return [];
  }
}

/* ------------------------------------------------------------------ units -- */

export const UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "bag 50kg", label: "Bag — 50 kg" },
  { value: "bag 70kg", label: "Bag — 70 kg" },
  { value: "tonne", label: "Tonne" },
  { value: "litre", label: "Litre" },
  { value: "ml", label: "Millilitre (ml)" },
  { value: "dose", label: "Dose" },
  { value: "vial", label: "Vial" },
  { value: "sachet", label: "Sachet" },
  { value: "tray", label: "Tray" },
  { value: "piece", label: "Piece" },
  { value: "bale", label: "Bale" },
];

/* ------------------------------------------------------------- breeds -- */

/** Breeds actually sold in Kenya, by bird type. */
export const BREEDS: Partial<Record<BirdType, string[]>> = {
  broiler: ["Cobb 500", "Ross 308", "Arbor Acres", "Hubbard", "Indian River"],
  layer: ["Isa Brown", "Hy-Line Brown", "Lohmann Brown", "Bovans Brown", "Shaver Brown", "White Leghorn"],
  kienyeji: ["Indigenous", "Kuchi", "Naked neck", "Frizzled"],
  improved_kienyeji: ["KARI Improved Kienyeji", "Kuroiler", "Sasso", "Rainbow Rooster", "Kenbro"],
  breeder: ["Cobb 500 parent stock", "Ross 308 parent stock", "Isa Brown parent stock"],
  chick: ["Cobb 500", "Ross 308", "Isa Brown", "KARI Improved Kienyeji", "Kuroiler"],
  pullet: ["Isa Brown", "Hy-Line Brown", "Lohmann Brown", "Bovans Brown"],
  turkey: ["Broad Breasted White", "Broad Breasted Bronze", "Indigenous turkey"],
};

/** Codes used in generated batch numbers; mirrors the database function. */
export const BIRD_TYPE_CODE: Record<BirdType, string> = {
  broiler: "BRO",
  layer: "LAY",
  kienyeji: "KIE",
  improved_kienyeji: "IKI",
  breeder: "BRE",
  chick: "CHK",
  pullet: "PUL",
  turkey: "TUR",
  other: "OTH",
};

/**
 * The prefix a new flock's code will carry. Mirrors
 * edoshatch360_flock_code_prefix() so the form can preview it before saving;
 * the database remains the authority on the sequence number.
 */
export function flockCodePrefix(farmName: string, birdType: BirdType): string {
  const farm =
    farmName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "FRM";
  return `${farm}-${BIRD_TYPE_CODE[birdType]}`;
}
