import type { AnalysisInput, Evidence, Insight } from "./insights";
import { analyseFarm } from "./insights";
import { NAV_HELP } from "./navigation";
import { GLOSSARY } from "./glossary";
import { computeKpis, daySeries } from "@/lib/data/dashboard";
import { addDays, formatMoney, formatNumber, formatPercent, today } from "@/lib/utils";

/**
 * Answers a farmer's question from their own records.
 *
 * This is intent matching over the farm's data, not a language model. It says
 * so in the interface, because the difference matters: every figure below can
 * be traced to a row the farmer entered, and the assistant declines rather
 * than improvising when a question falls outside what the records can answer.
 *
 * The shape here — a question in, an answer plus the evidence behind it out —
 * is also exactly what a language-model layer would need if one is added: the
 * model would phrase these facts, never source them.
 */

export interface Answer {
  body: string;
  evidence: Evidence[];
  insights: Insight[];
  /** Set when the honest response is "ask a vet", per spec §35. */
  needsVet?: boolean;
}

type Matcher = { keys: RegExp; handler: (i: AnalysisInput) => Answer };

const has = (...words: string[]) =>
  new RegExp(`\\b(${words.join("|")})`, "i");

function fromInsights(insights: Insight[], intro: string): Answer {
  if (insights.length === 0) {
    return { body: intro, evidence: [], insights: [] };
  }
  return {
    body: intro,
    evidence: insights[0].evidence,
    insights,
    needsVet: insights.some((i) => i.needsVet),
  };
}

