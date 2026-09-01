import * as React from "react";
import { cn } from "@/lib/utils";

/** Component-level skeletons (§4) — never a full-page spinner. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton rounded-tile", className)} style={style} aria-hidden />;
}

export function SkeletonKpiStrip({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy="true" aria-label="Loading metrics">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-line bg-panel p-4 shadow-card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-3 h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChartCard({ height = 230 }: { height?: number }) {
  return (
    <div className="rounded-card border border-line bg-panel p-4 shadow-card" aria-busy="true">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="mt-4 w-full" style={{ height }} />
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-panel shadow-card" aria-busy="true">
      <Skeleton className="h-9 w-full rounded-none" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-t border-line px-3 py-2.5">
          <Skeleton className="h-3.5 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 3, height = 150 }: { count?: number; height?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-line bg-panel p-4 shadow-card">
          <Skeleton className="w-full rounded-tile" style={{ height }} />
          <Skeleton className="mt-3 h-4 w-1/2" />
          <Skeleton className="mt-2 h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
