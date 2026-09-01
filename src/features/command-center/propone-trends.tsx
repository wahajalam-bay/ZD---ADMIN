"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { statusTone } from "@/lib/propone-metrics";

const TEAL = "#0d7a3f";
const AMBER = "#d97706";
const RED = "#dc2626";
const BLUE = "#1d6cb0";
const GREY = "#94a3b8";
const TONE_COLOR = { ok: TEAL, warn: AMBER, bad: RED } as const;

function weekTick(week: string): string {
  const d = new Date(`${week}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function monthTick(month: string): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function TrendArea({
  data,
  name,
  ariaLabel,
}: {
  data: Array<{ week: string; count: number }>;
  name: string;
  ariaLabel: string;
}) {
  return (
    <div className="h-[190px]" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={TEAL} stopOpacity={0.25} />
              <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#dcebe0" vertical={false} />
          <XAxis
            dataKey="week"
            tickFormatter={weekTick}
            tick={{ fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 10.5 }} axisLine={false} tickLine={false} width={38} />
          <Tooltip
            labelFormatter={(w) => `Week of ${weekTick(String(w))}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name={name}
            stroke={TEAL}
            strokeWidth={2}
            fill={`url(#grad-${name})`}
            dot={{ r: 2.5, fill: TEAL }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * PropOne trend analytics per property: weekly visitor traffic, weekly amenity
 * bookings, and monthly work orders split by status — all from synced
 * warehouse records, never hard-coded.
 */
export function PropOneTrendsSection({
  visitsWeekly,
  bookingsWeekly,
  workOrdersMonthly,
}: {
  visitsWeekly: Array<{ week: string; count: number }>;
  bookingsWeekly: Array<{ week: string; count: number }>;
  workOrdersMonthly: Array<{ month: string; byStatus: Record<string, number>; total: number }>;
}) {
  const hasVisits = visitsWeekly.some((v) => v.count > 0);
  const hasBookings = bookingsWeekly.some((v) => v.count > 0);
  const hasWo = workOrdersMonthly.length > 0;
  if (!hasVisits && !hasBookings && !hasWo) return null;

  // Stable status key order across months, most frequent first.
  const statusTotals = new Map<string, number>();
  for (const m of workOrdersMonthly) {
    for (const [s, c] of Object.entries(m.byStatus)) {
      statusTotals.set(s, (statusTotals.get(s) ?? 0) + c);
    }
  }
  const statuses = [...statusTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  const woData = workOrdersMonthly.map((m) => ({ month: m.month, ...m.byStatus }));
  const colorFor = (status: string, i: number) =>
    i < 4 ? TONE_COLOR[statusTone(status)] : i === 4 ? BLUE : GREY;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2" data-testid="propone-trends">
      {hasVisits ? (
        <Card className="p-5">
          <h4 className="mb-1 text-[12px] font-bold tracking-wide text-muted uppercase">
            Visitor Traffic — weekly trend
          </h4>
          <p className="mb-2 text-[11px] text-muted">
            Visits per week, last {visitsWeekly.length} weeks (PropOne)
          </p>
          <TrendArea data={visitsWeekly} name="Visits" ariaLabel="Weekly visitor trend" />
        </Card>
      ) : null}
      {hasBookings ? (
        <Card className="p-5">
          <h4 className="mb-1 text-[12px] font-bold tracking-wide text-muted uppercase">
            Amenity Bookings — weekly trend
          </h4>
          <p className="mb-2 text-[11px] text-muted">
            Bookings per week, last {bookingsWeekly.length} weeks (PropOne)
          </p>
          <TrendArea data={bookingsWeekly} name="Bookings" ariaLabel="Weekly amenity bookings trend" />
        </Card>
      ) : null}
      {hasWo ? (
        <Card className="p-5 lg:col-span-2">
          <h4 className="mb-1 text-[12px] font-bold tracking-wide text-muted uppercase">
            Work Orders — monthly volume by status
          </h4>
          <p className="mb-2 text-[11px] text-muted">
            Work orders created per month, split by outcome (PropOne)
          </p>
          <div className="h-[210px]" role="img" aria-label="Monthly work orders by status">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={woData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#dcebe0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthTick}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10.5 }} axisLine={false} tickLine={false} width={38} />
                <Tooltip
                  labelFormatter={(m) => monthTick(String(m))}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                {statuses.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="wo" fill={colorFor(s, i)} maxBarSize={46} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
