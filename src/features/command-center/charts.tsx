"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TEAL = "#0d9488";
const AMBER = "#f59e0b";
const RED = "#dc2626";

/** Completed vs In Process by property (portfolio bar chart). */
export function PropertyTasksBar({
  data,
}: {
  data: Array<{ name: string; completed: number; inProcess: number }>;
}) {
  return (
    <div className="h-[230px]" role="img" aria-label="Completed versus in-process tasks by property">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#e7eaee" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11.5, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
          <Bar dataKey="completed" name="Completed" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={42}>
            <LabelList dataKey="completed" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f766e" }} />
          </Bar>
          <Bar dataKey="inProcess" name="In Process" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={42}>
            <LabelList dataKey="inProcess" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#b45309" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

/** Donut with center stat + side legend (reference Command Center pattern). */
export function DonutStat({
  slices,
  centerValue,
  centerLabel,
  legendExtra,
  ariaLabel,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  legendExtra?: Array<{ name: string; value: number; color: string }>;
  ariaLabel: string;
}) {
  const nonEmpty = slices.filter((s) => s.value > 0);
  const display = nonEmpty.length > 0 ? nonEmpty : [{ name: "No data", value: 1, color: "#e7eaee" }];
  return (
    <div className="flex items-center gap-5" role="img" aria-label={ariaLabel}>
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={display}
              dataKey="value"
              nameKey="name"
              innerRadius="72%"
              outerRadius="100%"
              strokeWidth={0}
              isAnimationActive={false}
            >
              {display.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[22px] font-extrabold text-accent-dark">{centerValue}</span>
          <span className="text-[10px] tracking-wide text-muted uppercase">{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {[...slices, ...(legendExtra ?? [])].map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
            <span>{s.name}</span>
            <b className="font-mono">{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CHART_COLORS = { TEAL, AMBER, RED, BLUE: "#0369a1", GREY: "#94a3b8" };

/** Small bar chart for PropOne counts (e.g. Visits today/week/all-time). */
export function CountsBar({
  data,
  ariaLabel,
}: {
  data: Array<{ name: string; value: number }>;
  ariaLabel: string;
}) {
  return (
    <div className="h-[170px]" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#e7eaee" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "#f1f5f9" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="value" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList dataKey="value" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "#0f766e" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
