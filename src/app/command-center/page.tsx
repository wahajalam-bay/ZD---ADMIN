import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/server/auth/session";
import { canReview } from "@/lib/roles";
import {
  portfolioMetrics,
  PREVIEW,
  PUBLISHED_ONLY,
} from "@/server/services/metrics-service";
import {
  listKnownWeeks,
  resolveSelectedWeek,
  weekDataState,
} from "@/server/services/reporting-week-service";
import { WeekSelector } from "@/components/shell/week-selector";
import { Card, Kpi } from "@/components/ui/card";
import { TrackingBadge } from "@/components/ui/badge";
import { PropertyTasksBar, DonutStat, CHART_COLORS } from "@/features/command-center/charts";
import { formatNumber } from "@/lib/utils";
import { mediaUrl } from "@/lib/media-url";

export const metadata: Metadata = { title: "Portfolio Overview" };
export const dynamic = "force-dynamic";

export default async function PortfolioOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; preview?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePageUser();
  const previewAllowed = canReview(user.role);
  const previewOn = previewAllowed && params.preview === "1";
  const statuses = previewOn ? PREVIEW : PUBLISHED_ONLY;

  const week = await resolveSelectedWeek(params.week);
  const [weeks, state, metrics] = await Promise.all([
    listKnownWeeks(),
    weekDataState(week),
    portfolioMetrics(week, statuses),
  ]);

  const chartData = metrics.perProperty.map((p) => ({
    name: p.property.name,
    completed: p.stats?.tasks.completed ?? 0,
    inProcess: p.stats?.tasks.inProcess ?? 0,
  }));

  return (
    <div data-testid="portfolio-overview">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
            Weekly Admin Properties Review
          </div>
          <h2 className="text-[22px] font-bold">Portfolio Overview</h2>
          <div className="mt-2">
            <WeekSelector
              weeks={weeks}
              selected={week}
              dataState={previewOn && state === "PREVIEW" ? "PREVIEW" : state}
              canPreview={previewAllowed}
              previewOn={previewOn}
            />
          </div>
        </div>
        <div className="text-right text-xs leading-relaxed text-muted">
          {metrics.perProperty.map((p) => p.property.name.toUpperCase()).join(" · ")}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label="Properties" value={metrics.propertyCount} />
        <Kpi
          label="Total Area"
          value={
            metrics.area.complete && metrics.area.sum > 0 ? formatNumber(metrics.area.sum) : "—"
          }
          hint={metrics.area.complete ? "Sft" : "Area data incomplete"}
        />
        <Kpi label="Completed This Week" value={metrics.tasks.completed} tone="ok" />
        <Kpi label="In Process" value={metrics.tasks.inProcess} tone="warn" />
        <Kpi label="Site Photos" value={metrics.sitePhotos} />
      </div>

      <div className="secbar">
        <h3>Status Overview</h3>
        <div className="line" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h4 className="mb-3 text-[12px] font-bold tracking-wide text-muted uppercase">
            Completed vs In Process — by Property
          </h4>
          <PropertyTasksBar data={chartData} />
        </Card>
        <Card className="p-5">
          <h4 className="mb-3 text-[12px] font-bold tracking-wide text-muted uppercase">
            Portfolio Task Status
          </h4>
          <DonutStat
            ariaLabel="Portfolio task status"
            slices={[
              { name: "Completed", value: metrics.tasks.completed, color: CHART_COLORS.TEAL },
              { name: "In Process", value: metrics.tasks.inProcess, color: CHART_COLORS.AMBER },
            ]}
            centerValue={metrics.completionPct === null ? "—" : `${metrics.completionPct}%`}
            centerLabel="Done"
          />
        </Card>
      </div>

      <div className="secbar">
        <h3>Properties</h3>
        <div className="line" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {metrics.perProperty.map(({ property, stats, compliance }) => (
          <Link
            key={property.id}
            href={`/command-center/${property.code}`}
            className="group rounded-card border border-line bg-panel shadow-card transition hover:-translate-y-0.5 hover:shadow-md"
            data-testid={`property-card-${property.code}`}
          >
            {property.heroImageKey ? (
               
              <img
                src={mediaUrl(property.heroImageKey)}
                alt=""
                className="h-[150px] w-full rounded-t-card object-cover"
              />
            ) : (
              <div className="flex h-[110px] items-center justify-center rounded-t-card bg-gradient-to-br from-accent-light to-slate-100 font-mono text-3xl font-extrabold text-accent-dark/40">
                {property.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="px-4.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[16px] font-bold group-hover:text-accent-dark">{property.name}</h3>
                <TrackingBadge status={stats?.trackingStatus ?? null} />
              </div>
              <div className="mt-1 text-xs text-muted">
                {[property.location, property.propertyType, property.areaLabel, property.developmentStatus]
                  .filter(Boolean)
                  .join(" · ") || "Master data pending"}
              </div>
              <div className="mt-3 flex gap-4 text-xs">
                <span>
                  <b className="font-mono text-accent-dark">{stats?.tasks.completed ?? 0}</b> completed
                </span>
                <span>
                  <b className="font-mono text-warn">{stats?.tasks.inProcess ?? 0}</b> in process
                </span>
                <span>
                  <b className="font-mono text-info">{stats?.photoCount ?? 0}</b> photos
                </span>
                <span>
                  <b className="font-mono">{compliance.pct === null ? "—" : `${compliance.pct}%`}</b> compliant
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