const MATCHERS: Matcher[] = [
  /* --------------------------------------------------------- glossary -- */
  // Checked first: "define mortality" or "what does FCR mean" must not fall
  // through to the mortality or FCR-adjacent data matchers below just
  // because the term appears in both the question and their keyword list.
  {
    keys: has("what does", "meaning of", "define", "definition of", "difference between", "what's fcr", "what is fcr"),
    handler: () => ({
      body: "Here is what these terms mean in EDOS Hatch360:",
      evidence: GLOSSARY.map((g) => ({ label: g.term, value: g.meaning })),
      insights: [],
    }),
  },

  /* ------------------------------------------------------------ money -- */
  {
    keys: has("money", "profit", "margin", "revenue", "earning", "loss", "income", "finance"),
    handler: (input) => {
      if (!input.canSeeMoney) {
        return {
          body: "Your account does not have access to the farm's financial records, so I cannot answer that one. An owner or the accountant can.",
          evidence: [],
          insights: [],
        };
      }
      const k = computeKpis(input.data);
      const c = input.currency;

      if (k.revenueCents === 0 && k.expensesCents === 0) {
        return {
          body: "There are no sales or expenses recorded for this month yet, so there is nothing to work out. Record a sale or an expense and I can tell you where you stand.",
          evidence: [],
          insights: [],
        };
      }

      const verdict =
        k.profitCents < 0
          ? "You are currently spending more than you are taking in."
          : `You are ahead by ${formatMoney(k.profitCents, { currency: c })} so far this month.`;

      return {
        body: `${verdict} Revenue this month is ${formatMoney(k.revenueCents, { currency: c })} against ${formatMoney(k.expensesCents, { currency: c })} of costs, a margin of ${formatPercent(k.marginPct)}. A poultry operation running healthily usually sits between 15% and 30% once feed is accounted for.`,
        evidence: [
          { label: "Revenue this month", value: formatMoney(k.revenueCents, { currency: c }) },
          { label: "Expenses this month", value: formatMoney(k.expensesCents, { currency: c }) },
          { label: "Profit", value: formatMoney(k.profitCents, { currency: c }) },
          { label: "Margin", value: formatPercent(k.marginPct), target: "15–30%" },
        ],
        insights: analyseFarm(input).filter((i) => ["margin", "feed-share", "revenue-change", "receivables"].includes(i.id)),
      };
    },
  },

  /* -------------------------------------------------------------- feed -- */
  {
    keys: has("feed", "mash", "stock", "reorder", "ration", "running out"),
    handler: (input) => {
      const days = daySeries(input.data, 30);
      const activeDays = days.filter((d) => d.kg > 0).length;
      const dailyFeed = days.reduce((a, d) => a + d.kg, 0) / Math.max(1, activeDays);
      const feedItems = input.data.lowStock.filter((i) => i.category === "feed");

      if (activeDays === 0) {
        return {
          body: "No feed consumption has been recorded, so I cannot work out how long your stock will last. Record feed used on the daily entry screen and I can start forecasting it.",
          evidence: [],
          insights: [],
        };
      }

      const lines = feedItems.length
        ? feedItems
            .map((i) => {
              const runway = dailyFeed > 0 ? Math.floor(i.current_stock / dailyFeed) : null;
              return `${i.name} is at ${formatNumber(i.current_stock, { decimals: 0 })} ${i.unit}${runway !== null ? ` — about ${runway} day${runway === 1 ? "" : "s"} left` : ""}`;
            })
            .join("; ")
        : "Nothing is below its reorder level right now";

      return {
        body: `You are feeding about ${formatNumber(dailyFeed, { decimals: 0 })} kg a day across the farm. ${lines}.`,
        evidence: [
          { label: "Average daily feed", value: `${formatNumber(dailyFeed, { decimals: 1 })} kg` },
          { label: "Items below reorder level", value: String(input.data.lowStock.length) },
          { label: "Fed in last 7 days", value: `${formatNumber(days.slice(-7).reduce((a, d) => a + d.kg, 0), { decimals: 0 })} kg` },
        ],
        insights: analyseFarm(input).filter((i) => i.id.startsWith("stock-") || i.id.startsWith("fcr-")),
      };
    },
  },

  /* ---------------------------------------------------------- mortality -- */
  {
    keys: has("mortality", "dying", "died", "death", "deaths", "losing birds", "losses"),
    handler: (input) => {
      const k = computeKpis(input.data);
      const t = today();
      const deaths7 = input.data.records
        .filter((r) => r.record_date > addDays(t, -7))
        .reduce((a, r) => a + r.mortality + r.culls, 0);

      const worst = [...input.metrics]
        .filter((m) => m.metrics)
        .sort((a, b) => (b.metrics!.mortality_pct ?? 0) - (a.metrics!.mortality_pct ?? 0))[0];

      return {
        body: `Across all active flocks you have lost ${formatPercent(k.mortalityPct)} of the birds placed, and ${formatNumber(deaths7)} in the last seven days.${worst?.metrics ? ` The highest is ${worst.flock.code} at ${formatPercent(worst.metrics.mortality_pct)}.` : ""} Anything above 5% across a cycle is worth investigating.`,
        evidence: [
          { label: "Mortality to date", value: formatPercent(k.mortalityPct), target: "5%" },
          { label: "Lost in last 7 days", value: formatNumber(deaths7) },
          { label: "Birds remaining", value: formatNumber(k.totalBirds) },
        ],
        insights: analyseFarm(input).filter((i) => i.id.startsWith("mortality-") || i.id.startsWith("spike-")),
        needsVet: k.mortalityPct > 5 || deaths7 > 0,
      };
    },
  },

  /* --------------------------------------------------------------- eggs -- */
  {
    keys: has("egg", "eggs", "laying", "lay rate", "production", "hen.?day"),
    handler: (input) => {
      const t = today();
      const week = input.data.records.filter((r) => r.record_date > addDays(t, -7));
      const collected = week.reduce((a, r) => a + (r.eggs_collected ?? 0), 0);
      const broken = week.reduce((a, r) => a + (r.eggs_broken ?? 0), 0);
      const rejected = week.reduce((a, r) => a + (r.eggs_rejected ?? 0), 0);

      const layers = input.metrics.filter((m) => m.metrics?.lay_pct !== null && m.metrics?.lay_pct !== undefined);

      if (collected === 0) {
        return {
          body: "No eggs have been recorded in the last seven days. If you have laying birds, record a collection and I can tell you your hen-day rate and how it is trending.",
          evidence: [],
          insights: [],
        };
      }

      const best = [...layers].sort((a, b) => (b.metrics!.lay_pct ?? 0) - (a.metrics!.lay_pct ?? 0))[0];

      return {
        body: `You collected ${formatNumber(collected)} eggs in the last seven days, of which ${formatNumber(Math.max(0, collected - broken - rejected))} were saleable. ${best?.metrics?.lay_pct ? `${best.flock.code} is your strongest layer at ${formatPercent(best.metrics.lay_pct)} hen-day production, against a target of 85%.` : ""}`,
        evidence: [
          { label: "Collected (7 days)", value: formatNumber(collected) },
          { label: "Broken", value: formatNumber(broken) },
          { label: "Rejected", value: formatNumber(rejected) },
          ...(best?.metrics?.lay_pct
            ? [{ label: `${best.flock.code} hen-day`, value: formatPercent(best.metrics.lay_pct), target: "85%" }]
            : []),
        ],
        insights: analyseFarm(input).filter(
          (i) => i.id.startsWith("lay-") || i.id.startsWith("breakage-"),
        ),
      };
    },
  },

  /* -------------------------------------------------------- what is due -- */
  {
    keys: has("due", "vaccination", "vaccine", "schedule", "this week", "reminder", "task"),
    handler: (input) => {
      const t = today();
      const overdue = input.data.dueVaccinations.filter((v) => v.due_date < t);
      const soon = input.data.dueVaccinations.filter((v) => v.due_date >= t);

      if (overdue.length === 0 && soon.length === 0) {
        return {
          body: "Nothing is due or overdue in the next seven days. If a flock has no programme set up at all, that is worth doing on the Health screen.",
          evidence: [],
          insights: [],
        };
      }

      return {
        body: `${overdue.length > 0 ? `${overdue.length} dose${overdue.length > 1 ? "s are" : " is"} overdue. ` : ""}${soon.length > 0 ? `${soon.length} more ${soon.length > 1 ? "are" : "is"} due within the week.` : ""}`,
        evidence: [...overdue, ...soon].slice(0, 6).map((v) => ({
          label: v.vaccine,
          value: v.due_date < t ? `overdue since ${v.due_date}` : `due ${v.due_date}`,
        })),
        insights: analyseFarm(input).filter((i) => i.id === "vacc-overdue"),
        needsVet: overdue.length > 0,
      };
    },
  },

  /* ------------------------------------------------------------ debtors -- */
  {
    keys: has("owe", "owes", "owing", "debt", "credit", "unpaid", "customer", "invoice"),
    handler: (input) => {
      if (!input.canSeeMoney) {
        return {
          body: "Your account does not have access to sales records, so I cannot answer that. An owner, the accountant or a sales officer can.",
          evidence: [],
          insights: [],
        };
      }
      const t = today();
      const open = input.data.sales.filter((s) => s.balance_cents > 0 && s.doc_type !== "quotation");
      const owed = open.reduce((a, s) => a + s.balance_cents, 0);
      const late = open.filter((s) => s.due_date && s.due_date < t);

      if (owed === 0) {
        return {
          body: "Nobody owes you anything right now — every invoice and receipt is settled.",
          evidence: [],
          insights: [],
        };
      }

      return {
        body: `${formatMoney(owed, { currency: input.currency })} is outstanding across ${open.length} document${open.length > 1 ? "s" : ""}${late.length > 0 ? `, of which ${late.length} ${late.length > 1 ? "are" : "is"} past the due date` : ""}.`,
        evidence: open.slice(0, 5).map((s) => ({
          label: s.doc_number,
          value: formatMoney(s.balance_cents, { currency: input.currency }),
        })),
        insights: analyseFarm(input).filter((i) => i.id === "receivables"),
      };
    },
  },

  /* ------------------------------------------------- which flock / worst -- */
  {
    keys: has("which flock", "worst", "attention", "problem", "worry", "concern", "wrong"),
    handler: (input) => {
      const insights = analyseFarm(input).filter((i) => i.tone === "urgent" || i.tone === "watch");
      if (insights.length === 0) {
        return {
          body: "Nothing in your records is outside its target at the moment — no flock is above 5% mortality, no stock is below its reorder level, and no vaccination is overdue.",
          evidence: [],
          insights: [],
        };
      }
      return fromInsights(
        insights,
        `${insights.length} thing${insights.length > 1 ? "s" : ""} in your records ${insights.length > 1 ? "are" : "is"} outside target. The most pressing is below.`,
      );
    },
  },

  /* ------------------------------------------------------- app itself -- */
  // Deliberately last: a data matcher above (money, feed, mortality...)
  // should win whenever a question could genuinely be either — "where is
  // my money" is almost always asking how much, not which screen shows it.
  {
    keys: has("where is", "where's", "where can i", "where do i", "how do i add", "how do i record", "how do i find", "how do i create", "how do i invite", "which screen", "which page", "navigate"),
    handler: () => ({
      body: "Here is where to find things in EDOS Hatch360:",
      evidence: NAV_HELP.map((n) => ({
        label: n.label,
        value: n.restricted ? `${n.path} — ${n.restricted}` : n.path,
      })),
      insights: [],
    }),
  },
];

