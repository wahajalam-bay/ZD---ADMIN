"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { publishWeekAction } from "@/server/actions/review-actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Select, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { weekStartOf } from "@/lib/week";

/** Weekly property publication batch: publishes all APPROVED items for a week. */
export function PublishWeekButton({
  properties,
  defaultWeek,
}: {
  properties: Array<{ id: string; name: string }>;
  defaultWeek: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [propertyId, setPropertyId] = React.useState(properties[0]?.id ?? "");
  const [week, setWeek] = React.useState(defaultWeek);
  const [busy, setBusy] = React.useState(false);

  async function publish() {
    setBusy(true);
    const result = await publishWeekAction(propertyId, weekStartOf(week));
    setBusy(false);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    toast(
      "success",
      result.data.published > 0
        ? `Published ${result.data.published} approved item(s) for the week.`
        : "No approved items were waiting for publication in that week.",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="dark" onClick={() => setOpen(true)} data-testid="publish-week-open">
        <Rocket className="h-3.5 w-3.5" aria-hidden /> Publish week
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Publish a property's reporting week"
        subtitle="Publishes every APPROVED checklist entry and the approved weekly report for the selected week. Published data appears on the Command Center immediately."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="pw-property">Property</Label>
            <Select id="pw-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pw-week">Week (any day in the week)</Label>
            <Input id="pw-week" type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={publish} disabled={busy || !propertyId || !week} data-testid="publish-week-confirm">
              {busy ? "Publishing…" : "Publish approved items"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
