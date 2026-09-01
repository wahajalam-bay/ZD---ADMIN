"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, RotateCcw, Trash2 } from "lucide-react";
import {
  deleteEvidenceAction,
  saveChecklistDraftAction,
  submitChecklistAction,
  uploadEvidenceAction,
} from "@/server/actions/entry-actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input, Label, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Lightbox } from "@/components/ui/lightbox";
import { useToast } from "@/components/ui/toast";
import { SEVERITIES, SEVERITY_LABELS } from "@/lib/compliance";
import type { WorkflowStatus } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { OpClToggle } from "./op-cl-toggle";
import { StickyFormActions, type SaveState } from "./sticky-form-actions";

interface PhotoView {
  id: string;
  url: string;
  thumbUrl: string;
  caption: string;
}

interface RowState {
  responseId: string | null;
  op: boolean;
  cl: boolean;
  comment: string;
  severity: string | null;
  photos: PhotoView[];
}

const SIGN_LABELS = {
  duty: "Duty Electrician / Technician Sign",
  am: "A.M Admin",
  manager: "Manager Admin",
} as const;

const AUTOSAVE_MS = 2500;

export function ChecklistEntryForm(props: {
  propertyCode: string;
  category: { id: string; key: string; name: string; type: "CHECK" | "LOG" | "EVAL" };
  items: Array<{ id: string; name: string }>;
  fieldDefs: Array<{ id: string; label: string; required: boolean }>;
  date: string;
  status: WorkflowStatus | null;
  canEdit: boolean;
  initialValues: Record<string, string>;
  initialResponses: Record<string, RowState>;
  signs: { duty: string; am: string; manager: string };
  returnReason: string;
  reviewNotes: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [fields, setFields] = React.useState<Record<string, string>>(props.initialValues);
  const [rows, setRows] = React.useState<Record<string, RowState>>(props.initialResponses);
  const [signs, setSigns] = React.useState(props.signs);
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: "idle" });
  const [busy, setBusy] = React.useState<"save" | "submit" | "upload" | null>(null);
  const [lightbox, setLightbox] = React.useState<{ photos: PhotoView[]; index: number; title: string } | null>(
    null,
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingUploadItem = React.useRef<string | null>(null);
  const dirtyRef = React.useRef(false);
  const autosaveTimer = React.useRef<number | null>(null);

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
    setSaveState({ kind: "dirty" });
  }, []);

  // Navigation protection for unsaved edits.
  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirtyRef.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const buildPayload = React.useCallback(
    () => ({
      categoryId: props.category.id,
      entryDate: props.date,
      fields,
      responses: props.items.map((item) => {
        const r = rows[item.id]!;
        return {
          checklistItemId: item.id,
          op: r.op,
          cl: r.cl,
          comment: r.comment,
          severity: r.comment.trim() ? ((r.severity ?? "LOW") as (typeof SEVERITIES)[number]) : null,
        };
      }),
      signDutyTechnician: signs.duty,
      signAmAdmin: signs.am,
      signManagerAdmin: signs.manager,
    }),
    [props.category.id, props.date, props.items, fields, rows, signs],
  );

  const saveDraft = React.useCallback(
    async (silent = false): Promise<Record<string, string> | null> => {
      if (!props.canEdit) return null;
      setBusy("save");
      setSaveState({ kind: "saving" });
      const result = await saveChecklistDraftAction(props.propertyCode, buildPayload());
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
      setRows((r) => {
        const next = { ...r };
        for (const [itemId, responseId] of Object.entries(result.data.responseIds)) {
          if (next[itemId]) next[itemId] = { ...next[itemId], responseId };
        }
        return next;
      });
      if (!silent) {
        toast("success", "Draft saved");
        router.refresh();
      }
      return result.data.responseIds;
    },
    [props.canEdit, props.propertyCode, buildPayload, toast, router],
  );

  // Debounced draft autosave (audit E7).
  React.useEffect(() => {
    if (saveState.kind !== "dirty" || !props.canEdit) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => void saveDraft(true), AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [saveState, props.canEdit, saveDraft]);

  function updateRow(itemId: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [itemId]: { ...r[itemId]!, ...patch } }));
    markDirty();
  }

  async function submit() {
    if (!window.confirm("Submit this checklist for review? It becomes read-only while under review.")) {
      return;
    }
    setBusy("submit");
    const result = await submitChecklistAction(props.propertyCode, buildPayload());
    setBusy(null);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    dirtyRef.current = false;
    setSaveState({ kind: "idle" });
    toast("success", "Submitted for review");
    router.refresh();
  }

  function pickPhoto(itemId: string) {
    pendingUploadItem.current = itemId;
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = pendingUploadItem.current;
    e.target.value = "";
    if (!file || !itemId) return;

    setBusy("upload");
    try {
      // Save first so unsaved checklist values are never lost by the upload.
      let responseId = rows[itemId]?.responseId ?? null;
      if (!responseId || dirtyRef.current) {
        const ids = await saveDraft(true);
        responseId = ids?.[itemId] ?? responseId;
      }
      if (!responseId) {
        toast("error", "Could not prepare this checklist row for upload. Save the draft and retry.");
        return;
      }
      const fd = new FormData();
      fd.set("file", file);
      const result = await uploadEvidenceAction(responseId, fd);
      if (!result.ok) {
        toast("error", result.error);
        return;
      }
      const photo: PhotoView = {
        id: result.data.photoId,
        url: result.data.url,
        thumbUrl: result.data.thumbUrl,
        caption: "",
      };
      setRows((r) => ({
        ...r,
        [itemId]: { ...r[itemId]!, responseId, photos: [...r[itemId]!.photos, photo] },
      }));
      toast("success", "Evidence photo attached to this checklist point");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto(itemId: string, photoId: string) {
    if (!window.confirm("Delete this evidence photo?")) return;
    const result = await deleteEvidenceAction(photoId);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    setRows((r) => ({
      ...r,
      [itemId]: { ...r[itemId]!, photos: r[itemId]!.photos.filter((p) => p.id !== photoId) },
    }));
    toast("success", "Photo deleted");
    router.refresh();
  }

  const disabled = !props.canEdit || busy !== null;
  const issueCount = props.items.filter((i) => rows[i.id]?.comment.trim()).length;
  const doneCount = props.items.filter((i) => rows[i.id]?.op && rows[i.id]?.cl).length;

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-ink">{props.category.name}</h2>
          <p className="mt-0.5 font-mono text-[11.5px] text-muted">
            {props.date} ·{" "}
            {props.category.type === "LOG"
              ? "log fields"
              : `${doneCount}/${props.items.length} checked · ${issueCount} issue${issueCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <StatusBadge status={props.status} />
      </div>

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
          This entry is {props.status?.toLowerCase()} and is read-only for your role.
        </div>
      ) : null}

      {props.fieldDefs.length > 0 ? (
        <Card className="mb-4 p-4">
          <div className="t-label mb-3 text-muted">Log fields</div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {props.fieldDefs.map((f) => (
              <div key={f.id}>
                <Label htmlFor={`field-${f.id}`}>{f.label}</Label>
                <Input
                  id={`field-${f.id}`}
                  value={fields[f.id] ?? ""}
                  disabled={disabled}
                  onChange={(e) => {
                    setFields((v) => ({ ...v, [f.id]: e.target.value }));
                    markDirty();
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {props.items.length > 0 ? (
        <>
          {/* Desktop: compact table with sticky header */}
          <Card className="mb-4 hidden overflow-hidden lg:block">
            <div className="max-h-[70vh] overflow-auto">
              <table className="z-table" data-testid="entry-table">
                <thead className="sticky">
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Item</th>
                    <th style={{ width: 62, textAlign: "center" }}>OP</th>
                    <th style={{ width: 62, textAlign: "center" }}>CL</th>
                    <th style={{ minWidth: 240 }}>Issue / Comment</th>
                    <th style={{ width: 132 }}>Severity</th>
                    <th style={{ width: 150 }}>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {props.items.map((item, i) => {
                    const row = rows[item.id]!;
                    const hasIssue = row.comment.trim() !== "";
                    return (
                      <tr
                        key={item.id}
                        data-testid={`item-row-${i}`}
                        className={hasIssue ? "bg-bad-bg/40" : undefined}
                      >
                        <td className="font-mono text-[11px] text-muted">{i + 1}</td>
                        <td className="font-semibold">{item.name}</td>
                        <td className="text-center">
                          <OpClToggle
                            compact
                            label={`${item.name} opening check`}
                            checked={row.op}
                            disabled={disabled}
                            onChange={(v) => updateRow(item.id, { op: v })}
                          />
                        </td>
                        <td className="text-center">
                          <OpClToggle
                            compact
                            label={`${item.name} closing check`}
                            checked={row.cl}
                            disabled={disabled}
                            onChange={(v) => updateRow(item.id, { cl: v })}
                          />
                        </td>
                        <td>
                          <Input
                            aria-label={`${item.name} issue or comment`}
                            placeholder="Record an issue…"
                            value={row.comment}
                            disabled={disabled}
                            onChange={(e) => updateRow(item.id, { comment: e.target.value })}
                          />
                        </td>
                        <td>
                          {hasIssue ? (
                            <Select
                              aria-label={`${item.name} severity`}
                              value={row.severity ?? "LOW"}
                              disabled={disabled}
                              onChange={(e) => updateRow(item.id, { severity: e.target.value })}
                            >
                              {SEVERITIES.map((s) => (
                                <option key={s} value={s}>
                                  {SEVERITY_LABELS[s]}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-[11.5px] text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <EvidenceCell
                            row={row}
                            itemName={item.name}
                            testId={`photo-btn-${i}`}
                            canEdit={props.canEdit}
                            busy={busy !== null}
                            onPick={() => pickPhoto(item.id)}
                            onRemove={(photoId) => removePhoto(item.id, photoId)}
                            onView={(idx) =>
                              setLightbox({ photos: row.photos, index: idx, title: item.name })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile/tablet: one card per checklist item (audit E4) */}
          <div className="mb-4 flex flex-col gap-2.5 lg:hidden">
            {props.items.map((item, i) => {
              const row = rows[item.id]!;
              const hasIssue = row.comment.trim() !== "";
              return (
                <Card
                  key={item.id}
                  data-testid={`item-card-${i}`}
                  className={cn("p-3.5", hasIssue && "border-bad/40")}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-[11px] text-muted">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 text-[13.5px] leading-snug font-bold text-ink">
                      {item.name}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="t-label mb-1 block text-muted">OP · Opening</span>
                      <OpClToggle
                        label={`${item.name} opening check`}
                        checked={row.op}
                        disabled={disabled}
                        onChange={(v) => updateRow(item.id, { op: v })}
                      />
                    </div>
                    <div>
                      <span className="t-label mb-1 block text-muted">CL · Closing</span>
                      <OpClToggle
                        label={`${item.name} closing check`}
                        checked={row.cl}
                        disabled={disabled}
                        onChange={(v) => updateRow(item.id, { cl: v })}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Label htmlFor={`comment-m-${i}`}>Issue / Comment</Label>
                    <Input
                      id={`comment-m-${i}`}
                      placeholder="Record an issue…"
                      value={row.comment}
                      disabled={disabled}
                      onChange={(e) => updateRow(item.id, { comment: e.target.value })}
                    />
                  </div>

                  {/* Progressive disclosure: healthy rows stay light (audit E6) */}
                  {hasIssue ? (
                    <div className="mt-3 rounded-tile border border-bad/30 bg-bad-bg/50 p-2.5">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-bad">
                        <AlertTriangle className="h-3 w-3" aria-hidden /> Issue recorded
                      </div>
                      <Label htmlFor={`sev-m-${i}`}>Severity</Label>
                      <Select
                        id={`sev-m-${i}`}
                        value={row.severity ?? "LOW"}
                        disabled={disabled}
                        onChange={(e) => updateRow(item.id, { severity: e.target.value })}
                      >
                        {SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {SEVERITY_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <span className="t-label mb-1.5 block text-muted">Evidence</span>
                    <EvidenceCell
                      row={row}
                      itemName={item.name}
                      testId={`photo-btn-mobile-${i}`}
                      canEdit={props.canEdit}
                      busy={busy !== null}
                      large
                      onPick={() => pickPhoto(item.id)}
                      onRemove={(photoId) => removePhoto(item.id, photoId)}
                      onView={(idx) => setLightbox({ photos: row.photos, index: idx, title: item.name })}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      <Card className="mb-4 p-4">
        <div className="t-label mb-3 text-muted">Sign-off</div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {(Object.keys(SIGN_LABELS) as Array<keyof typeof SIGN_LABELS>).map((key) => (
            <div key={key}>
              <Label htmlFor={`sign-${key}`}>{SIGN_LABELS[key]}</Label>
              <Input
                id={`sign-${key}`}
                value={signs[key]}
                disabled={disabled}
                onChange={(e) => {
                  setSigns((s) => ({ ...s, [key]: e.target.value }));
                  markDirty();
                }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Names are preserved from the paper checklist; the authenticated submitter, reviewer and
          publisher are recorded automatically for audit.
        </p>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChosen}
        aria-hidden
      />

      {props.canEdit ? (
        <StickyFormActions
          state={saveState}
          submitting={busy === "submit"}
          disabled={busy === "upload"}
          onSaveDraft={() => void saveDraft()}
          onSubmit={submit}
        />
      ) : null}

      {lightbox ? (
        <Lightbox
          items={lightbox.photos.map((p) => ({
            src: p.url,
            title: p.caption || lightbox.title,
            subtitle: `${props.category.name} · ${lightbox.title} · ${props.date}`,
          }))}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((l) => (l ? { ...l, index: i } : l))}
        />
      ) : null}
    </div>
  );
}

function EvidenceCell({
  row,
  itemName,
  testId,
  canEdit,
  busy,
  large,
  onPick,
  onRemove,
  onView,
}: {
  row: RowState;
  itemName: string;
  testId: string;
  canEdit: boolean;
  busy: boolean;
  large?: boolean;
  onPick: () => void;
  onRemove: (photoId: string) => void;
  onView: (index: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {row.photos.map((p, pi) => (
        <span key={p.id} className="relative inline-block">
          <button
            type="button"
            onClick={() => onView(pi)}
            aria-label={`View evidence photo for ${itemName}`}
          >
            { }
            <img
              src={p.thumbUrl}
              alt={p.caption || itemName}
              className={cn(
                "rounded-tile border border-line object-cover",
                large ? "h-14 w-14" : "h-9 w-9",
              )}
            />
          </button>
          {canEdit ? (
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onRemove(p.id)}
              className="absolute -end-1.5 -top-1.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-accent-deep p-0.5 text-white"
            >
              <Trash2 className="h-2.5 w-2.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
      {canEdit ? (
        <Button
          size="sm"
          variant={row.comment.trim() && row.photos.length === 0 ? "primary" : "default"}
          onClick={onPick}
          disabled={busy}
          data-testid={testId}
          className={large ? "h-14 px-3" : undefined}
        >
          <Camera className="h-3.5 w-3.5" aria-hidden />
          {large ? "Add Photo" : ""}
        </Button>
      ) : row.photos.length === 0 ? (
        <span className="text-[11.5px] text-muted">—</span>
      ) : null}
    </div>
  );
}