/** The catch-all: a full review of the farm. */
function overallAnswer(input: AnalysisInput): Answer {
  const k = computeKpis(input.data);
  const insights = analyseFarm(input);
  const urgent = insights.filter((i) => i.tone === "urgent").length;
  const watch = insights.filter((i) => i.tone === "watch").length;

  const evidence: Evidence[] = [
    { label: "Birds", value: formatNumber(k.totalBirds) },
    { label: "Active flocks", value: String(k.activeFlocks) },
    { label: "Mortality to date", value: formatPercent(k.mortalityPct), target: "5%" },
    { label: "Eggs today", value: formatNumber(k.eggsToday) },
  ];

  if (input.canSeeMoney && k.revenueCents > 0) {
    evidence.push({
      label: "Margin this month",
      value: formatPercent(k.marginPct),
      target: "15–30%",
    });
  }

  const summary =
    urgent > 0
      ? `${urgent} thing${urgent > 1 ? "s need" : " needs"} attention now${watch > 0 ? `, and ${watch} more ${watch > 1 ? "are" : "is"} worth watching` : ""}.`
      : watch > 0
        ? `Nothing urgent, but ${watch} thing${watch > 1 ? "s are" : " is"} worth watching.`
        : "Everything in your records is within its target.";

  return {
    body: `You have ${formatNumber(k.totalBirds)} birds across ${k.activeFlocks} active flock${k.activeFlocks === 1 ? "" : "s"}. ${summary}`,
    evidence,
    insights,
    needsVet: insights.some((i) => i.needsVet),
  };
}

/** Routes a question to the analysis that can answer it. */
export function answerQuestion(question: string, input: AnalysisInput): Answer {
  const q = question.trim();

  if (q.length === 0) return overallAnswer(input);

  for (const matcher of MATCHERS) {
    if (matcher.keys.test(q)) return matcher.handler(input);
  }

  // Nothing matched. Say so plainly rather than improvising an answer —
  // a confident-sounding guess about a farm is worse than no answer.
  const k = computeKpis(input.data);
  return {
    body: `I work only from the records on this farm, and I could not match that to something I can calculate. Try asking about mortality, eggs, feed, what is due this week, or money. Right now you have ${formatNumber(k.totalBirds)} birds across ${k.activeFlocks} flock${k.activeFlocks === 1 ? "" : "s"}.`,
    evidence: [],
    insights: [],
  };
}

/** A short title for a saved conversation, taken from its first question. */
export function titleFor(question: string): string {
  const clean = question.trim().replace(/\s+/g, " ");
  if (clean.length === 0) return "New conversation";
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}
