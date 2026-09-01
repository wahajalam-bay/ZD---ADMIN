"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireIntegrationAdmin,
  requirePropertyAdmin,
  requireUserAdmin,
} from "@/server/permissions";
import {
  createUserPayload,
  propertyPayload,
  propOneDomainSchema,
  updateUserPayload,
  uuidSchema,
} from "@/lib/validation";
import {
  createProperty,
  createUser,
  resetUserPassword,
  setPropertyActive,
  setUserDisabled,
  updateProperty,
  updateUserRoleAndProperty,
} from "@/server/services/admin-service";
import { importPropOneCsv } from "@/server/integrations/propone/file-import-adapter";
import { db } from "@/server/db";
import { propOneWidgetConfigs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recordAudit } from "@/server/services/audit-service";
import { runAction, type ActionResult } from "./action-result";
import type { ImportReport } from "@/server/integrations/propone/types";

// ── Users ───────────────────────────────────────────────────────────────────

export async function createUserAction(raw: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAction(async () => {
    const actor = await requireUserAdmin();
    const input = createUserPayload.parse(raw);
    const userId = await createUser(actor, input);
    revalidatePath("/admin/users");
    return { userId };
  });
}

export async function updateUserAction(raw: unknown): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const actor = await requireUserAdmin();
    const input = updateUserPayload.parse(raw);
    await updateUserRoleAndProperty(actor, input);
    revalidatePath("/admin/users");
    return undefined;
  });
}

export async function setUserDisabledAction(
  userId: string,
  disabled: boolean,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const actor = await requireUserAdmin();
    z.string().min(1).parse(userId);
    await setUserDisabled(actor, userId, disabled);
    revalidatePath("/admin/users");
    return undefined;
  });
}

export async function resetPasswordAction(
  userId: string,
  newPassword: string,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const actor = await requireUserAdmin();
    z.string().min(1).parse(userId);
    z.string().min(10, "Password must be at least 10 characters").max(200).parse(newPassword);
    await resetUserPassword(actor, userId, newPassword);
    revalidatePath("/admin/users");
    return undefined;
  });
}

// ── Properties ──────────────────────────────────────────────────────────────

export async function createPropertyAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const actor = await requirePropertyAdmin();
    const input = propertyPayload.parse(raw);
    const created = await createProperty(actor, input);
    revalidatePath("/admin/properties");
    revalidatePath("/command-center", "layout");
    revalidatePath("/entry", "layout");
    return { id: created.id };
  });
}

export async function updatePropertyAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const actor = await requirePropertyAdmin();
    uuidSchema.parse(id);
    const input = propertyPayload.parse(raw);
    await updateProperty(actor, id, input);
    revalidatePath("/admin/properties");
    revalidatePath("/command-center", "layout");
    revalidatePath("/entry", "layout");
    return undefined;
  });
}

export async function setPropertyActiveAction(
  id: string,
  active: boolean,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const actor = await requirePropertyAdmin();
    uuidSchema.parse(id);
    await setPropertyActive(actor, id, active);
    revalidatePath("/admin/properties");
    revalidatePath("/command-center", "layout");
    revalidatePath("/entry", "layout");
    return undefined;
  });
}

// ── PropOne ─────────────────────────────────────────────────────────────────

export async function importPropOneCsvAction(
  formData: FormData,
): Promise<ActionResult<ImportReport>> {
  return runAction(async () => {
    const actor = await requireIntegrationAdmin();
    const propertyId = uuidSchema.parse(formData.get("propertyId"));
    const domain = propOneDomainSchema.parse(formData.get("domain"));
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No CSV file provided");
    if (file.size > 5 * 1024 * 1024) throw new Error("CSV exceeds the 5 MB limit");
    const csvText = await file.text();
    const report = await importPropOneCsv({
      actorUserId: actor.id,
      propertyId,
      domain,
      filename: file.name || "import.csv",
      csvText,
    });
    revalidatePath("/admin/integrations");
    revalidatePath("/command-center", "layout");
    return report;
  });
}

export async function setWidgetEnabledAction(
  propertyId: string,
  domain: string,
  enabled: boolean,
): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const actor = await requireIntegrationAdmin();
    uuidSchema.parse(propertyId);
    const parsedDomain = propOneDomainSchema.parse(domain);
    const existing = await db
      .select()
      .from(propOneWidgetConfigs)
      .where(
        and(
          eq(propOneWidgetConfigs.propertyId, propertyId),
          eq(propOneWidgetConfigs.metricDomain, parsedDomain),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(propOneWidgetConfigs)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(propOneWidgetConfigs.id, existing[0].id));
    } else {
      await db.insert(propOneWidgetConfigs).values({
        propertyId,
        metricDomain: parsedDomain,
        enabled,
        sortOrder: 100,
      });
    }
    await recordAudit(db, {
      actorUserId: actor.id,
      action: "propone.widget_config_changed",
      entityType: "propone_widget_config",
      entityId: `${propertyId}:${parsedDomain}`,
      propertyId,
      afterData: { enabled },
    });
    revalidatePath("/admin/integrations");
    revalidatePath("/command-center", "layout");
    return undefined;
  });
}
