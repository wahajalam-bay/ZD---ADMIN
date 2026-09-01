"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * Chart layer for the Bayut design system.
 * - palette: categorical --c1..--c8 (§2), sequential green for intensity
 * - premium tooltips only (§4) — never the native browser tooltip
 * - series labelled directly wherever it works, legends avoided (§3.10)
 * - click marks cross-filter / drill (§4) via `onSelect`
 */
export const PALETTE = {
  c1: "var(--c1)",
  c2: "var(--c2)",
  c3: "var(--c3)",
  c4: "var(--c4)",
  c5: "var(--c5)",
  c6: "var(--c6)",
  c7: "var(--c7)",
  c8: "var(--c8)",
  red: "var(--red)",
  track: "var(--neutral-track)",
  grid: "var(--grid)",
  muted: "var(--muted)",
} as const;

export const CATEGORICAL = [
  PALETTE.c1,
  PALETTE.c2,
  PALETTE.c3,
  PALETTE.c4,
  PALETTE.c5,
  PALETTE.c6,
  PALETTE.c7,
  PALETTE.c8,
];

// ── Premium tooltip (§4) ────────────────────────────────────────────────────

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  muted?: boolean;
}

export function PremiumTooltipCard({
  title,
  context,
  rows,
  footer,
}: {
  title: string;
  context?: string;
  rows: TooltipRow[];
  footer?: string;
}) {
  return (
    <div className="min-w-[168px] rounded-tile border border-line bg-panel px-3 py-2.5 shadow-panel">
      <div className="t-card text-[12px] text-ink">{title}</div>
      {context ? <div className="mt-0.5 text-[10.5px] text-muted">{context}</div> : null}
      <div className="mt-2 flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[11.5px]">
            {r.color ? (
              <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
            ) : null}
            <span className={cn("flex-1", r.muted ? "text-muted" : "text-ink")}>{r.label}</span>
            <span className="font-mono font-bold text-ink">{r.value}</span>
          </div>
        ))}
      </div>
      {footer ? <div className="mt-2 border-t border-line pt-1.5 text-[10.5px] text-muted">{footer}</div> : null}
    </div>
  );
}

interface RechartsTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; dataKey?: string | number; value?: number; color?: string; payload?: Record<string, unknown> }>;
}

export type TooltipRender = (
  label: string,
  items: Array<{ key: string; value: number; color: string }>,
  raw?: Record<string, unknown>,
) => React.ReactNode;

/**
 * Single static tooltip component (never created during render). Recharts
 * clones the element and injects `active`/`payload`; the chart supplies the
 * `render` prop describing what a premium tooltip should show.
 */
function TooltipRenderer({
  active,
  label,
  payload,
  render,
}: RechartsTooltipProps & { render: TooltipRender }) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.map((p) => ({
    key: String(p.name ?? p.dataKey ?? ""),
    value: Number(p.value ?? 0),
    color: p.color ?? PALETTE.c1,
  }));
  return <>{render(String(label ?? ""), items, payload[0]?.payload)}</>;
}

// ── Grouped bar: compare 2 series across categories (§3 comparison) ─────────

