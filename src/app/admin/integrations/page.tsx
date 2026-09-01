import type { Metadata } from "next";
import { integrationStatus, listWidgetConfigs } from "@/server/services/propone-service";
import { listAllProperties } from "@/server/services/admin-service";
import { CSV_TEMPLATES } from "@/server/integrations/propone/validators";
import { PROPONE_DOMAINS, PROPONE_DOMAIN_LABELS } from "@/lib/propone-metrics";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PropOneImport } from "@/features/admin/propone-import";
import { RedshiftStatus } from "@/features/admin/redshift-status";
import { WidgetConfigMatrix } from "@/features/admin/widget-config-matrix";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function AdminIntegrationsPage() {
  const [status, propertiesList, widgetConfigs] = await Promise.all([
    integrationStatus(),
    listAllProperties(),
    listWidgetConfigs(),
  ]);
  const activeProperties = propertiesList.filter((p) => p.active);

  const enabledMatrix: Record<string, Record<string, boolean>> = {};
  for (const { config } of widgetConfigs) {
    enabledMatrix[config.propertyId] ??= {};
    enabledMatrix[config.propertyId]![config.metricDomain] = config.enabled;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 text-[11.5px] font-semibold tracking-wider text-muted uppercase">
          Administration
        </div>
        <h2 className="text-[22px] font-bold">PropOne Integration</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold tracking-wide uppercase">Source mode</h3>
            <Badge className="bg-ink text-white">
              {status.mode === "api" ? "API" : status.mode === "redshift" ? "Redshift" : "File import"}
            </Badge>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">{status.active.detail}</p>
          <div className="mt-3 border-t border-line pt-3">
            <div className="text-[11px] font-bold tracking-wide text-muted uppercase">API readiness</div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{status.api.detail}</p>
          </div>
          <RedshiftStatus detail={status.redshift.detail} configured={status.redshiftConfigured} />
        </Card>
        <Card className="p-5">
          <h3 className="mb-2 text-[13px] font-bold tracking-wide uppercase">Last successful sync</h3>
          {status.lastSuccess ? (
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-muted">When</dt>
                <dd className="font-mono text-xs">{formatDateTime(status.lastSuccess.startedAt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">File</dt>
                <dd className="font-mono text-xs">{status.lastSuccess.filename ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Processed / imported / rejected</dt>
                <dd className="font-mono text-xs">
                  {status.lastSuccess.recordsProcessed} / {status.lastSuccess.recordsImported} /{" "}
                  {status.lastSuccess.recordsRejected}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-[13px] text-muted">No successful sync yet.</p>
          )}
        </Card>
      </div>

      <PropOneImport
        properties={activeProperties.map((p) => ({ id: p.id, name: p.name }))}
        templates={CSV_TEMPLATES}
      />

      <Card className="p-5">
        <h3 className="mb-1 text-[13px] font-bold tracking-wide uppercase">Dashboard widgets per property</h3>
        <p className="mb-3 text-[12.5px] text-muted">
          Which PropOne data domains each property dashboard shows. The real
          property↔PropOne mapping is configurable here — nothing is hard-coded.
        </p>
        <WidgetConfigMatrix
          properties={activeProperties.map((p) => ({ id: p.id, name: p.name }))}
          domains={PROPONE_DOMAINS.map((d) => ({ key: d, label: PROPONE_DOMAIN_LABELS[d] }))}
          enabled={enabledMatrix}
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3 text-[11px] font-bold tracking-wide text-muted uppercase">
          Recent sync runs
        </div>
        {status.recentRuns.length === 0 ? (
          <div className="px-5 py-7 text-center text-[13px] text-muted">No syncs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="z-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Mode</th>
                  <th>Domain</th>
                  <th>Property</th>
                  <th>File</th>
                  <th>Processed</th>
                  <th>Imported</th>
                  <th>Rejected</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {status.recentRuns.map(({ run, propertyName }) => (
                  <tr key={run.id}>
                    <td className="font-mono text-xs">{formatDateTime(run.startedAt)}</td>
                    <td>{run.mode === "API" ? "API" : "File"}</td>
                    <td>{run.domain ? PROPONE_DOMAIN_LABELS[run.domain] : "—"}</td>
                    <td>{propertyName ?? "—"}</td>
                    <td className="max-w-[160px] truncate font-mono text-xs">{run.filename ?? "—"}</td>
                    <td className="font-mono text-xs">{run.recordsProcessed}</td>
                    <td className="font-mono text-xs">{run.recordsImported}</td>
                    <td className="font-mono text-xs">{run.recordsRejected}</td>
                    <td>
                      <Badge
                        className={
                          run.status === "SUCCESS"
                            ? "bg-accent-light text-accent-dark"
                            : run.status === "PARTIAL"
                              ? "bg-warn-bg text-warn"
                              : run.status === "FAILED"
                                ? "bg-bad-bg text-bad"
                                : "bg-slate-100 text-muted"
                        }
                      >
                        {run.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
