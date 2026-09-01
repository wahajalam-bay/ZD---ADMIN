import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Workflow lifecycle shared by checklist entries and weekly reports.
 * DRAFT → SUBMITTED → (RETURNED → SUBMITTED)* → APPROVED → PUBLISHED
 */
export const workflowStatusEnum = pgEnum("workflow_status", [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "APPROVED",
  "PUBLISHED",
]);

/** Category types preserved from the reference Data Entry Engine schema. */
export const categoryTypeEnum = pgEnum("category_type", ["CHECK", "LOG", "EVAL"]);

export const trackingStatusEnum = pgEnum("tracking_status", ["ON_TRACK", "WATCH", "AT_RISK"]);

export const taskStatusEnum = pgEnum("task_status", ["COMPLETED", "IN_PROCESS"]);

export const severityEnum = pgEnum("severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

export const mediaTypeEnum = pgEnum("media_type", ["IMAGE", "VIDEO"]);

export const userRoleEnum = pgEnum("user_role", [
  "SITE_USER",
  "ASSISTANT_MANAGER",
  "MANAGER_ADMIN",
]);

export const propOneDomainEnum = pgEnum("propone_domain", [
  "WORK_ORDERS",
  "VISITS",
  "VISITORS",
  "CINEMA_BOOKINGS",
  "AMENITY_BOOKINGS",
  "VEHICLE_STICKERS",
  "ANNOUNCEMENTS",
]);

export const syncModeEnum = pgEnum("sync_mode", ["API", "FILE_IMPORT"]);

export const syncStatusEnum = pgEnum("sync_status", [
  "RUNNING",
  "SUCCESS",
  "PARTIAL",
  "FAILED",
]);
