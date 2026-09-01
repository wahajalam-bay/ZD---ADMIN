"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { importPropOneCsvAction } from "@/server/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { PROPONE_DOMAINS, PROPONE_DOMAIN_LABELS } from "@/lib/propone-metrics";
import type { ImportReport } from "@/server/integrations/propone/types";

/** Controlled CSV import (fallback until the real PropOne API is specified). */
export function PropOneImport({
  properties,
  templates,
}: {
  properties: Array<{ id: string; name: string }>;
  templates: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [propertyId, setPropertyId] = React.useState(properties[0]?.id ?? "");
  const [domain, setDomain] = React.useState<string>("WORK_ORDERS");
  const [report, setReport] = React.useState<ImportReport | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast("error", "Choose a CSV file first.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("propertyId", propertyId);
    fd.set("domain", domain);
    fd.set("file", file);
    const result = await importPropOneCsvAction(fd);
    setBusy(false);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    setReport(result.data);
    toast(
      result.data.rejected === 0 ? "success" : "error",
      `Import finished: ${result.data.imported} imported, ${result.data.rejected} rejected of ${result.data.processed} rows.`,
    );
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-[13px] font-bold tracking-wide uppercase">Manual CSV import</h3>
      <p className="mb-3 text-[12.5px] text-muted">
        Upload a weekly PropOne export for one property and data domain. Every row is validated —
        malformed rows are rejected and listed below, valid rows import idempotently (re-uploading
        the same file creates no duplicates).
      </p>
      <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor="pi-property">Property</Label>
          <Select id="pi-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pi-domain">Data domain</Label>
          <Select id="pi-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {PROPONE_DOMAINS.map((d) => (
              <option key={d} value={d}>
                {PROPONE_DOMAIN_LABELS[d]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pi-file">CSV file</Label>
          <input
            id="pi-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="w-full rounded-lg border border-line bg-panel px-2.5 py-1.5 text-[12.5px] file:mr-2 file:rounded file:border-0 file:bg-accent-light file:px-2 file:py-1 file:text-xs file:font-bold file:text-accent-dark"
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy}>
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Importing…" : "Import"}
        </Button>
      </form>
      <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-muted">
        Expected header for {PROPONE_DOMAIN_LABELS[domain as keyof typeof PROPONE_DOMAIN_LABELS]}:{" "}
        {templates[domain]}
      </p>

      {report ? (
        <div className="mt-4 rounded-card border border-line p-4">
          <div className="text-[12px] font-bold tracking-wide text-muted uppercase">Import report</div>
          <p className="mt-1 text-[13px]">
            Processed <b className="font-mono">{report.processed}</b> rows · imported{" "}
            <b className="font-mono text-accent-dark">{report.imported}</b> · rejected{" "}
            <b className="font-mono text-bad">{report.rejected}</b>
          </p>
          {report.errors.length > 0 ? (
            <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto text-[12px] text-bad">
              {report.errors.map((err, i) => (
                <li key={i}>
                  Row {err.row}: {err.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
