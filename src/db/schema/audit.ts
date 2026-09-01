import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { user } from "./auth";

/**
 * Immutable audit trail. Rows are insert-only — the application never updates
 * or deletes them. Never store passwords, tokens or session material here.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorUserId: text().references(() => user.id),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    propertyId: uuid().references(() => properties.id),
    beforeData: jsonb(),
    afterData: jsonb(),
    metadata: jsonb(),
    ip: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_property_idx").on(t.propertyId),
    index("audit_logs_actor_idx").on(t.actorUserId),
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_action_idx").on(t.action),
  ],
);
