"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  createPropertyAction,
  setPropertyActiveAction,
  updatePropertyAction,
} from "@/server/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

interface PropertyRow {
  id: string;
  code: string;
  name: string;
  location: string | null;
  propertyType: string | null;
  areaSqFt: number | null;
  areaLabel: string | null;
  developmentStatus: string | null;
  operationalStatus: string | null;
  statusIndicator: string | null;
  phaseCode: string | null;
  displayOrder: number;
  active: boolean;
}

const EMPTY: Omit<PropertyRow, "id"> = {
  code: "",
  name: "",
  location: null,
  propertyType: null,
  areaSqFt: null,
  areaLabel: null,
  developmentStatus: null,
  operationalStatus: null,
  statusIndicator: null,
  phaseCode: null,
  displayOrder: 100,
  active: true,
};

export function PropertiesAdmin({ properties }: { properties: PropertyRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<PropertyRow | (typeof EMPTY & { id?: undefined }) | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState<Omit<PropertyRow, "id">>(EMPTY);

  function openEditor(row: PropertyRow | null) {
    if (row) {
      // `id` travels along in form state but is stripped by Zod server-side.
      setForm(row);
      setEditing(row);
    } else {
      setForm(EMPTY);
      setEditing({ ...EMPTY });
    }
  }

  async function save() {
    setBusy(true);
    const payload = {
      ...form,
      code: form.code.trim().toLowerCase(),
      areaSqFt: form.areaSqFt ?? null,
      displayOrder: Number(form.displayOrder) || 0,
    };
    const result =
      editing && "id" in editing && editing.id
        ? await updatePropertyAction(editing.id, payload)
        : await createPropertyAction(payload);
    setBusy(false);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", "Property saved.");
    setEditing(null);
    router.refresh();
  }

  async function toggleActive(row: PropertyRow) {
    const verb = row.active ? "deactivate" : "activate";
    if (!window.confirm(`Really ${verb} ${row.name}? ${row.active ? "It disappears from navigation and KPIs; historical data is preserved." : ""}`)) return;
    const result = await setPropertyActiveAction(row.id, !row.active);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast("success", `Property ${row.active ? "deactivated" : "activated"}.`);
    router.refresh();
  }

  function field<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="primary" onClick={() => openEditor(null)}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add property
        </Button>
      </div>
      <Card className="overflow-hidden">
        <div className="table-scroll">
          <table className="z-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Code</th>
                <th>Location</th>
                <th>Type</th>
                <th>Area</th>
                <th>Dev. Status</th>
                <th>Phase</th>
                <th>Status</th>
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.displayOrder}</td>
                  <td className="font-semibold">{p.name}</td>
                  <td className="font-mono text-xs">{p.code}</td>
                  <td>{p.location ?? "—"}</td>
                  <td>{p.propertyType ?? "—"}</td>
                  <td className="font-mono text-xs">{p.areaLabel ?? (p.areaSqFt ? `${p.areaSqFt}` : "—")}</td>
                  <td>{p.developmentStatus ?? "—"}</td>
                  <td className="font-mono text-xs">{p.phaseCode ?? "—"}</td>
                  <td>
                    {p.active ? (
                      <Badge className="bg-accent-light text-accent-dark">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-muted">Inactive</Badge>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => openEditor(p)}>
                        Edit
                      </Button>
                      <Button size="sm" variant={p.active ? "danger" : "default"} onClick={() => toggleActive(p)}>
                        {p.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && "id" in editing && editing.id ? `Edit ${form.name}` : "Add property"}
        subtitle="Fields without authoritative data may stay empty. The status dot and phase code are display metadata (semantics configurable — see docs/decisions.md)."
        wide
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={form.name} onChange={(e) => field("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-code">Code (URL slug)</Label>
            <Input id="p-code" value={form.code} onChange={(e) => field("code", e.target.value)} placeholder="e.g. opal" />
          </div>
          <div>
            <Label htmlFor="p-location">Location</Label>
            <Input id="p-location" value={form.location ?? ""} onChange={(e) => field("location", e.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="p-type">Property type</Label>
            <Input id="p-type" value={form.propertyType ?? ""} onChange={(e) => field("propertyType", e.target.value || null)} placeholder="e.g. Residential Apartments" />
          </div>
          <div>
            <Label htmlFor="p-area">Area (Sq Ft, numeric)</Label>
            <Input
              id="p-area"
              type="number"
              value={form.areaSqFt ?? ""}
              onChange={(e) => field("areaSqFt", e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <Label htmlFor="p-arealabel">Area display label</Label>
            <Input id="p-arealabel" value={form.areaLabel ?? ""} onChange={(e) => field("areaLabel", e.target.value || null)} placeholder="e.g. 300,000+ Sft" />
          </div>
          <div>
            <Label htmlFor="p-dev">Development status</Label>
            <Input id="p-dev" value={form.developmentStatus ?? ""} onChange={(e) => field("developmentStatus", e.target.value || null)} placeholder="e.g. Completed" />
          </div>
          <div>
            <Label htmlFor="p-op">Operational status</Label>
            <Input id="p-op" value={form.operationalStatus ?? ""} onChange={(e) => field("operationalStatus", e.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="p-dot">Status indicator (sidebar dot)</Label>
            <Select id="p-dot" value={form.statusIndicator ?? ""} onChange={(e) => field("statusIndicator", e.target.value || null)}>
              <option value="">None</option>
              <option value="green">Green</option>
              <option value="orange">Orange</option>
              <option value="blue">Blue</option>
              <option value="grey">Grey</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="p-phase">Phase code</Label>
            <Input id="p-phase" value={form.phaseCode ?? ""} onChange={(e) => field("phaseCode", e.target.value || null)} placeholder="e.g. P0" />
          </div>
          <div>
            <Label htmlFor="p-order">Display order</Label>
            <Input id="p-order" type="number" value={form.displayOrder} onChange={(e) => field("displayOrder", Number(e.target.value))} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || !form.name || !form.code}>
            {busy ? "Saving…" : "Save property"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