export function GroupedBar({
  data,
  onSelect,
  activeKey,
  height = 220,
  contextLabel,
}: {
  data: Array<{ name: string; completed: number; inProcess: number; key?: string }>;
  onSelect?: (key: string) => void;
  activeKey?: string | null;
  height?: number;
  contextLabel?: string;
}) {
  const renderTip = React.useCallback<TooltipRender>(
    (label, items) => {
        const total = items.reduce((a, b) => a + b.value, 0);
        const done = items.find((i) => i.key === "Completed")?.value ?? 0;
        return (
          <PremiumTooltipCard
            title={label}
            context={contextLabel}
            rows={[
              ...items.map((i) => ({ label: i.key, value: String(i.value), color: i.color })),
              {
                label: "Completion",
                value: total > 0 ? `${Math.round((done / total) * 100)}%` : "—",
                muted: true,
              },
            ]}
            footer={onSelect ? "Click a bar to filter this property" : undefined}
          />
        );
    },
    [contextLabel, onSelect],
  );

  return (
    <div style={{ height }} role="img" aria-label="Completed versus in-process tasks by property">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: -20, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke={PALETTE.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11.5, fontWeight: 600, fill: "var(--text)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10.5, fill: PALETTE.muted }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip content={<TooltipRenderer render={renderTip} />} cursor={{ fill: "var(--surface2)", opacity: 0.6 }} />
          <Bar
            dataKey="completed"
            name="Completed"
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
            onClick={(entry) => {
              const payload = (entry as { payload?: { key?: string; name?: string } }).payload;
              onSelect?.(payload?.key ?? payload?.name ?? "");
            }}
            cursor={onSelect ? "pointer" : undefined}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={PALETTE.c1}
                opacity={activeKey && (d.key ?? d.name) !== activeKey ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="completed"
              position="top"
              style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--c1)" }}
            />
          </Bar>
          <Bar
            dataKey="inProcess"
            name="In Process"
            radius={[4, 4, 0, 0]}
            maxBarSize={34}
            isAnimationActive={false}
            onClick={(entry) => {
              const payload = (entry as { payload?: { key?: string; name?: string } }).payload;
              onSelect?.(payload?.key ?? payload?.name ?? "");
            }}
            cursor={onSelect ? "pointer" : undefined}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={PALETTE.c3}
                opacity={activeKey && (d.key ?? d.name) !== activeKey ? 0.35 : 1}
              />
            ))}
            <LabelList
              dataKey="inProcess"
              position="top"
              style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--c3)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Direct series key (§3.10: label directly, not via legend) */}
      <div className="-mt-1 flex items-center justify-center gap-4 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: PALETTE.c1 }} aria-hidden />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[3px]" style={{ background: PALETTE.c3 }} aria-hidden />
          In Process
        </span>
      </div>
    </div>
  );
}

