/**
 * Reporting-week helpers. The canonical reporting week starts on MONDAY,
 * matching the reference Data Entry Engine ("Week starting (Monday)").
 *
 * All functions operate on plain calendar-date strings (yyyy-MM-dd) to avoid
 * timezone drift between server and browser.
 */

const DAY_MS = 86_400_000;

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  return fromUtc(new Date(toUtc(dateStr).getTime() + days * DAY_MS));
}

/** Monday of the week containing `dateStr`. */
export function weekStartOf(dateStr: string): string {
  const d = toUtc(dateStr);
  const day = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  const diff = (day + 6) % 7; // days since Monday
  return fromUtc(new Date(d.getTime() - diff * DAY_MS));
}

/** Sunday of the week whose Monday is `weekStart`. */
export function weekEndOf(weekStart: string): string {
  return addDays(weekStart, 6);
}

export function todayStr(now: Date = new Date()): string {
  // Local calendar date of the server/browser.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentWeekStart(now: Date = new Date()): string {
  return weekStartOf(todayStr(now));
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function formatDayMonthYear(dateStr: string): string {
  const d = toUtc(dateStr);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** e.g. "Week of 20 Aug 2026" style label used across the Command Center. */
export function weekLabel(weekStart: string): string {
  return `Week of ${formatDayMonthYear(weekStart)}`;
}

/** e.g. "24 Aug – 30 Aug 2026" */
export function weekRangeLabel(weekStart: string): string {
  const end = weekEndOf(weekStart);
  const s = toUtc(weekStart);
  const startLabel = `${String(s.getUTCDate()).padStart(2, "0")} ${MONTHS[s.getUTCMonth()]}`;
  return `${startLabel} – ${formatDayMonthYear(end)}`;
}

/** Most-recent-first list of `count` week starts ending at `latest`. */
export function recentWeekStarts(latest: string, count: number): string[] {
  const start = weekStartOf(latest);
  return Array.from({ length: count }, (_, i) => addDays(start, -7 * i));
}

/** True when `dateStr` falls inside the week beginning `weekStart`. */
export function isInWeek(dateStr: string, weekStart: string): boolean {
  return weekStartOf(dateStr) === weekStart;
}
