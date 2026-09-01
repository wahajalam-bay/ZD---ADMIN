import crypto from "node:crypto";
import { db } from "@/server/db";
import {
  propOneAnnouncements,
  propOneBookings,
  propOneSyncRuns,
  propOneVehicleStickers,
  propOneVisits,
  propOneWorkOrders,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/server/services/audit-service";
import { logger } from "@/server/logger";
import type { PropOneDomain } from "@/lib/propone-metrics";
import { parseCsv } from "./csv";
import {
  announcementRowSchema,
  bookingRowSchema,
  vehicleStickerRowSchema,
  visitRowSchema,
  workOrderRowSchema,
} from "./validators";
import type { ImportReport, ImportRowError, PropOneAdapter } from "./types";

export class PropOneFileImportAdapter implements PropOneAdapter {
  readonly mode = "FILE_IMPORT" as const;

  describe() {
    return {
      ready: true,
      detail:
        "Controlled CSV import is active. Weekly PropOne exports are uploaded per property/domain at /admin/integrations.",
    };
  }
}

function hashRow(domain: string, propertyId: string, values: unknown): string {
  return crypto
    .createHash("sha256")
    .update(`${domain}:${propertyId}:${JSON.stringify(values)}`)
    .digest("hex");
}

/**
 * Imports one CSV export for a property + domain inside a transaction:
 * - each row is Zod-validated; malformed rows are rejected and reported
 * - valid rows are inserted idempotently (dedupe on propertyId + rawHash)
 * - a sync-run row records provenance and an import report is returned
 */
export async function importPropOneCsv(opts: {
  actorUserId: string;
  propertyId: string;
  domain: PropOneDomain;
  filename: string;
  csvText: string;
}): Promise<ImportReport> {
  const rows = parseCsv(opts.csvText);
  const errors: ImportRowError[] = [];
  let imported = 0;

  const [run] = await db
    .insert(propOneSyncRuns)
    .values({
      mode: "FILE_IMPORT",
      status: "RUNNING",
      domain: opts.domain,
      propertyId: opts.propertyId,
      filename: opts.filename.slice(0, 300),
      recordsProcessed: rows.length,
      initiatedBy: opts.actorUserId,
    })
    .returning();
  const runId = run!.id;

  try {
    await db.transaction(async (tx) => {
      for (const [i, raw] of rows.entries()) {
        const rowNo = i + 2; // 1-based + header row
        try {
          if (opts.domain === "WORK_ORDERS") {
            const parsed = workOrderRowSchema.parse(raw);
            const inserted = await tx
              .insert(propOneWorkOrders)
              .values({
                propertyId: opts.propertyId,
                externalId: parsed.external_id || null,
                issue: parsed.issue,
                unit: parsed.unit,
                addedBy: parsed.added_by,
                orderDate: parsed.order_date || null,
                serviceCharges: parsed.service_charges,
                assignee: parsed.assignee,
                status: parsed.status,
                syncRunId: runId,
                rawHash: hashRow(opts.domain, opts.propertyId, parsed),
              })
              .onConflictDoNothing()
              .returning({ id: propOneWorkOrders.id });
            if (inserted.length > 0) imported++;
          } else if (opts.domain === "VISITS" || opts.domain === "VISITORS") {
            const parsed = visitRowSchema.parse(raw);
            const inserted = await tx
              .insert(propOneVisits)
              .values({
                propertyId: opts.propertyId,
                externalId: parsed.external_id || null,
                visitorName: parsed.visitor_name,
                unit: parsed.unit,
                residentName: parsed.resident_name,
                arrivalAt: new Date(parsed.arrival_at),
                departureAt: parsed.departure_at ? new Date(parsed.departure_at) : null,
                visitType: parsed.visit_type || null,
                status: parsed.status,
                syncRunId: runId,
                rawHash: hashRow("VISITS", opts.propertyId, parsed),
              })
              .onConflictDoNothing()
              .returning({ id: propOneVisits.id });
            if (inserted.length > 0) imported++;
          } else if (opts.domain === "CINEMA_BOOKINGS" || opts.domain === "AMENITY_BOOKINGS") {
            const parsed = bookingRowSchema.parse(raw);
            const inserted = await tx
              .insert(propOneBookings)
              .values({
                propertyId: opts.propertyId,
                externalId: parsed.external_id || null,
                amenity:
                  parsed.amenity ||
                  (opts.domain === "CINEMA_BOOKINGS" ? "CINEMA" : "AMENITY"),
                unit: parsed.unit,
                bookedBy: parsed.booked_by,
                bookingAt: new Date(parsed.booking_at),
                status: parsed.status,
                syncRunId: runId,
                rawHash: hashRow("BOOKINGS", opts.propertyId, parsed),
              })
              .onConflictDoNothing()
              .returning({ id: propOneBookings.id });
            if (inserted.length > 0) imported++;
          } else if (opts.domain === "VEHICLE_STICKERS") {
            const parsed = vehicleStickerRowSchema.parse(raw);
            const inserted = await tx
              .insert(propOneVehicleStickers)
              .values({
                propertyId: opts.propertyId,
                externalId: parsed.external_id || null,
                unit: parsed.unit,
                ownerName: parsed.owner_name,
                vehicle: parsed.vehicle,
                stickerType: parsed.sticker_type,
                issuedDate: parsed.issued_date || null,
                syncRunId: runId,
                rawHash: hashRow(opts.domain, opts.propertyId, parsed),
              })
              .onConflictDoNothing()
              .returning({ id: propOneVehicleStickers.id });
            if (inserted.length > 0) imported++;
          } else if (opts.domain === "ANNOUNCEMENTS") {
            const parsed = announcementRowSchema.parse(raw);
            const inserted = await tx
              .insert(propOneAnnouncements)
              .values({
                propertyId: opts.propertyId,
                externalId: parsed.external_id || null,
                title: parsed.title,
                body: parsed.body,
                audience: parsed.audience,
                sentAt: new Date(parsed.sent_at),
                syncRunId: runId,
                rawHash: hashRow(opts.domain, opts.propertyId, parsed),
              })
              .onConflictDoNothing()
              .returning({ id: propOneAnnouncements.id });
            if (inserted.length > 0) imported++;
          }
        } catch (err) {
          const message =
            err && typeof err === "object" && "issues" in err
              ? (err as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues
                  .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
                  .join("; ")
              : "Invalid row";
          errors.push({ row: rowNo, message });
        }
      }
    });

    const rejected = errors.length;
    const status = rejected === 0 ? "SUCCESS" : imported > 0 ? "PARTIAL" : "FAILED";
    await db
      .update(propOneSyncRuns)
      .set({
        status,
        recordsImported: imported,
        recordsRejected: rejected,
        errorSummary: errors.slice(0, 50),
        finishedAt: new Date(),
      })
      .where(eq(propOneSyncRuns.id, runId));

    await recordAudit(db, {
      actorUserId: opts.actorUserId,
      action: "propone.import",
      entityType: "propone_sync_run",
      entityId: runId,
      propertyId: opts.propertyId,
      metadata: { domain: opts.domain, filename: opts.filename, imported, rejected },
    });

    return { syncRunId: runId, processed: rows.length, imported, rejected, errors };
  } catch (err) {
    logger.error("PropOne import failed", { runId, error: String(err) });
    await db
      .update(propOneSyncRuns)
      .set({
        status: "FAILED",
        recordsImported: 0,
        recordsRejected: rows.length,
        errorSummary: [{ row: 0, message: String(err) }],
        finishedAt: new Date(),
      })
      .where(eq(propOneSyncRuns.id, runId));
    throw err;
  }
}
