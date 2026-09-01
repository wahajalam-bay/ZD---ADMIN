"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { setWidgetEnabledAction } from "@/server/actions/admin-actions";
import { useToast } from "@/components/ui/toast";

/** Property × PropOne-domain toggle matrix driving Command Center widgets. */
export function WidgetConfigMatrix({
  properties,
  domains,
  enabled,
}: {
  properties: Array<{ id: string; name: string }>;
  domains: Array<{ key: string; label: string }>;
  enabled: Record<string, Record<string, boolean>>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyCell, setBusyCell] = React.useState<string | null>(null);

  async function toggle(propertyId: string, domain: string, next: boolean) {
    const cell = `${propertyId}:${domain}`;
    setBusyCell(cell);
    const result = await setWidgetEnabledAction(propertyId, domain, next);
    setBusyCell(null);
    if (!result.ok) {
      toast("error", result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="z-table">
        <thead>
          <tr>
            <th>Property</th>
            {domains.map((d) => (
              <th key={d.key} className="text-center">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {properties.map((p) => (
            <tr key={p.id}>
              <td className="font-semibold">{p.name}</td>
              {domains.map((d) => {
                const on = enabled[p.id]?.[d.key] ?? false;
                const cell = `${p.id}:${d.key}`;
                return (
                  <td key={d.key} className="text-center">
                    <input
                      type="checkbox"
                      aria-label={`${p.name}: ${d.label} widget`}
                      className="h-4.5 w-4.5 cursor-pointer accent-[#0d9488]"
                      checked={on}
                      disabled={busyCell === cell}
                      onChange={(e) => toggle(p.id, d.key, e.target.checked)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
