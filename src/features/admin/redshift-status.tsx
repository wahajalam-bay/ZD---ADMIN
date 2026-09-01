"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Database, RefreshCw } from "lucide-react";
import { syncRedshiftAction, testRedshiftConnectionAction } from "@/server/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Redshift (PropOne Pakistan) status + connectivity probe. */
export function RedshiftStatus({
  detail,
  configured,
}: {
  detail: string;
  configured: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<"test" | "sync" | null>(null);
  const [result, setResult] = React.useState<{ ok: boolean; detail: string } | null>(null);

  async function test() {
    setBusy("test");
    const res = await testRedshiftConnectionAction();
    setBusy(null);
    if (!res.ok) {
      toast("error", res.error);
      return;
    }
    setResult(res.data);
    toast(res.data.ok ? "success" : "error", res.data.detail);
  }

  async function sync() {
    setBusy("sync");
    const res = await syncRedshiftAction();
    setBusy(null);
    if (!res.ok) {
      toast("error", res.error);
      return;
    }
    const s = res.data;
    const detail = `Synced ${s.properties} properties: ${s.workOrders} work orders, ${s.visits} visitor records, ${s.bookings} amenity bookings${s.errors.length ? ` — ${s.errors.length} error(s): ${s.errors[0]}` : ""}.`;
    setResult({ ok: s.errors.length === 0, detail });
    toast(s.errors.length === 0 ? "success" : "error", detail);
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-bold tracking-wide text-muted uppercase">
          Redshift — PropOne Pakistan warehouse
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={test} disabled={busy !== null || !configured}>
            <Database className="h-3.5 w-3.5" aria-hidden />
            {busy === "test" ? "Testing…" : "Test connection"}
          </Button>
          <Button size="sm" variant="primary" onClick={sync} disabled={busy !== null || !configured} data-testid="redshift-sync">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {busy === "sync" ? "Syncing…" : "Sync from Redshift"}
          </Button>
        </div>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{detail}</p>
      {result ? (
        <p
          className={
            "mt-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold " +
            (result.ok ? "bg-accent-light text-accent-dark" : "bg-bad-bg text-bad")
          }
        >
          {result.detail}
        </p>
      ) : null}
    </div>
  );
}
