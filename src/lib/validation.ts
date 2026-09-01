import { z } from "zod";
import { SEVERITIES } from "@/lib/compliance";
import { isIsoDate } from "@/lib/week";

/** Shared Zod schemas for all server-bound payloads (client hints + server truth). */

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, { message: "Expected a valid yyyy-MM-dd date" });

export const uuidSchema = z.uuid();

export const severitySchema = z.enum(SEVERITIES);

export const checklistResponseInput = z.object({
  checklistItemId: uuidSchema,
  op: z.boolean(),
  cl: z.boolean(),
  comment: z.string().trim().max(2000).default(""),
  severity: severitySchema.nullable().optional().default(null),
});

export const checklistEntryPayload = z.object({
  categoryId: uuidSchema,
  entryDate: isoDateSchema,
  fields: z.record(uuidSchema, z.string().max(2000)).default({}),
  responses: z.array(checklistResponseInput).max(200).default([]),
  signDutyTechnician: z.string().trim().max(200).default(""),
  signAmAdmin: z.string().trim().max(200).default(""),
  signManagerAdmin: z.string().trim().max(200).default(""),
});
export type ChecklistEntryPayload = z.infer<typeof checklistEntryPayload>;

export const weeklyTaskInput = z.object({
  task: z.string().trim().min(1, "Task description is required").max(1000),
  status: z.enum(["COMPLETED", "IN_PROCESS"]),
  etaDate: isoDateSchema.nullable().optional().default(null),
});

export const weeklyReportPayload = z.object({
  weekStart: isoDateSchema.refine((d) => {
    // must be a Monday
    return new Date(`${d}T00:00:00Z`).getUTCDay() === 1;
  }, "weekStart must be a Monday"),
  trackingStatus: z.enum(["ON_TRACK", "WATCH", "AT_RISK"]),
  summary: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(5000).default(""),
  tasks: z.array(weeklyTaskInput).max(100).default([]),
});
export type WeeklyReportPayload = z.infer<typeof weeklyReportPayload>;

export const reviewDecisionPayload = z.object({
  kind: z.enum(["checklist", "weekly"]),
  id: uuidSchema,
  note: z.string().trim().max(2000).optional().default(""),
});

export const returnPayload = z.object({
  kind: z.enum(["checklist", "weekly"]),
  id: uuidSchema,
  reason: z.string().trim().min(3, "A return reason is required").max(2000),
});

export const captionSchema = z.string().trim().max(300).default("");

// ── Admin ──────────────────────────────────────────────────────────────────

export const createUserPayload = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(200),
    password: z.string().min(10).max(200),
    role: z.enum(["SITE_USER", "ASSISTANT_MANAGER", "MANAGER_ADMIN"]),
    propertyId: uuidSchema.nullable().optional().default(null),
  })
  .refine((v) => v.role !== "SITE_USER" || v.propertyId != null, {
    message: "A Site User must be assigned to a property",
    path: ["propertyId"],
  });

export const updateUserPayload = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["SITE_USER", "ASSISTANT_MANAGER", "MANAGER_ADMIN"]),
    propertyId: uuidSchema.nullable().optional().default(null),
  })
  .refine((v) => v.role !== "SITE_USER" || v.propertyId != null, {
    message: "A Site User must be assigned to a property",
    path: ["propertyId"],
  });

export const propertyPayload = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,40}$/, "Lowercase letters, digits and dashes only"),
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(200).nullable().optional().default(null),
  propertyType: z.string().trim().max(120).nullable().optional().default(null),
  areaSqFt: z.number().int().positive().nullable().optional().default(null),
  areaLabel: z.string().trim().max(60).nullable().optional().default(null),
  developmentStatus: z.string().trim().max(120).nullable().optional().default(null),
  operationalStatus: z.string().trim().max(120).nullable().optional().default(null),
  statusIndicator: z.enum(["green", "orange", "blue", "grey"]).nullable().optional().default(null),
  phaseCode: z.string().trim().max(20).nullable().optional().default(null),
  displayOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type PropertyPayload = z.infer<typeof propertyPayload>;

// ── Filters / pagination ───────────────────────────────────────────────────

export const reviewFilterSchema = z.object({
  property: z.string().trim().max(60).optional(),
  type: z.enum(["checklist", "weekly"]).optional(),
  status: z.enum(["SUBMITTED", "RETURNED", "APPROVED", "PUBLISHED", "DRAFT"]).optional(),
  category: z.string().trim().max(80).optional(),
  week: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const propOneDomainSchema = z.enum([
  "WORK_ORDERS",
  "VISITS",
  "VISITORS",
  "CINEMA_BOOKINGS",
  "AMENITY_BOOKINGS",
  "VEHICLE_STICKERS",
  "ANNOUNCEMENTS",
]);
