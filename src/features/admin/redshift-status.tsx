"use client";

import * as React from "react";
import { Database } from "lucide-react";
import { testRedshiftConnectionAction } from "@/server/actions/admin-actions";
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
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; detail: string } | null>(null);

  async function test() {
    setBusy(true);
    const res = await testRedshiftConnectionAction();
    setBusy(false);
    if (!res.ok) {
      toast("error", res.error);
      return;
    }
    setResult(res.data);
    toast(res.data.ok ? "success" : "error", res.data.detail);
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold tracking-wide text-muted uppercase">
          Redshift — PropOne Pakistan warehouse
        </div>
        <Button size="sm" onClick={test} disabled={busy || !configured}>
          <Database className="h-3.5 w-3.5" aria-hidden />
          {busy ? "Testing…" : "Test Redshift connection"}
        </Button>
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
