"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line,
  LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { AXIS_PROPS, CHART, SERIES, TOOLTIP_STYLE, dayTick } from "./theme";
import { formatMoney, formatNumber } from "@/lib/utils";

/** Shared empty state so a chart never renders as a blank rectangle. */
function NoData({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed border-line text-center text-xs text-ink-faint"
      style={{ height }}
    >
      <span className="max-w-[18rem] px-4 leading-relaxed">{message}</span>
    </div>
  );
}

/* ------------------------------------------------------- egg production -- */

export function EggTrendChart({
  data,
  height = 220,
}: {
  data: { date: string; eggs: number }[];
  height?: number;
}) {
  if (data.every((d) => d.eggs === 0)) {
    return (
      <NoData
        height={height}
        message="No egg collection recorded yet. Record a day and the trend appears here."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="eggFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.brandMid} stopOpacity={0.32} />
            <stop offset="100%" stopColor={CHART.brandMid} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayTick} {...AXIS_PROPS} minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v) => formatNumber(v, { compact: true })} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(l) => dayTick(String(l))}
          formatter={(v) => [formatNumber(Number(v)), "Eggs"]}
        />
        <Area
          type="monotone"
          dataKey="eggs"
          stroke={CHART.brand}
          strokeWidth={2}
          fill="url(#eggFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------ mortality -- */

export function MortalityChart({
  data,
  height = 180,
}: {
  data: { date: string; deaths: number }[];
  height?: number;
}) {
  if (data.every((d) => d.deaths === 0)) {
    return (
      <NoData
        height={height}
        message="No losses recorded in this period. That is the result you want here."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayTick} {...AXIS_PROPS} minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={36} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(l) => dayTick(String(l))}
          formatter={(v) => [formatNumber(Number(v)), "Birds lost"]}
        />
        <Bar dataKey="deaths" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => (
            // A spike is coloured as a spike: anything at or above twice the
            // period average reads as critical without needing a legend.
            <Cell
              key={i}
              fill={
                d.deaths >=
                2 * (data.reduce((a, x) => a + x.deaths, 0) / Math.max(1, data.length))
                  ? CHART.critical
                  : CHART.brandLight
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------------------------- feed -- */

export function FeedChart({
  data,
  height = 180,
}: {
  data: { date: string; kg: number }[];
  height?: number;
}) {
  if (data.every((d) => d.kg === 0)) {
    return <NoData height={height} message="No feed consumption recorded in this period." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={dayTick} {...AXIS_PROPS} minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={44} tickFormatter={(v) => `${formatNumber(v, { compact: true })}`} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={(l) => dayTick(String(l))}
          formatter={(v) => [`${formatNumber(Number(v), { decimals: 1 })} kg`, "Feed"]}
        />
        <Line
          type="monotone"
          dataKey="kg"
          stroke={CHART.gold}
          strokeWidth={2.2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------ money over time -- */

export function RevenueExpenseChart({
  data,
  currency = "KES",
  height = 220,
}: {
  data: { label: string; revenue: number; expenses: number }[];
  currency?: string;
  height?: number;
}) {
  if (data.every((d) => d.revenue === 0 && d.expenses === 0)) {
    return (
      <NoData
        height={height}
        message="No sales or expenses recorded yet. Record a sale and this fills in."
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -4 }}>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} />
        <YAxis
          {...AXIS_PROPS}
          width={62}
          tickFormatter={(v) => formatMoney(Number(v), { currency, compact: true })}
        />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, n) => [
            formatMoney(Number(v), { currency }),
            n === "revenue" ? "Revenue" : "Expenses",
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          formatter={(v) => (v === "revenue" ? "Revenue" : "Expenses")}
        />
        <Bar dataKey="revenue" fill={CHART.brand} radius={[3, 3, 0, 0]} maxBarSize={36} />
        <Bar dataKey="expenses" fill={CHART.gold} radius={[3, 3, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------------------- breakdowns -- */

export function BreakdownDonut({
  data,
  currency,
  height = 220,
  unitLabel,
}: {
  data: { name: string; value: number }[];
  currency?: string;
  height?: number;
  unitLabel?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (total === 0) {
    return <NoData height={height} message="Nothing to break down for this period yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="52%"
          outerRadius="80%"
          paddingAngle={2}
          stroke={CHART.surface}
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v, n) => [
            currency
              ? formatMoney(Number(v), { currency })
              : `${formatNumber(Number(v))}${unitLabel ? ` ${unitLabel}` : ""}`,
            String(n),
          ]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 11, lineHeight: "18px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ----------------------------------------------- comparison across items -- */

export function ComparisonBars({
  data,
  height = 200,
  unitLabel,
}: {
  data: { name: string; value: number }[];
  height?: number;
  unitLabel?: string;
}) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return <NoData height={height} message="Not enough recorded data to compare yet." />;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid stroke={CHART.grid} horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={(v) => formatNumber(v, { compact: true })} />
        <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={96} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(v) => [
            `${formatNumber(Number(v))}${unitLabel ? ` ${unitLabel}` : ""}`,
            "",
          ]}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
