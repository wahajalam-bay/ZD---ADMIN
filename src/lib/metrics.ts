/** Pure KPI arithmetic shared by portfolio and property dashboards. */

export interface TaskCounts {
  completed: number;
  inProcess: number;
}

/** Completed / total, guarded against divide-by-zero (null = no tasks). */
export function taskCompletionPct({ completed, inProcess }: TaskCounts): number | null {
  const total = completed + inProcess;
  if (total === 0) return null;
  return Math.round((completed / total) * 100);
}

export interface PropertyAreaLike {
  areaSqFt: number | null;
}

/**
 * Portfolio "Total Area": sums authoritative area values only. `complete`
 * is false when any active property lacks area data — the UI then shows an
 * incomplete-data marker instead of a misleading partial total.
 */
export function totalArea(propertiesList: PropertyAreaLike[]): {
  sum: number;
  complete: boolean;
} {
  let sum = 0;
  let complete = true;
  for (const p of propertiesList) {
    if (p.areaSqFt == null) complete = false;
    else sum += p.areaSqFt;
  }
  return { sum, complete };
}

export function aggregateTaskCounts(rows: Array<{ status: string }>): TaskCounts {
  let completed = 0;
  let inProcess = 0;
  for (const r of rows) {
    if (r.status === "COMPLETED") completed++;
    else if (r.status === "IN_PROCESS") inProcess++;
  }
  return { completed, inProcess };
}