// ── Donut with centre label (§3 part-to-whole, ≤5 slices) ───────────────────

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  centerValue,
  centerLabel,
  size = 150,
  onSelect,
  activeName,
  contextLabel,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  onSelect?: (name: string) => void;
  activeName?: string | null;
  contextLabel?: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const nonEmpty = slices.filter((s) => s.value > 0);
  const display = nonEmpty.length > 0 ? nonEmpty : [{ name: "No data", value: 1, color: PALETTE.track }];

  const renderTip = React.useCallback<TooltipRender>(
    (label, items) => (
        <PremiumTooltipCard
          title={label}
          context={contextLabel}
          rows={[
            { label: "Count", value: String(items[0]?.value ?? 0), color: items[0]?.color },
            {
              label: "Share",
              value: total > 0 ? `${Math.round(((items[0]?.value ?? 0) / total) * 100)}%` : "—",
              muted: true,
            },
          ]}
          footer={onSelect ? "Click to filter" : undefined}
        />
    ),
    [contextLabel, total, onSelect],
  );

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={display}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              strokeWidth={0}
              isAnimationActive={false}
              onClick={(entry) => {
                const name = (entry as { name?: string }).name;
                if (name) onSelect?.(name);
              }}
              cursor={onSelect ? "pointer" : undefined}
            >
              {display.map((s, i) => (
                <Cell
                  key={i}
                  fill={s.color}
                  opacity={activeName && s.name !== activeName ? 0.35 : 1}
                />
              ))}
            </Pie>
            <Tooltip content={<TooltipRenderer render={renderTip} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[21px] leading-none font-bold text-ink">{centerValue}</span>
          <span className="t-label mt-1 text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="flex min-w-[120px] flex-col gap-1.5">
        {slices.map((s) => (
          <li key={s.name}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(s.name)}
              className={cn(
                "flex w-full items-center gap-2 rounded-input px-1.5 py-1 text-[12px] transition-colors",
                onSelect && "hover:bg-panel2",
                activeName === s.name && "bg-panel2 font-semibold",
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 text-start text-ink">{s.name}</span>
              <span className="font-mono font-bold text-ink">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Trend line / area (§3 trend) ────────────────────────────────────────────

export function TrendLine({
  data,
  xKey,
  yKey,
  label,
  height = 190,
  color = PALETTE.c1,
  area = true,
  formatX,
  contextLabel,
  ariaLabel,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  label: string;
  height?: number;
  color?: string;
  area?: boolean;
  formatX?: (v: string) => string;
  contextLabel?: string;
  ariaLabel: string;
}) {
  const gradId = React.useId().replace(/:/g, "");
  const values = data.map((d) => Number(d[yKey] ?? 0));
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const renderTip = React.useCallback<TooltipRender>(
    (x, items) => {
        const v = items[0]?.value ?? 0;
        const idx = data.findIndex((d) => String(d[xKey]) === x);
        const prev = idx > 0 ? Number(data[idx - 1]?.[yKey] ?? 0) : null;
        const change = prev !== null && prev !== 0 ? Math.round(((v - prev) / prev) * 100) : null;
        return (
          <PremiumTooltipCard
            title={formatX ? formatX(x) : x}
            context={contextLabel}
            rows={[
              { label, value: String(v), color },
              ...(prev !== null ? [{ label: "Previous", value: String(prev), muted: true }] : []),
              ...(change !== null
                ? [{ label: "Change", value: `${change > 0 ? "+" : ""}${change}%`, muted: true }]
                : []),
              { label: "Period average", value: avg.toFixed(1), muted: true },
            ]}
          />
        );
    },
    [data, xKey, yKey, label, color, formatX, contextLabel, avg],
  );

  const Chart = area ? AreaChart : LineChart;

  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.24} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={PALETTE.grid} vertical={false} />
          <XAxis
            dataKey={xKey}
            tickFormatter={formatX}
            tick={{ fontSize: 10.5, fill: PALETTE.muted }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10.5, fill: PALETTE.muted }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip content={<TooltipRenderer render={renderTip} />} cursor={{ stroke: color, strokeOpacity: 0.25, strokeWidth: 1.5 }} />
          {area ? (
            <Area
              type="monotone"
              dataKey={yKey}
              name={label}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={{ r: 3.5 }}
              isAnimationActive={false}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={yKey}
              name={label}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5 }}
              isAnimationActive={false}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Horizontal status composition (compact bar, click → filter) ─────────────

export function StatusComposition({
  rows,
  total,
  onSelect,
  activeName,
}: {
  rows: Array<{ name: string; value: number; color: string }>;
  total: number;
  onSelect?: (name: string) => void;
  activeName?: string | null;
}) {
  const safeTotal = total || 1;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--neutral-track)]">
        {rows
          .filter((r) => r.value > 0)
          .map((r) => (
            <span
              key={r.name}
              className="h-full transition-opacity"
              style={{
                width: `${(r.value / safeTotal) * 100}%`,
                background: r.color,
                opacity: activeName && r.name !== activeName ? 0.35 : 1,
              }}
              aria-hidden
            />
          ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map((r) => (
          <li key={r.name}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(r.name)}
              className={cn(
                "flex w-full items-center gap-2 rounded-input px-1.5 py-1 text-[12px] transition-colors",
                onSelect && "hover:bg-panel2",
                activeName === r.name && "bg-panel2 font-semibold",
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: r.color }} aria-hidden />
              <span className="flex-1 text-start text-ink">{r.name}</span>
              <span className="font-mono font-bold text-ink">{r.value}</span>
              <span className="w-9 text-end font-mono text-[10.5px] text-muted">
                {Math.round((r.value / safeTotal) * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
