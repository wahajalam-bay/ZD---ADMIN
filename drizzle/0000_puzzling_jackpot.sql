CREATE TYPE "public"."category_type" AS ENUM('CHECK', 'LOG', 'EVAL');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('IMAGE', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."propone_domain" AS ENUM('WORK_ORDERS', 'VISITS', 'VISITORS', 'CINEMA_BOOKINGS', 'AMENITY_BOOKINGS', 'VEHICLE_STICKERS', 'ANNOUNCEMENTS');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."sync_mode" AS ENUM('API', 'FILE_IMPORT');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('COMPLETED', 'IN_PROCESS');--> statement-breakpoint
CREATE TYPE "public"."tracking_status" AS ENUM('ON_TRACK', 'WATCH', 'AT_RISK');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SITE_USER', 'ASSISTANT_MANAGER', 'MANAGER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED', 'PUBLISHED');--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"property_type" text,
	"area_sq_ft" integer,
	"area_label" text,
	"development_status" text,
	"operational_status" text,
	"status_indicator" text,
	"phase_code" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"hero_image_key" text,
	"prop_one_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'SITE_USER' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"property_id" uuid,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" "category_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "checklist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"workflow_status" "workflow_status" DEFAULT 'DRAFT' NOT NULL,
	"sign_duty_technician" text DEFAULT '' NOT NULL,
	"sign_am_admin" text DEFAULT '' NOT NULL,
	"sign_manager_admin" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"returned_by" text,
	"returned_at" timestamp with time zone,
	"return_reason" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" text DEFAULT 'text' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"field_definition_id" uuid NOT NULL,
	"value" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_response_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_response_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text DEFAULT '' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklist_response_photos_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "checklist_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"checklist_item_id" uuid NOT NULL,
	"op" boolean DEFAULT false NOT NULL,
	"cl" boolean DEFAULT false NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"severity" "severity",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_report_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"media_type" "media_type" DEFAULT 'IMAGE' NOT NULL,
	"storage_key" text NOT NULL,
	"thumbnail_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text DEFAULT '' NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_media_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"tracking_status" "tracking_status" DEFAULT 'ON_TRACK' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"workflow_status" "workflow_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"returned_by" text,
	"returned_at" timestamp with time zone,
	"return_reason" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_report_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"task" text NOT NULL,
	"status" "task_status" DEFAULT 'IN_PROCESS' NOT NULL,
	"eta_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"property_id" uuid,
	"before_data" jsonb,
	"after_data" jsonb,
	"metadata" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propone_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"audience" text DEFAULT '' NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"sync_run_id" uuid,
	"raw_hash" text NOT NULL,
	"source_timestamp" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propone_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"external_id" text,
	"amenity" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"booked_by" text DEFAULT '' NOT NULL,
	"booking_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"sync_run_id" uuid,
	"raw_hash" text NOT NULL,
	"source_timestamp" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propone_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" "sync_mode" NOT NULL,
	"status" "sync_status" DEFAULT 'RUNNING' NOT NULL,
	"domain" "propone_domain",
	"property_id" uuid,
	"filename" text,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_imported" integer DEFAULT 0 NOT NULL,
	"records_rejected" integer DEFAULT 0 NOT NULL,
	"error_summary" jsonb,
	"initiated_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "propone_vehicle_stickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"external_id" text,
	"unit" text DEFAULT '' NOT NULL,
	"owner_name" text DEFAULT '' NOT NULL,
	"vehicle" text DEFAULT '' NOT NULL,
	"sticker_type" text DEFAULT '' NOT NULL,
	"issued_date" date,
	"sync_run_id" uuid,
	"raw_hash" text NOT NULL,
	"source_timestamp" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propone_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"external_id" text,
	"visitor_name" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"resident_name" text DEFAULT '' NOT NULL,
	"arrival_at" timestamp with time zone NOT NULL,
	"departure_at" timestamp with time zone,
	"visit_type" text,
	"status" text NOT NULL,
	"sync_run_id" uuid,
	"raw_hash" text NOT NULL,
	"source_timestamp" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propone_widget_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"metric_domain" "propone_domain" NOT NULL,
	"display_label" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "propone_work_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"external_id" text,
	"issue" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"added_by" text DEFAULT '' NOT NULL,
	"order_date" date,
	"service_charges" text DEFAULT '' NOT NULL,
	"assignee" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"sync_run_id" uuid,
	"raw_hash" text NOT NULL,
	"source_timestamp" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_category_id_checklist_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."checklist_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_returned_by_user_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_entries" ADD CONSTRAINT "checklist_entries_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_field_definitions" ADD CONSTRAINT "checklist_field_definitions_category_id_checklist_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."checklist_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_field_values" ADD CONSTRAINT "checklist_field_values_entry_id_checklist_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."checklist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_field_values" ADD CONSTRAINT "checklist_field_values_field_definition_id_checklist_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."checklist_field_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_category_id_checklist_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."checklist_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_response_photos" ADD CONSTRAINT "checklist_response_photos_checklist_response_id_checklist_responses_id_fk" FOREIGN KEY ("checklist_response_id") REFERENCES "public"."checklist_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_response_photos" ADD CONSTRAINT "checklist_response_photos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_response_photos" ADD CONSTRAINT "checklist_response_photos_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_entry_id_checklist_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."checklist_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_media" ADD CONSTRAINT "weekly_media_weekly_report_id_weekly_reports_id_fk" FOREIGN KEY ("weekly_report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_media" ADD CONSTRAINT "weekly_media_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_media" ADD CONSTRAINT "weekly_media_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_returned_by_user_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_tasks" ADD CONSTRAINT "weekly_tasks_weekly_report_id_weekly_reports_id_fk" FOREIGN KEY ("weekly_report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_tasks" ADD CONSTRAINT "weekly_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_announcements" ADD CONSTRAINT "propone_announcements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_announcements" ADD CONSTRAINT "propone_announcements_sync_run_id_propone_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."propone_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_bookings" ADD CONSTRAINT "propone_bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_bookings" ADD CONSTRAINT "propone_bookings_sync_run_id_propone_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."propone_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_sync_runs" ADD CONSTRAINT "propone_sync_runs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_sync_runs" ADD CONSTRAINT "propone_sync_runs_initiated_by_user_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_vehicle_stickers" ADD CONSTRAINT "propone_vehicle_stickers_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_vehicle_stickers" ADD CONSTRAINT "propone_vehicle_stickers_sync_run_id_propone_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."propone_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_visits" ADD CONSTRAINT "propone_visits_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_visits" ADD CONSTRAINT "propone_visits_sync_run_id_propone_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."propone_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_widget_configs" ADD CONSTRAINT "propone_widget_configs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_work_orders" ADD CONSTRAINT "propone_work_orders_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "propone_work_orders" ADD CONSTRAINT "propone_work_orders_sync_run_id_propone_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."propone_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_property_idx" ON "user" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "checklist_categories_sort_idx" ON "checklist_categories" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_entries_unique_day_idx" ON "checklist_entries" USING btree ("property_id","category_id","entry_date");--> statement-breakpoint
CREATE INDEX "checklist_entries_property_date_idx" ON "checklist_entries" USING btree ("property_id","entry_date");--> statement-breakpoint
CREATE INDEX "checklist_entries_status_idx" ON "checklist_entries" USING btree ("workflow_status");--> statement-breakpoint
CREATE INDEX "checklist_entries_category_idx" ON "checklist_entries" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "checklist_entries_date_idx" ON "checklist_entries" USING btree ("entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_field_defs_category_key_idx" ON "checklist_field_definitions" USING btree ("category_id","key");--> statement-breakpoint
CREATE INDEX "checklist_field_defs_category_idx" ON "checklist_field_definitions" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_field_values_unique_idx" ON "checklist_field_values" USING btree ("entry_id","field_definition_id");--> statement-breakpoint
CREATE INDEX "checklist_field_values_entry_idx" ON "checklist_field_values" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "checklist_items_category_idx" ON "checklist_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "checklist_response_photos_response_idx" ON "checklist_response_photos" USING btree ("checklist_response_id");--> statement-breakpoint
CREATE INDEX "checklist_response_photos_property_idx" ON "checklist_response_photos" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_responses_unique_idx" ON "checklist_responses" USING btree ("entry_id","checklist_item_id");--> statement-breakpoint
CREATE INDEX "checklist_responses_entry_idx" ON "checklist_responses" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "checklist_responses_item_idx" ON "checklist_responses" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX "weekly_media_report_idx" ON "weekly_media" USING btree ("weekly_report_id");--> statement-breakpoint
CREATE INDEX "weekly_media_property_idx" ON "weekly_media" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "weekly_media_type_idx" ON "weekly_media" USING btree ("media_type");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reports_unique_week_idx" ON "weekly_reports" USING btree ("property_id","week_start");--> statement-breakpoint
CREATE INDEX "weekly_reports_week_idx" ON "weekly_reports" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "weekly_reports_status_idx" ON "weekly_reports" USING btree ("workflow_status");--> statement-breakpoint
CREATE INDEX "weekly_reports_property_idx" ON "weekly_reports" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "weekly_tasks_report_idx" ON "weekly_tasks" USING btree ("weekly_report_id");--> statement-breakpoint
CREATE INDEX "weekly_tasks_property_idx" ON "weekly_tasks" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "weekly_tasks_status_idx" ON "weekly_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_property_idx" ON "audit_logs" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "propone_announcements_dedupe_idx" ON "propone_announcements" USING btree ("property_id","raw_hash");--> statement-breakpoint
CREATE INDEX "propone_announcements_property_idx" ON "propone_announcements" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "propone_announcements_sent_idx" ON "propone_announcements" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "propone_bookings_dedupe_idx" ON "propone_bookings" USING btree ("property_id","raw_hash");--> statement-breakpoint
CREATE INDEX "propone_bookings_property_idx" ON "propone_bookings" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "propone_bookings_amenity_idx" ON "propone_bookings" USING btree ("amenity");--> statement-breakpoint
CREATE INDEX "propone_bookings_at_idx" ON "propone_bookings" USING btree ("booking_at");--> statement-breakpoint
CREATE INDEX "propone_sync_runs_started_idx" ON "propone_sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "propone_sync_runs_status_idx" ON "propone_sync_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "propone_vehicle_stickers_dedupe_idx" ON "propone_vehicle_stickers" USING btree ("property_id","raw_hash");--> statement-breakpoint
CREATE INDEX "propone_vehicle_stickers_property_idx" ON "propone_vehicle_stickers" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "propone_vehicle_stickers_issued_idx" ON "propone_vehicle_stickers" USING btree ("issued_date");--> statement-breakpoint
CREATE UNIQUE INDEX "propone_visits_dedupe_idx" ON "propone_visits" USING btree ("property_id","raw_hash");--> statement-breakpoint
CREATE INDEX "propone_visits_property_idx" ON "propone_visits" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "propone_visits_arrival_idx" ON "propone_visits" USING btree ("arrival_at");--> statement-breakpoint
CREATE INDEX "propone_visits_status_idx" ON "propone_visits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "propone_visits_external_idx" ON "propone_visits" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "propone_widget_configs_unique_idx" ON "propone_widget_configs" USING btree ("property_id","metric_domain");--> statement-breakpoint
CREATE INDEX "propone_widget_configs_property_idx" ON "propone_widget_configs" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "propone_work_orders_dedupe_idx" ON "propone_work_orders" USING btree ("property_id","raw_hash");--> statement-breakpoint
CREATE INDEX "propone_work_orders_property_idx" ON "propone_work_orders" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "propone_work_orders_status_idx" ON "propone_work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "propone_work_orders_date_idx" ON "propone_work_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "propone_work_orders_external_idx" ON "propone_work_orders" USING btree ("external_id");