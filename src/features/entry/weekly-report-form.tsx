"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Plus,
  RotateCcw,
  Siren,
  Trash2,
} from "lucide-react";
import {
  deleteWeeklyMediaAction,
  saveWeeklyDraftAction,
  submitWeeklyAction,
  updateWeeklyCaptionAction,
  uploadWeeklyMediaAction,
} from "@/server/actions/entry-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { weekRangeLabel } from "@/lib/week";
import type { WorkflowStatus } from "@/lib/roles";
import { StickyFormActions, type SaveState } from "./sticky-form-actions";

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
  {
    value: "ON_TRACK" as const,
    label: "On track",
    icon: CheckCircle2,
    cls: "border-accent bg-accent-light text-accent-dark",
  },
  {
    value: "WATCH" as const,
    label: "Watch",
    icon: AlertTriangle,
    cls: "border-warn bg-warn-bg text-warn",
  },
  { value: "AT_RISK" as const, label: "At risk", icon: Siren, cls: "border-bad bg-bad-bg text-bad" },
];

/** Sectioned weekly report (audit E8): status → tracking → summary → tasks → photos → notes. */
export function WeeklyReportForm(props: {
  propertyCode: string;
  propertyName: string;
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
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: "idle" });
  const [busy, setBusy] = React.useState<"save" | "submit" | "upload" | null>(null);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dirtyRef = React.useRef(false);

  const markDirty = () => {
    dirtyRef.current = true;
    setSaveState({ kind: "dirty" });
  };

  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

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
    setSaveState({ kind: "saving" });
    const result = await saveWeeklyDraftAction(props.propertyCode, buildPayload());
    setBusy(null);
    if (!result.ok) {
      setSaveState({ kind: "dirty" });
      toast("error", result.error);
      return null;
    }
    dirtyRef.current = false;
    setSaveState({
      kind: "saved",
      at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    });
    if (!silent) {
      toast("success", "Draft saved");
      router.refresh();
    }
    return result.data.reportId;
  }

  async function submit() {
    if (!summary.trim()) {
      toast("error", "Add a one-line management summary before submitting — it appears on the dashboard.");
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
    dirtyRef.current = false;
    setSaveState({ kind: "idle" });
    toast("success", "Weekly report submitted for review");
    router.refresh();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    e.target.value = "";
    if (!files || files.length === 0) return;
    setBusy("upload");
    try {
      let reportId = props.reportId;
      if (!reportId || dirtyRef.current) reportId = (await saveDraft(true)) ?? reportId;
      if (!reportId) return;
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("file", file);
        const result = await uploadWeeklyMediaAction(reportId, fd);
        if (!result.ok) toast("error", `${file.name}: ${result.error}`);
      }
      toast("success", "Photo uploaded");
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
    toast("success", "Photo deleted");
    router.refresh();
  }

  const disabled = !props.canEdit || busy !== null;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="pb-24" data-testid="weekly-report-form">
      {props.returnReason ? (
        <div
          data-testid="return-reason"
          className="mb-4 flex items-start gap-2.5 rounded-card border border-bad/40 bg-bad-bg px-4 py-3 text-[12.5px] text-bad"
        >
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <b>Returned for correction.</b> {props.returnReason}
          </span>
        </div>
      ) : null}
      {props.reviewNotes && !props.returnReason ? (
        <div className="mb-4 rounded-card border border-info/35 bg-info-bg px-4 py-3 text-[12.5px] text-info">
          <b>Review note:</b> {props.reviewNotes}
        </div>
      ) : null}
      {!props.canEdit ? (
        <div className="mb-4 rounded-card border border-line bg-panel2 px-4 py-3 text-[12.5px] text-muted">
          This weekly report is {props.status?.toLowerCase()} and is read-only for your role.
        </div>
      ) : null}

      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <div>
          <Label htmlFor="week-start">Week starting (Monday)</Label>
          <div className="flex items-center gap-2 rounded-input border border-line bg-panel px-2.5 py-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted" aria-hidden />
            <input
              id="week-start"
              type="date"
              value={props.weekStart}
              onChange={(e) => e.target.value && router.push(`${pathname}?week=${e.target.value}`)}
              className="min-h-9 bg-transparent font-mono text-[16px] text-ink outline-none sm:min-h-0 sm:text-[12.5px]"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted">{weekRangeLabel(props.weekStart)}</p>
        </div>
        <div className="ms-auto">
          <StatusBadge status={props.status} />
        </div>
      </Card>

      <SectionHeader
        title="Site tracking"
        icon="checkCircle"
        description="How is the site tracking this week?"
      />
      <div className="mb-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Tracking status">
        {TRACK_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const selected = tracking === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              type="button"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => {
                setTracking(opt.value);
                markDirty();
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-input border px-4 py-2.5 text-[12.5px] font-bold transition-all disabled:opacity-60",
                selected
                  ? opt.cls
                  : "border-line bg-panel text-muted hover:border-line-strong hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>

      <SectionHeader
        title="Management summary"
        icon="note"
        description="One line — this is what management reads on the dashboard."
      />
      <Card className="mb-6 p-4">
        <Textarea
          id="weekly-summary"
          rows={2}
          aria-label="One-line management summary"
          placeholder="e.g. 3 tasks completed, 2 in process; generator issue under repair"
          value={summary}
          maxLength={500}
          disabled={disabled}
          className="text-[14px]"
          onChange={(e) => {
            setSummary(e.target.value);
            markDirty();
          }}
        />
      </Card>

      <SectionHeader
        title="Task updates"
        icon="checklist"
        description={`${completed} completed · ${Math.max(0, tasks.length - completed)} in process`}
        actions={
          props.canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                setTasks((t) => [...t, { task: "", status: "IN_PROCESS", etaDate: null }]);
                markDirty();
              }}
              data-testid="add-task"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add task
            </Button>
          ) : null
        }
      />
      <Card className="mb-6 p-4">
        {tasks.length === 0 ? (
          <EmptyState
            compact
            title="No tasks recorded for this week yet"
            detail="Add the work your team completed or is progressing this week."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {tasks.map((t, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-tile border border-line p-2.5 sm:grid-cols-[1fr_150px_170px_40px] sm:items-start sm:border-0 sm:p-0"
              >
                <div>
                  <Label htmlFor={`task-${i}`} className="sm:sr-only">
                    Task {i + 1} description
                  </Label>
                  <Input
                    id={`task-${i}`}
                    aria-label={`Task ${i + 1} description`}
                    placeholder="Task description"
                    value={t.task}
                    disabled={disabled}
                    onChange={(e) => {
                      setTasks((list) =>
                        list.map((x, j) => (j === i ? { ...x, task: e.target.value } : x)),
                      );
                      markDirty();
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor={`task-status-${i}`} className="sm:sr-only">
                    Task {i + 1} status
                  </Label>
                  <Select
                    id={`task-status-${i}`}
                    aria-label={`Task ${i + 1} status`}
                    value={t.status}
                    disabled={disabled}
                    onChange={(e) => {
                      setTasks((list) =>
                        list.map((x, j) =>
                          j === i ? { ...x, status: e.target.value as TaskRow["status"] } : x,
                        ),
                      );
                      markDirty();
                    }}
                  >
                    <option value="COMPLETED">Completed</option>
                    <option value="IN_PROCESS">In Process</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`task-date-${i}`}>
                    {t.status === "COMPLETED" ? "Completion date" : "ETA"}
                  </Label>
                  <Input
                    id={`task-date-${i}`}
                    type="date"
                    aria-label={`Task ${i + 1} ${t.status === "COMPLETED" ? "completion date" : "ETA"}`}
                    value={t.etaDate ?? ""}
                    disabled={disabled}
                    onChange={(e) => {
                      setTasks((list) =>
                        list.map((x, j) => (j === i ? { ...x, etaDate: e.target.value || null } : x)),
                      );
                      markDirty();
                    }}
                  />
                </div>
                {props.canEdit ? (
                  <button
                    aria-label={`Remove task ${i + 1}`}
                    onClick={() => {
                      setTasks((list) => list.filter((_, j) => j !== i));
                      markDirty();
                    }}
                    className="mt-auto grid h-9 w-9 place-items-center rounded-input border border-line text-bad hover:bg-bad-bg sm:mt-5"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <SectionHeader
        title="Progress photos"
        icon="images"
        description="Shown on the Command Center once the report is published."
        actions={
          props.canEdit ? (
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={busy !== null}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {busy === "upload" ? "Uploading…" : "Add photos"}
            </Button>
          ) : null
        }
      />
      <Card className="mb-6 p-4">
        {props.media.length === 0 ? (
          <EmptyState compact title="No progress photos uploaded for this week" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {props.media.map((m, i) => (
              <div key={m.id} className="overflow-hidden rounded-tile border border-line">
                <button type="button" onClick={() => setLightbox(i)} className="block w-full">
                  { }
                  <img src={m.thumbUrl} alt={m.caption} className="h-[96px] w-full object-cover" />
                </button>
                <div className="flex items-center gap-1 border-t border-line p-1.5">
                  <Input
                    aria-label="Photo caption"
                    placeholder="Caption"
                    defaultValue={m.caption}
                    disabled={disabled}
                    onBlur={(e) => {
                      if (e.target.value !== m.caption) void updateWeeklyCaptionAction(m.id, e.target.value);
                    }}
                    className="border-0 px-1.5 py-1 text-[11px]"
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

      <SectionHeader
        title="Additional notes"
        icon="note"
        description="Blockers or context for the office."
      />
      <Card className="p-4">
        <Textarea
          id="weekly-notes"
          rows={3}
          aria-label="Additional notes"
          placeholder="Blockers, notes for the office"
          value={notes}
          disabled={disabled}
          onChange={(e) => {
            setNotes(e.target.value);
            markDirty();
          }}
        />
      </Card>

      {props.canEdit ? (
        <StickyFormActions
          state={saveState}
          submitting={busy === "submit"}
          disabled={busy === "upload"}
          onSaveDraft={() => void saveDraft()}
          onSubmit={submit}
          submitLabel="Submit for Review"
          saveTestId="weekly-save-draft"
          submitTestId="weekly-submit"
        />
      ) : null}

      {lightbox !== null ? (
        <Lightbox
          items={props.media.map((m) => ({
            src: m.url,
            title: m.caption || "Progress photo",
            subtitle: `${props.propertyName} · ${weekRangeLabel(props.weekStart)}`,
          }))}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      ) : null}
    </div>
  );
}
