"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import {
  deleteEvidenceAction,
  saveChecklistDraftAction,
  submitChecklistAction,
  uploadEvidenceAction,
} from "@/server/actions/entry-actions";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Input, Label, Select } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Lightbox } from "@/components/ui/lightbox";
import { useToast } from "@/components/ui/toast";
import { SEVERITIES, SEVERITY_LABELS } from "@/lib/compliance";
import type { WorkflowStatus } from "@/lib/roles";

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
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState<"save" | "submit" | "upload" | null>(null);
  const [lightbox, setLightbox] = React.useState<{ photos: PhotoView[]; index: number; title: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingUploadItem = React.useRef<string | null>(null);

  // Dirty-state protection: warn before leaving with unsaved edits.
  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function buildPayload() {
    return {
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
    };
  }

  function updateRow(itemId: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [itemId]: { ...r[itemId]!, ...patch } }));
    setDirty(true);
  }

  async function saveDraft(silent = false): Promise<Record<string, string> | null> {
    setBusy("save");
    const result = await saveChecklistDraftAction(props.propertyCode, buildPayload());
    setBusy(null);
    if (!result.ok) {
      toast("error", result.error);
      return null;
    }
    setDirty(false);
    setRows((r) => {
      const next = { ...r };
      for (const [itemId, responseId] of Object.entries(result.data.responseIds)) {
        if (next[itemId]) next[itemId] = { ...next[itemId], responseId };
      }
      return next;
    });
    if (!silent) {
      toast("success", "Draft saved.");
      router.refresh();
    }
    return result.data.responseIds;
  }

  async function submit() {
    if (!window.confirm("Submit this checklist for review? You will not be able to edit it while it is under review.")) {
      return;
    }
    setBusy("submit");
    const result = await submitChecklistAction(props.propertyCode, buildPayload());
    setBusy(null);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    setDirty(false);
    toast("success", "Submitted for review.");
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
      let responseId = rows[itemId]?.responseId ?? null;
      if (!responseId) {
        const ids = await saveDraft(true);
        responseId = ids?.[itemId] ?? null;
      }
      if (!responseId) {
        toast("error", "Could not prepare the checklist row for upload. Save draft and retry.");
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
      toast("success", "Evidence photo attached to this checklist point.");
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
    updateRow(itemId, { photos: rows[itemId]!.photos.filter((p) => p.id !== photoId) });
    setDirty(false);
    toast("success", "Photo deleted.");
    router.refresh();
  }

  const disabled = !props.canEdit || busy !== null;

  return (
    <div className="pb-24">
      <div className="mt-1 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[19px] font-bold">{props.category.name}</h2>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {props.date} · {props.category.type === "LOG" ? "log fields" : "OP / CL checks"}
          </p>
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
          This entry is {props.status?.toLowerCase()} and is read-only for your role.
        </div>
      ) : null}

      {props.fieldDefs.length > 0 ? (
        <Card className="mb-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.fieldDefs.map((f) => (
              <div key={f.id}>
                <Label htmlFor={`field-${f.id}`}>{f.label}</Label>
                <Input
                  id={`field-${f.id}`}
                  value={fields[f.id] ?? ""}
                  disabled={disabled}
                  onChange={(e) => {
                    setFields((v) => ({ ...v, [f.id]: e.target.value }));
                    setDirty(true);
                  }}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {props.items.length > 0 ? (
        <Card className="mb-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="z-table" data-testid="entry-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  <th>Item / Description</th>
                  <th style={{ width: 46, textAlign: "center" }}>OP</th>
                  <th style={{ width: 46, textAlign: "center" }}>CL</th>
                  <th style={{ minWidth: 220 }}>Defect / Comment</th>
                  <th style={{ width: 120 }}>Severity</th>
                  <th style={{ width: 140 }}>Photo Evidence</th>
                </tr>
              </thead>
              <tbody>
                {props.items.map((item, i) => {
                  const row = rows[item.id]!;
                  const hasDefect = row.comment.trim() !== "";
                  return (
                    <tr key={item.id} data-testid={`item-row-${i}`}>
                      <td className="font-mono text-xs text-muted">{i + 1}</td>
                      <td className="font-semibold">{item.name}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${item.name} opening check`}
                          className="h-5 w-5 cursor-pointer accent-[#0d9488]"
                          checked={row.op}
                          disabled={disabled}
                          onChange={(e) => updateRow(item.id, { op: e.target.checked })}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${item.name} closing check`}
                          className="h-5 w-5 cursor-pointer accent-[#0d9488]"
                          checked={row.cl}
                          disabled={disabled}
                          onChange={(e) => updateRow(item.id, { cl: e.target.checked })}
                        />
                      </td>
                      <td>
                        <Input
                          aria-label={`${item.name} defect or comment`}
                          placeholder="Defect / comment"
                          value={row.comment}
                          disabled={disabled}
                          onChange={(e) => updateRow(item.id, { comment: e.target.value })}
                          className="py-1.5 text-[12.5px]"
                        />
                      </td>
                      <td>
                        {hasDefect ? (
                          <Select
                            aria-label={`${item.name} severity`}
                            value={row.severity ?? "LOW"}
                            disabled={disabled}
                            onChange={(e) => updateRow(item.id, { severity: e.target.value })}
                            className="py-1.5 text-[12px]"
                          >
                            {SEVERITIES.map((s) => (
                              <option key={s} value={s}>
                                {SEVERITY_LABELS[s]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.photos.map((p, pi) => (
                            <span key={p.id} className="relative inline-block">
                              <button
                                type="button"
                                onClick={() =>
                                  setLightbox({ photos: row.photos, index: pi, title: item.name })
                                }
                                aria-label={`View evidence photo for ${item.name}`}
                              >
                                { }
                                <img
                                  src={p.thumbUrl}
                                  alt={p.caption || item.name}
                                  className="h-9 w-9 rounded-md border border-line object-cover"
                                />
                              </button>
                              {props.canEdit ? (
                                <button
                                  type="button"
                                  aria-label="Delete photo"
                                  onClick={() => removePhoto(item.id, p.id)}
                                  className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-white"
                                >
                                  <Trash2 className="h-2.5 w-2.5" aria-hidden />
                                </button>
                              ) : null}
                            </span>
                          ))}
                          {props.canEdit ? (
                            <button
                              type="button"
                              data-testid={`photo-btn-${i}`}
                              onClick={() => pickPhoto(item.id)}
                              disabled={busy !== null}
                              aria-label={`Add evidence photo for ${item.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:border-accent hover:text-accent-dark disabled:opacity-50"
                            >
                              <Camera className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card className="mb-4 p-5">
        <div className="mb-3 text-[11px] font-bold tracking-wide text-muted uppercase">Sign-off</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(Object.keys(SIGN_LABELS) as Array<keyof typeof SIGN_LABELS>).map((key) => (
            <div key={key}>
              <Label htmlFor={`sign-${key}`}>{SIGN_LABELS[key]}</Label>
              <Input
                id={`sign-${key}`}
                value={signs[key]}
                disabled={disabled}
                onChange={(e) => {
                  setSigns((s) => ({ ...s, [key]: e.target.value }));
                  setDirty(true);
                }}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Names are preserved from the paper checklist; the authenticated submitter, reviewer and
          publisher are also recorded automatically for audit.
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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 px-4 py-3 backdrop-blur lg:left-[250px]">
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3">
            <span className="text-xs text-muted">
              {busy === "upload"
                ? "Uploading photo…"
                : dirty
                  ? "Unsaved changes"
                  : "All changes saved"}
            </span>
            <div className="flex gap-2.5">
              <Button onClick={() => saveDraft()} disabled={busy !== null} data-testid="save-draft">
                {busy === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button
                variant="primary"
                onClick={submit}
                disabled={busy !== null}
                data-testid="submit-entry"
              >
                {busy === "submit" ? "Submitting…" : "Submit for review"}
              </Button>
            </div>
          </div>
        </div>
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
