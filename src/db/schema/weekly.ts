import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { user } from "./auth";
import { mediaTypeEnum, taskStatusEnum, trackingStatusEnum, workflowStatusEnum } from "./enums";

/** One weekly report per property per reporting week (weekStart = Monday). */
export const weeklyReports = pgTable(
  "weekly_reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    weekStart: date({ mode: "string" }).notNull(),
    trackingStatus: trackingStatusEnum().notNull().default("ON_TRACK"),
    summary: text().notNull().default(""),
    notes: text().notNull().default(""),
    workflowStatus: workflowStatusEnum().notNull().default("DRAFT"),
    createdBy: text()
      .notNull()
      .references(() => user.id),
    submittedBy: text().references(() => user.id),
    submittedAt: timestamp({ withTimezone: true }),
    reviewedBy: text().references(() => user.id),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewNotes: text(),
    returnedBy: text().references(() => user.id),
    returnedAt: timestamp({ withTimezone: true }),
    returnReason: text(),
    approvedBy: text().references(() => user.id),
    approvedAt: timestamp({ withTimezone: true }),
    publishedBy: text().references(() => user.id),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("weekly_reports_unique_week_idx").on(t.propertyId, t.weekStart),
    index("weekly_reports_week_idx").on(t.weekStart),
    index("weekly_reports_status_idx").on(t.workflowStatus),
    index("weekly_reports_property_idx").on(t.propertyId),
  ],
);

export const weeklyTasks = pgTable(
  "weekly_tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    weeklyReportId: uuid()
      .notNull()
      .references(() => weeklyReports.id, { onDelete: "cascade" }),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    task: text().notNull(),
    status: taskStatusEnum().notNull().default("IN_PROCESS"),
    /** ETA for in-process tasks / completion date for completed ones. */
    etaDate: date({ mode: "string" }),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("weekly_tasks_report_idx").on(t.weeklyReportId),
    index("weekly_tasks_property_idx").on(t.propertyId),
    index("weekly_tasks_status_idx").on(t.status),
  ],
);

/** Weekly/progress media — deliberately separate from checklist evidence. */
export const weeklyMedia = pgTable(
  "weekly_media",
  {
    id: uuid().primaryKey().defaultRandom(),
    weeklyReportId: uuid()
      .notNull()
      .references(() => weeklyReports.id, { onDelete: "cascade" }),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    mediaType: mediaTypeEnum().notNull().default("IMAGE"),
    storageKey: text().notNull().unique(),
    thumbnailKey: text().notNull(),
    originalFilename: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: integer().notNull(),
    width: integer(),
    height: integer(),
    caption: text().notNull().default(""),
    uploadedBy: text()
      .notNull()
      .references(() => user.id),
    uploadedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("weekly_media_report_idx").on(t.weeklyReportId),
    index("weekly_media_property_idx").on(t.propertyId),
    index("weekly_media_type_idx").on(t.mediaType),
  ],
);
