import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { user } from "./auth";
import { propOneDomainEnum, syncModeEnum, syncStatusEnum } from "./enums";

/** Provenance for every PropOne ingestion (API sync or controlled file import). */
export const propOneSyncRuns = pgTable(
  "propone_sync_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    mode: syncModeEnum().notNull(),
    status: syncStatusEnum().notNull().default("RUNNING"),
    domain: propOneDomainEnum(),
    propertyId: uuid().references(() => properties.id),
    filename: text(),
    recordsProcessed: integer().notNull().default(0),
    recordsImported: integer().notNull().default(0),
    recordsRejected: integer().notNull().default(0),
    errorSummary: jsonb(),
    initiatedBy: text().references(() => user.id),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("propone_sync_runs_started_idx").on(t.startedAt),
    index("propone_sync_runs_status_idx").on(t.status),
  ],
);

const provenance = {
  syncRunId: uuid().references(() => propOneSyncRuns.id),
  /** Hash of the normalized source row — used for idempotent re-imports. */
  rawHash: text().notNull(),
  sourceTimestamp: timestamp({ withTimezone: true }),
  importedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

export const propOneWorkOrders = pgTable(
  "propone_work_orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    externalId: text(),
    issue: text().notNull(),
    unit: text().notNull().default(""),
    addedBy: text().notNull().default(""),
    orderDate: date({ mode: "string" }),
    serviceCharges: text().notNull().default(""),
    assignee: text().notNull().default(""),
    status: text().notNull(),
    ...provenance,
  },
  (t) => [
    uniqueIndex("propone_work_orders_dedupe_idx").on(t.propertyId, t.rawHash),
    index("propone_work_orders_property_idx").on(t.propertyId),
    index("propone_work_orders_status_idx").on(t.status),
    index("propone_work_orders_date_idx").on(t.orderDate),
    index("propone_work_orders_external_idx").on(t.externalId),
  ],
);

/** Visits and visitors share one normalized shape (reference: visits + visitor logs). */
export const propOneVisits = pgTable(
  "propone_visits",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    externalId: text(),
    visitorName: text().notNull(),
    unit: text().notNull().default(""),
    residentName: text().notNull().default(""),
    arrivalAt: timestamp({ withTimezone: true }).notNull(),
    departureAt: timestamp({ withTimezone: true }),
    /** e.g. EXTENDED_STAY / SHORT_VISIT when the source provides it. */
    visitType: text(),
    status: text().notNull(),
    ...provenance,
  },
  (t) => [
    uniqueIndex("propone_visits_dedupe_idx").on(t.propertyId, t.rawHash),
    index("propone_visits_property_idx").on(t.propertyId),
    index("propone_visits_arrival_idx").on(t.arrivalAt),
    index("propone_visits_status_idx").on(t.status),
    index("propone_visits_external_idx").on(t.externalId),
  ],
);

/** Amenity bookings (cinema, snooker, …) with status Attended / Pre-booked / Cancelled. */
export const propOneBookings = pgTable(
  "propone_bookings",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    externalId: text(),
    amenity: text().notNull(),
    unit: text().notNull().default(""),
    bookedBy: text().notNull().default(""),
    bookingAt: timestamp({ withTimezone: true }).notNull(),
    status: text().notNull(),
    ...provenance,
  },
  (t) => [
    uniqueIndex("propone_bookings_dedupe_idx").on(t.propertyId, t.rawHash),
    index("propone_bookings_property_idx").on(t.propertyId),
    index("propone_bookings_amenity_idx").on(t.amenity),
    index("propone_bookings_at_idx").on(t.bookingAt),
  ],
);

export const propOneVehicleStickers = pgTable(
  "propone_vehicle_stickers",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    externalId: text(),
    unit: text().notNull().default(""),
    ownerName: text().notNull().default(""),
    vehicle: text().notNull().default(""),
    /** e.g. OWNER / LTR (long-term rental) as demonstrated by the reference. */
    stickerType: text().notNull().default(""),
    issuedDate: date({ mode: "string" }),
    ...provenance,
  },
  (t) => [
    uniqueIndex("propone_vehicle_stickers_dedupe_idx").on(t.propertyId, t.rawHash),
    index("propone_vehicle_stickers_property_idx").on(t.propertyId),
    index("propone_vehicle_stickers_issued_idx").on(t.issuedDate),
  ],
);

export const propOneAnnouncements = pgTable(
  "propone_announcements",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    externalId: text(),
    title: text().notNull(),
    body: text().notNull().default(""),
    audience: text().notNull().default(""),
    sentAt: timestamp({ withTimezone: true }).notNull(),
    ...provenance,
  },
  (t) => [
    uniqueIndex("propone_announcements_dedupe_idx").on(t.propertyId, t.rawHash),
    index("propone_announcements_property_idx").on(t.propertyId),
    index("propone_announcements_sent_idx").on(t.sentAt),
  ],
);

/**
 * Which PropOne widgets each property's dashboard shows. The real mapping
 * between the nine production properties and PropOne datasets is pending —
 * widgets are configuration, not code (see docs/decisions.md).
 */
export const propOneWidgetConfigs = pgTable(
  "propone_widget_configs",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    metricDomain: propOneDomainEnum().notNull(),
    displayLabel: text(),
    sortOrder: integer().notNull().default(0),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("propone_widget_configs_unique_idx").on(t.propertyId, t.metricDomain),
    index("propone_widget_configs_property_idx").on(t.propertyId),
  ],
);
