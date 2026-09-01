import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Property master data. The portfolio is fully database-driven — navigation,
 * permissions, KPIs and reports all reference property rows, never hard-coded
 * names. Master fields without an authoritative source stay null and are
 * editable at /admin/properties.
 */
export const properties = pgTable("properties", {
  id: uuid().primaryKey().defaultRandom(),
  /** URL-safe unique code, e.g. "neo", "vault". */
  code: text().notNull().unique(),
  name: text().notNull(),
  location: text(),
  propertyType: text(),
  areaSqFt: integer(),
  /** Human display label for area, e.g. "300,000+ Sft" (reference style). */
  areaLabel: text(),
  developmentStatus: text(),
  /** Configurable operational status label (semantics owned by management). */
  operationalStatus: text(),
  /**
   * Sidebar status indicator token: "green" | "orange" | "blue" | "grey".
   * The business meaning of the reference dots is unresolved — see
   * docs/decisions.md — so this is display metadata only.
   */
  statusIndicator: text(),
  /** Free-form phase code (e.g. "P0"); semantics unresolved, configurable. */
  phaseCode: text(),
  displayOrder: integer().notNull().default(0),
  active: boolean().notNull().default(true),
  heroImageKey: text(),
  propOneExternalId: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
