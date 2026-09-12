/**
 * One palette for every chart in the app, so a colour means the same thing on
 * the dashboard as it does in a report. Semantic hues (good/attention/
 * critical) are kept out of the categorical series — a red slice in an expense
 * breakdown must not read as "something is wrong".
 */
export const CHART = {
  brand: "#1b5e42",
  brandMid: "#2d7d57",
  brandLight: "#7fb69a",
  gold: "#e0a53c",
  good: "#2e7d52",
  attention: "#b45309",
  critical: "#b42318",
  info: "#1f6f8b",
  grid: "#e7e4da",
  axis: "#8f978f",
  ink: "#161a17",
  surface: "#ffffff",
} as const;

/** Categorical series colours, in the order they should be handed out. */
export const SERIES = [
  CHART.brand,
  CHART.gold,
  CHART.info,
  CHART.brandLight,
  CHART.attention,
  "#7c5cbf",
  "#b07a56",
  "#5a635c",
] as const;

export const AXIS_PROPS = {
  stroke: CHART.axis,
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: `1px solid ${CHART.grid}`,
    boxShadow: "0 8px 24px rgb(22 26 23 / 0.1)",
    fontSize: 12,
    padding: "8px 10px",
  },
  labelStyle: { color: CHART.ink, fontWeight: 600, marginBottom: 2 },
  cursor: { fill: "rgb(22 26 23 / 0.04)" },
} as const;

/** Short axis label for a YYYY-MM-DD date: "5 Sep". */
export function dayTick(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}
