"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteWeeklyMediaAction,
  saveWeeklyDraftAction,
  submitWeeklyAction,
  updateWeeklyCaptionAction,
  uploadWeeklyMediaAction,
} from "@/server/actions/entry-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Lightbox } from "@/components/ui/lightbox";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { weekRangeLabel } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";

interface TaskRow {
  task: string;
  status: "COMPLETED" | "IN_PROCESS";
  etaDate: string | null;
}

interface MediaView {
  id: string;
  url: string;
  thumbUrl: string;
  caption: string;
}

const TRACK_OPTIONS = [
  { value: "ON_TRACK", label: "On track", cls: "border-accent bg-accent-light text-accent-dark" },
  { value: "WATCH", label: "Watch", cls: "border-warn bg-warn-bg text-warn" },
  { value: "AT_RISK", label: "At risk", cls: "border-bad bg-bad-bg text-bad" },
] as const;

export function WeeklyReportForm(props: {
  propertyCode: string;
  weekStart: string;
  status: WorkflowStatus | null;
  canEdit: boolean;
  reportId: string | null;
  initial: {
    trackingStatus: "ON_TRACK" | "WATCH" | "AT_RISK";
    summary: string;
    notes: string;
    tasks: TaskRow[];
  };
  media: MediaView[];
  returnReason: string;
  reviewNotes: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [tracking, setTracking] = React.useState(props.initial.trackingStatus);
  const [summary, setSummary] = React.useState(props.initial.summary);
  const [notes, setNotes] = React.useState(props.initial.notes);
  const [tasks, setTasks] = React.useState<TaskRow[]>(props.initial.tasks);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<"save" | "submit" | "upload" | null>(null);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function buildPayload() {
    return {
      weekStart: props.weekStart,
      trackingStatus: tracking,
      summary,
      notes,
      tasks: tasks
        .filter((t) => t.task.trim() !== "")
        .map((t) => ({ task: t.task, status: t.status, etaDate: t.etaDate || null })),
    };
  }

  async function saveDraft(silent = false): Promise<string | null> {
    setBusy("save");
    const result = await saveWeeklyDraftAction(props.propertyCode, buildPayload());
    setBusy(null);
    if (!result.ok) {
      toast("error", result.error);
      return null;
    }
    setDirty(false);
    if (!silent) {
      toast("success", "Draft saved.");
      router.refresh();
    }
    return result.data.reportId;
  }

  async function submit() {
    if (!summary.trim()) {
      toast("error", "Add a one-line summary before submitting — it is shown on the dashboard.");
      return;
    }
    if (!window.confirm("Submit this weekly report for review?")) return;
    setBusy("submit");
    const result = await submitWeeklyAction(props.propertyCode, buildPayload());
    setBusy(null);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    setDirty(false);
    toast("success", "Weekly report submitted for review.");
    router.refresh();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    setBusy("upload");
    try {
      let reportId = props.reportId;
      if (!reportId) reportId = await saveDraft(true);
      if (!reportId) return;
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadWeeklyMediaAction(reportId, fd);
        if (!result.ok) {
          toast("error", `${file.name}: ${result.error}`);
        }
      }
      toast("success", "Photo(s) uploaded.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeMedia(id: string) {
    if (!window.confirm("Delete this photo?")) return;
    const result = await deleteWeeklyMediaAction(id);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", "Photo deleted.");
    router.refresh();
  }

  async function saveCaption(id: string, caption: string) {
    const result = await updateWeeklyCaptionAction(id, caption);
    if (!result.ok) toast("error", result.error);
  }

  const disabled = !props.canEdit || busy !== null;

  return (
    <div className="pb-24" data-testid="weekly-report-form">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <Label htmlFor="week-start" className="mb-1">
              Week starting (Monday)
            </Label>
            <input
              id="week-start"
              type="date"
              value={props.weekStart}
              onChange={(e) => {
                if (!e.target.value) return;
                router.push(`${pathname}?week=${e.target.value}`);
              }}
              className="rounded-lg border border-line bg-panel px-2.5 py-1.5 font-mono text-[13px]"
            />
            <p className="mt-1 text-[11px] text-muted">{weekRangeLabel(props.weekStart)}</p>
          </div>
        </div>
        <StatusBadge status={props.status} />
      </div>

      {props.returnReason ? (
        <div
          data-testid="return-reason"
          className="mb-4 rounded-card border border-bad bg-bad-bg px-4 py-3 text-[13px] text-bad"
        >
          <b>Returned for correction:</b> {props.returnReason}
        </div>
      ) : null}
      {props.reviewNotes && !props.returnReason ? (
        <div className="mb-4 rounded-card border border-info bg-info-bg px-4 py-3 text-[13px] text-info">
          <b>Review note:</b> {props.reviewNotes}
        </div>
      ) : null}
      {!props.canEdit ? (
        <div className="mb-4 rounded-card border border-line bg-slate-50 px-4 py-3 text-[13px] text-muted">
          This weekly report is {props.status?.toLowerCase()} and is read-only for your role.
        </div>
      ) : null}

      <Card className="mb-4 p-5">
        <div className="mb-2 text-[11px] font-bold tracking-wide text-muted uppercase">
          How is the site tracking this week?
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tracking status">
          {TRACK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={tracking === opt.value}
              disabled={disabled}
              onClick={() => {
                setTracking(opt.value);
                setDirty(true);
              }}
              className={cn(
                "rounded-lg border px-4 py-2 text-[12.5px] font-bold disabled:opacity-60",
                tracking === opt.value ? opt.cls : "border-line bg-panel text-muted hover:bg-slate-50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Label htmlFor="weekly-summary">One-line summary (shown on the dashboard)</Label>
          <Input
            id="weekly-summary"
            placeholder="e.g. 3 tasks completed, 2 in process"
            value={summary}
            maxLength={500}
            disabled={disabled}
            onChange={(e) => {
              setSummary(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </Card>

      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">
            Task updates (this week)
          </div>
          {props.canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                setTasks((t) => [...t, { task: "", status: "IN_PROCESS", etaDate: null }]);
                setDirty(true);
              }}
              data-testid="add-task"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add task
            </Button>
          ) : null}
        </div>
        {tasks.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-muted">No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_150px_150px_36px]">
                <Input
                  aria-label={`Task ${i + 1} description`}
                  placeholder="Task description"
                  value={t.task}
                  disabled={disabled}
                  onChange={(e) => {
                    setTasks((list) => list.map((x, j) => (j === i ? { ...x, task: e.target.value } : x)));
                    setDirty(true);
                  }}
                />
                <Select
                  aria-label={`Task ${i + 1} status`}
                  value={t.status}
                  disabled={disabled}
                  onChange={(e) => {
                    setTasks((list) =>
                      list.map((x, j) =>
                        j === i ? { ...x, status: e.target.value as TaskRow["status"] } : x,
                      ),
                    );
                    setDirty(true);
                  }}
                >
                  <option value="COMPLETED">Completed</option>
                  <option value="IN_PROCESS">In Process</option>
                </Select>
                <Input
                  aria-label={`Task ${i + 1} ETA or completion date`}
                  type="date"
                  value={t.etaDate ?? ""}
                  disabled={disabled}
                  onChange={(e) => {
                    setTasks((list) =>
                      list.map((x, j) => (j === i ? { ...x, etaDate: e.target.value || null } : x)),
                    );
                    setDirty(true);
                  }}
                />
                {props.canEdit ? (
                  <button
                    aria-label={`Remove task ${i + 1}`}
                    onClick={() => {
                      setTasks((list) => list.filter((_, j) => j !== i));
                      setDirty(true);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-bad hover:bg-bad-bg"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-wide text-muted uppercase">
            Progress photos
          </div>
          {props.canEdit ? (
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy !== null}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {busy === "upload" ? "Uploading…" : "Add photos"}
            </Button>
          ) : null}
        </div>
        {props.media.length === 0 ? (
          <p className="py-3 text-center text-[13px] text-muted">
            No photos yet. Photos are shown on the Command Center once the report is published.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {props.media.map((m, i) => (
              <div key={m.id} className="overflow-hidden rounded-card border border-line">
                <button type="button" onClick={() => setLightbox(i)} className="block w-full">
                  { }
                  <img src={m.thumbUrl} alt={m.caption} className="h-[100px] w-full object-cover" />
                </button>
                <div className="flex items-center gap-1 border-t border-line p-1.5">
                  <Input
                    aria-label="Photo caption"
                    placeholder="Caption"
                    defaultValue={m.caption}
                    disabled={disabled}
                    onBlur={(e) => {
                      if (e.target.value !== m.caption) saveCaption(m.id, e.target.value);
                    }}
                    className="border-0 px-1.5 py-1 text-[11.5px]"
                  />
                  {props.canEdit ? (
                    <button
                      aria-label="Delete photo"
                      onClick={() => removeMedia(m.id)}
                      className="shrink-0 rounded p-1 text-bad hover:bg-bad-bg"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFileChosen}
          aria-hidden
        />
      </Card>

      <Card className="mb-4 p-5">
        <Label htmlFor="weekly-notes">Anything else</Label>
        <Textarea
          id="weekly-notes"
          rows={3}
          placeholder="Blockers, notes for the office"
          value={notes}
          disabled={disabled}
          onChange={(e) => {
            setNotes(e.target.value);
            setDirty(true);
          }}
        />
      </Card>

      {props.canEdit ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur lg:left-[250px]">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
            <span className="text-xs text-muted">{dirty ? "Unsaved changes" : "All changes saved"}</span>
            <div className="flex gap-2.5">
              <Button onClick={() => saveDraft()} disabled={busy !== null} data-testid="weekly-save-draft">
                {busy === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button
                variant="primary"
                onClick={submit}
                disabled={busy !== null}
                data-testid="weekly-submit"
              >
                {busy === "submit" ? "Submitting…" : "Submit for review"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {lightbox !== null ? (
        <Lightbox
          items={props.media.map((m) => ({
            src: m.url,
            title: m.caption || "Progress photo",
            subtitle: `Week of ${props.weekStart}`,
          }))}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      ) : null}
    </div>
  );
}
