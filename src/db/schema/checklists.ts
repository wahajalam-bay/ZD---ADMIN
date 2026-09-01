import {
  boolean,
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
import { categoryTypeEnum, severityEnum, workflowStatusEnum } from "./enums";

/**
 * Checklist definitions are seeded 1:1 from the reference Data Entry Engine
 * (22 categories). Keys are stable; labels may be edited without breaking data.
 */
export const checklistCategories = pgTable(
  "checklist_categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull().unique(),
    name: text().notNull(),
    type: categoryTypeEnum().notNull(),
    sortOrder: integer().notNull().default(0),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("checklist_categories_sort_idx").on(t.sortOrder)],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => checklistCategories.id),
    name: text().notNull(),
    sortOrder: integer().notNull().default(0),
    active: boolean().notNull().default(true),
  },
  (t) => [index("checklist_items_category_idx").on(t.categoryId)],
);

/** Category-level fields (genset readings, fuel refills, …). */
export const checklistFieldDefinitions = pgTable(
  "checklist_field_definitions",
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => checklistCategories.id),
    key: text().notNull(),
    label: text().notNull(),
    fieldType: text().notNull().default("text"),
    required: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [
    uniqueIndex("checklist_field_defs_category_key_idx").on(t.categoryId, t.key),
    index("checklist_field_defs_category_idx").on(t.categoryId),
  ],
);

/** One entry per property + category + calendar day. */
export const checklistEntries = pgTable(
  "checklist_entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
    categoryId: uuid()
      .notNull()
      .references(() => checklistCategories.id),
    entryDate: date({ mode: "string" }).notNull(),
    workflowStatus: workflowStatusEnum().notNull().default("DRAFT"),
    // Sign-off names preserved from the reference engine; authenticated user
    // ids + timestamps below provide the auditable counterpart.
    signDutyTechnician: text().notNull().default(""),
    signAmAdmin: text().notNull().default(""),
    signManagerAdmin: text().notNull().default(""),
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
    uniqueIndex("checklist_entries_unique_day_idx").on(t.propertyId, t.categoryId, t.entryDate),
    index("checklist_entries_property_date_idx").on(t.propertyId, t.entryDate),
    index("checklist_entries_status_idx").on(t.workflowStatus),
    index("checklist_entries_category_idx").on(t.categoryId),
    index("checklist_entries_date_idx").on(t.entryDate),
  ],
);

export const checklistFieldValues = pgTable(
  "checklist_field_values",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => checklistEntries.id, { onDelete: "cascade" }),
    fieldDefinitionId: uuid()
      .notNull()
      .references(() => checklistFieldDefinitions.id),
    value: text().notNull().default(""),
  },
  (t) => [
    uniqueIndex("checklist_field_values_unique_idx").on(t.entryId, t.fieldDefinitionId),
    index("checklist_field_values_entry_idx").on(t.entryId),
  ],
);

/**
 * Per-item response. OP/CL semantics preserved verbatim from the reference
 * engine (opening / closing check marks). `comment` is the defect/comment
 * column; `severity` only applies when an issue is recorded (see decisions.md).
 */
export const checklistResponses = pgTable(
  "checklist_responses",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid()
      .notNull()
      .references(() => checklistEntries.id, { onDelete: "cascade" }),
    checklistItemId: uuid()
      .notNull()
      .references(() => checklistItems.id),
    op: boolean().notNull().default(false),
    cl: boolean().notNull().default(false),
    comment: text().notNull().default(""),
    severity: severityEnum(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("checklist_responses_unique_idx").on(t.entryId, t.checklistItemId),
    index("checklist_responses_entry_idx").on(t.entryId),
    index("checklist_responses_item_idx").on(t.checklistItemId),
  ],
);

/**
 * NON-NEGOTIABLE relationship: every evidence photo belongs to exactly one
 * checklist response (property → category → item → date → response → photo).
 */
export const checklistResponsePhotos = pgTable(
  "checklist_response_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    checklistResponseId: uuid()
      .notNull()
      .references(() => checklistResponses.id, { onDelete: "cascade" }),
    propertyId: uuid()
      .notNull()
      .references(() => properties.id),
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
    index("checklist_response_photos_response_idx").on(t.checklistResponseId),
    index("checklist_response_photos_property_idx").on(t.propertyId),
  ],
);
