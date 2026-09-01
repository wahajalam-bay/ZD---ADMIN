import crypto from "node:crypto";
import { Pool } from "pg";
import { and, eq, like } from "drizzle-orm";
import { env } from "@/server/env";
import { db } from "@/server/db";
import {
  properties,
  propOneBookings,
  propOneSyncRuns,
  propOneVisits,
  propOneWorkOrders,
} from "@/db/schema";
import { logger } from "@/server/logger";
import type { PropOneAdapter } from "./types";

/**
 * Amazon Redshift adapter for the PropOne Pakistan warehouse
 * (schema `propone_zameenpk`, FMS tables).
 *
 * Redshift speaks the PostgreSQL wire protocol, so the standard `pg` driver
 * connects directly via PROPONE_REDSHIFT_URL (+ PROPONE_REDSHIFT_SCHEMA).
 * Properties are mapped to warehouse projects through
 * `properties.propOneExternalId` = fms_projects.id.
 */
export class PropOneRedshiftAdapter implements PropOneAdapter {
  readonly mode = "REDSHIFT" as const;

  describe() {
    if (!env.PROPONE_REDSHIFT_URL) {
      return {
        ready: false,
        detail:
          "Redshift is not configured (PROPONE_REDSHIFT_URL missing). Provide the PropOne Pakistan cluster URL, credentials with read access, and network reachability (VPN/allowlist).",
      };
    }
    return {
      ready: true,
      detail:
        "Redshift (PropOne Pakistan FMS) is connected. Work orders, visitor records and amenity bookings sync per property from the warehouse — map each property to its FMS project id and use 'Sync from Redshift'.",
    };
  }

