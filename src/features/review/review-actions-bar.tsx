"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  approveSubmissionAction,
  publishSubmissionAction,
  returnSubmissionAction,
} from "@/server/actions/review-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { WorkflowStatus } from "@/lib/roles";

/** Approve / Return / Publish controls for one submission (review detail). */
export function ReviewActionsBar({
  kind,
  id,
  status,
}: {
  kind: "checklist" | "weekly";
  id: string;
  status: WorkflowStatus;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(action: "approve" | "return" | "publish") {
    setBusy(action);
    const result =
      action === "approve"
        ? await approveSubmissionAction({ kind, id, note })
        : action === "return"
          ? await returnSubmissionAction({ kind, id, reason })
          : await publishSubmissionAction({ kind, id });
    setBusy(null);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast(
      "success",
      action === "approve"
        ? "Submission approved."
        : action === "return"
          ? "Returned to the site team for correction."
          : "Published — now live on the Command Center.",
    );
    setReturnOpen(false);
    router.refresh();
  }

  return (
    <div className="rounded-card border border-line bg-panel p-5 shadow-card" data-testid="review-actions">
      <div className="mb-2 text-[11px] font-bold tracking-wide text-muted uppercase">Review decision</div>
      {status === "SUBMITTED" ? (
        <>
          <Label htmlFor="review-note">Review note (optional, kept on the record)</Label>
          <Textarea
            id="review-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. verified genset readings against logbook"
          />
          <div className="mt-3 flex flex-wrap gap-2.5">
            <Button
              variant="primary"
              onClick={() => run("approve")}
              disabled={busy !== null}
              data-testid="approve-btn"
            >
              {busy === "approve" ? "Approving…" : "Approve"}
            </Button>
            <Button
              variant="danger"
              onClick={() => setReturnOpen(true)}
              disabled={busy !== null}
              data-testid="return-btn"
            >
              Return for correction
            </Button>
          </div>
        </>
      ) : status === "APPROVED" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-muted">
            Approved. Publish to make it visible on the Command Center, or return it if something is
            wrong.
          </p>
          <div className="flex gap-2.5">
            <Button variant="dark" onClick={() => run("publish")} disabled={busy !== null} data-testid="publish-btn">
              {busy === "publish" ? "Publishing…" : "Publish"}
            </Button>
            <Button variant="danger" onClick={() => setReturnOpen(true)} disabled={busy !== null}>
              Return for correction
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          This submission is {status.toLowerCase()} — no review action is available in this state.
        </p>
      )}

      <Dialog
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Return for correction"
        subtitle="The site team will see this reason and can amend and resubmit."
      >
        <Label htmlFor="return-reason">Reason (required)</Label>
        <Textarea
          id="return-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain what needs to be corrected"
          data-testid="return-reason-input"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setReturnOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => run("return")}
            disabled={busy !== null || reason.trim().length < 3}
            data-testid="return-confirm"
          >
            {busy === "return" ? "Returning…" : "Return submission"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
