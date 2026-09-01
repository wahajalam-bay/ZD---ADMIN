import { Pool } from "pg";
import { env } from "@/server/env";
import type { PropOneAdapter } from "./types";

/**
 * Amazon Redshift adapter for the PropOne Pakistan warehouse.
 *
 * Redshift speaks the PostgreSQL wire protocol, so the standard `pg` driver
 * connects directly — set PROPONE_REDSHIFT_URL, e.g.
 *   postgres://user:pass@my-cluster.xxxxx.region.redshift.amazonaws.com:5439/db
 * (plus PROPONE_REDSHIFT_SCHEMA when the PropOne tables live outside `public`).
 *
 * What is deliberately NOT implemented yet: the table/column mapping. The
 * PropOne Pakistan warehouse schema (table names, columns, property keys) has
 * not been provided, and this codebase does not invent external schemas.
 * Once the schema is known, implement `fetchRecords` here to SELECT from the
 * warehouse and normalize into the existing NormalizedRecord shapes — storage,
 * dedupe, provenance and all dashboards are already wired to consume them.
 */
export class PropOneRedshiftAdapter implements PropOneAdapter {
  readonly mode = "REDSHIFT" as const;

  describe() {
    if (!env.PROPONE_REDSHIFT_URL) {
      return {
        ready: false,
        detail:
          "Redshift is not configured (PROPONE_REDSHIFT_URL missing). Provide the PropOne Pakistan cluster URL, credentials with read access, network reachability (VPN/allowlist), and the schema/table names.",
      };
    }
    return {
      ready: false,
      detail:
        "Redshift connection is configured. The PropOne Pakistan table mapping is pending the warehouse schema — use 'Test Redshift connection' to verify connectivity, and supply the table/column layout to enable syncing.",
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
        detail: `Connected to Redshift successfully${env.PROPONE_REDSHIFT_SCHEMA ? ` (schema "${env.PROPONE_REDSHIFT_SCHEMA}" found)` : ""}. Table mapping is the remaining step.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, detail: `Connection failed: ${message}` };
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}