  /**
   * Connectivity probe used by /admin/integrations. Runs `select 1` and, when
   * a schema is configured, verifies it exists. Never returns credentials.
   */
  async testConnection(): Promise<{ ok: boolean; detail: string }> {
    if (!env.PROPONE_REDSHIFT_URL) {
      return { ok: false, detail: "PROPONE_REDSHIFT_URL is not set." };
    }
    const pool = new Pool({
      connectionString: env.PROPONE_REDSHIFT_URL,
      max: 1,
      connectionTimeoutMillis: 8000,
      // Redshift requires TLS; managed clusters use AWS-signed certs.
      ssl: { rejectUnauthorized: false },
    });
    try {
      await pool.query("select 1");
      if (env.PROPONE_REDSHIFT_SCHEMA) {
        const res = await pool.query(
          "select 1 from information_schema.schemata where schema_name = $1",
          [env.PROPONE_REDSHIFT_SCHEMA],
        );
        if (res.rowCount === 0) {
          return {
            ok: false,
            detail: `Connected, but schema "${env.PROPONE_REDSHIFT_SCHEMA}" was not found in the warehouse.`,
          };
        }
      }
      return {
        ok: true,
        detail: `Connected to Redshift successfully${env.PROPONE_REDSHIFT_SCHEMA ? ` (schema "${env.PROPONE_REDSHIFT_SCHEMA}" found)` : ""}.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, detail: `Connection failed: ${message}` };
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  /**
   * Live sync from the PropOne Pakistan FMS schema. For every property with a
   * mapped `propOneExternalId` (= fms_projects.id) it pulls:
   *   - fms_work_orders          → propone_work_orders
   *   - fms_visits (+visitors)   → propone_visits   (visitor records)
   *   - fms_amenity_reservations → propone_bookings (amenities bookings)
   *
   * The warehouse tables are CDC snapshots — the latest row per business id is
   * taken. Synced rows are namespaced with the "RS-" externalId prefix and
   * replaced wholesale per property + domain inside a transaction, so re-syncs
   * are idempotent and pick up status changes/deletions without touching
   * CSV-imported rows. One audited sync run is recorded per property + domain.
   */
  async syncAll(actorUserId: string): Promise<{
    properties: number;
    workOrders: number;
    visits: number;
    bookings: number;
    errors: string[];
  }> {
    if (!env.PROPONE_REDSHIFT_URL) throw new Error("PROPONE_REDSHIFT_URL is not configured");
    const schema = env.PROPONE_REDSHIFT_SCHEMA ?? "propone_zameenpk";
    if (!/^[a-z0-9_]+$/i.test(schema)) throw new Error("Invalid PROPONE_REDSHIFT_SCHEMA");
    const t = (name: string) => `${schema}.${schema}__${name}`;

    const pool = new Pool({
      connectionString: env.PROPONE_REDSHIFT_URL,
      max: 1,
      connectionTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: false },
    });

    const summary = { properties: 0, workOrders: 0, visits: 0, bookings: 0, errors: [] as string[] };
    const hash = (v: unknown) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
    // Warehouse strings can contain NULs/control chars/lone surrogates that
    // PostgreSQL rejects ("untranslatable character") — sanitize everything.
    const clean = (s: string | null | undefined): string =>
      (s ?? "")
         
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/[\uD800-\uDFFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    try {
      const mapped = (await db.select().from(properties)).filter(
        (p) => p.active && p.propOneExternalId,
      );
      summary.properties = mapped.length;

      for (const property of mapped) {
        const projectId = Number(property.propOneExternalId);
        if (!Number.isInteger(projectId)) {
          summary.errors.push(`${property.name}: propOneExternalId is not a numeric FMS project id`);
          continue;
        }

        const recordRun = async (
          domain: "WORK_ORDERS" | "VISITS" | "AMENITY_BOOKINGS",
          fn: () => Promise<number>,
        ) => {
          const [run] = await db
            .insert(propOneSyncRuns)
            .values({
              mode: "REDSHIFT",
              status: "RUNNING",
              domain,
              propertyId: property.id,
              initiatedBy: actorUserId,
            })
            .returning();
          try {
            const imported = await fn();
            await db
              .update(propOneSyncRuns)
              .set({
                status: "SUCCESS",
                recordsProcessed: imported,
                recordsImported: imported,
                finishedAt: new Date(),
              })
              .where(eq(propOneSyncRuns.id, run!.id));
            return imported;
          } catch (err) {
            const message = clean(err instanceof Error ? err.message : String(err)).slice(0, 300);
            summary.errors.push(`${property.name} ${domain}: ${message}`);
            logger.error("Redshift sync failed", { property: property.code, domain, error: message });
            await db
              .update(propOneSyncRuns)
              .set({
                status: "FAILED",
                errorSummary: [{ row: 0, message }],
                finishedAt: new Date(),
              })
              .where(eq(propOneSyncRuns.id, run!.id));
            return 0;
          }
        };

        // ── Work orders ────────────────────────────────────────────────────
        summary.workOrders += await recordRun("WORK_ORDERS", async () => {
          const res = await pool.query(
            `with latest as (
               select *, row_number() over (partition by id order by operation_timestamp desc nulls last, updated_at desc nulls last) rn
               from ${t("fms_work_orders")} where project_id = $1
             )
             select w.id, w.name as issue, w.description, w.created_at, w.completion_date,
                    coalesce(s.name, 'Unknown') as status,
                    coalesce(u.name, u.unit_number, '') as unit
             from latest w
             left join ${t("statuses")} s on s.id = w.status_id
             left join ${t("fms_units")} u on u.id = w.unit_id
             where w.rn = 1 and lower(coalesce(w.operation_type,'')) <> 'delete'`,
            [projectId],
          );
          const rows = res.rows as Array<{
            id: string;
            issue: string | null;
            description: string | null;
            created_at: Date | null;
            completion_date: Date | null;
            status: string;
            unit: string;
          }>;
          await db.transaction(async (tx) => {
            await tx
              .delete(propOneWorkOrders)
              .where(
                and(
                  eq(propOneWorkOrders.propertyId, property.id),
                  like(propOneWorkOrders.externalId, "RS-%"),
                ),
              );
            for (const r of rows) {
              await tx.insert(propOneWorkOrders).values({
                propertyId: property.id,
                externalId: `RS-${r.id}`,
                issue: (clean(r.issue) || clean(r.description) || "Work order").slice(0, 500),
                unit: clean(r.unit),
                addedBy: "",
                orderDate: r.created_at ? r.created_at.toISOString().slice(0, 10) : null,
                serviceCharges: "",
                assignee: "",
                status: clean(r.status) || "Unknown",
                rawHash: hash(["wo", r]),
                sourceTimestamp: r.created_at,
              });
            }
          });
          return rows.length;
        });

        // ── Visitor records ────────────────────────────────────────────────
        summary.visits += await recordRun("VISITS", async () => {
          const res = await pool.query(
            `with latest as (
               select *, row_number() over (partition by id order by operation_timestamp desc nulls last, updated_at desc nulls last) rn
               from ${t("fms_visits")} where project_id = $1
             )
             select v.id, coalesce(vr.full_name, 'Visitor') as visitor_name,
                    coalesce(u.name, u.unit_number, '') as unit,
                    v.visit_purpose_name,
                    coalesce(v.actual_arrival_at, v.visit_start_time, v.created_at) as arrival_at,
                    v.visit_end_time as departure_at,
                    coalesce(s.name, 'Unknown') as status
             from latest v
             left join ${t("fms_visitors")} vr on vr.id = v.visitor_id
             left join ${t("fms_units")} u on u.id = v.unit_id
             left join ${t("statuses")} s on s.id = v.status_id
             where v.rn = 1 and v.deleted_at is null and lower(coalesce(v.operation_type,'')) <> 'delete'`,
            [projectId],
          );
          const rows = res.rows as Array<{
            id: string;
            visitor_name: string;
            unit: string;
            visit_purpose_name: string | null;
            arrival_at: Date | null;
            departure_at: Date | null;
            status: string;
          }>;
          await db.transaction(async (tx) => {
            await tx
              .delete(propOneVisits)
              .where(
                and(eq(propOneVisits.propertyId, property.id), like(propOneVisits.externalId, "RS-%")),
              );
            for (const r of rows) {
              if (!r.arrival_at) continue;
              await tx.insert(propOneVisits).values({
                propertyId: property.id,
                externalId: `RS-${r.id}`,
                visitorName: clean(r.visitor_name).slice(0, 200) || "Visitor",
                unit: clean(r.unit),
                residentName: "",
                arrivalAt: r.arrival_at,
                departureAt: r.departure_at,
                visitType: clean(r.visit_purpose_name).slice(0, 60) || null,
                status: clean(r.status) || "Unknown",
                rawHash: hash(["visit", r]),
                sourceTimestamp: r.arrival_at,
              });
            }
          });
          return rows.length;
        });

        // ── Amenity bookings ───────────────────────────────────────────────
        summary.bookings += await recordRun("AMENITY_BOOKINGS", async () => {
          const res = await pool.query(
            `with latest as (
               select *, row_number() over (partition by id order by operation_timestamp desc nulls last, updated_at desc nulls last) rn
               from ${t("fms_amenity_reservations")} where project_id = $1
             )
             select r.id, coalesce(a.name, 'Amenity') as amenity, r.slot_start, r.created_at,
                    coalesce(s.name, 'Unknown') as status
             from latest r
             left join ${t("fms_amenities")} a on a.id = r.amenity_id
             left join ${t("statuses")} s on s.id = r.status_id
             where r.rn = 1 and r.deleted_at is null and lower(coalesce(r.operation_type,'')) <> 'delete'`,
            [projectId],
          );
          const rows = res.rows as Array<{
            id: string;
            amenity: string;
            slot_start: Date | null;
            created_at: Date | null;
            status: string;
          }>;
          await db.transaction(async (tx) => {
            await tx
              .delete(propOneBookings)
              .where(
                and(
                  eq(propOneBookings.propertyId, property.id),
                  like(propOneBookings.externalId, "RS-%"),
                ),
              );
            for (const r of rows) {
              const when = r.slot_start ?? r.created_at;
              if (!when) continue;
              await tx.insert(propOneBookings).values({
                propertyId: property.id,
                externalId: `RS-${r.id}`,
                amenity: clean(r.amenity).slice(0, 100) || "Amenity",
                unit: "",
                bookedBy: "",
                bookingAt: when,
                status: clean(r.status) || "Unknown",
                rawHash: hash(["booking", r]),
                sourceTimestamp: when,
              });
            }
          });
          return rows.length;
        });
      }
      return summary;
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}
