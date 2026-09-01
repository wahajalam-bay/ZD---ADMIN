import { z } from "zod";
import { isIsoDate } from "@/lib/week";

/** Zod validation for imported PropOne rows (CSV). Malformed rows are rejected
 * individually and reported — never silently accepted. */

const isoDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isIsoDate(v), "Expected yyyy-MM-dd or empty");

const isoDateTime = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Expected an ISO date-time");

const optionalIsoDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(new Date(v).getTime()), "Expected an ISO date-time or empty");

export const workOrderRowSchema = z.object({
  external_id: z.string().trim().max(100).default(""),
  issue: z.string().trim().min(1, "issue is required").max(500),
  unit: z.string().trim().max(100).default(""),
  added_by: z.string().trim().max(200).default(""),
  order_date: isoDate.default(""),
  service_charges: z.string().trim().max(100).default(""),
  assignee: z.string().trim().max(200).default(""),
  status: z.string().trim().min(1, "status is required").max(100),
});

export const visitRowSchema = z.object({
  external_id: z.string().trim().max(100).default(""),
  visitor_name: z.string().trim().min(1, "visitor_name is required").max(200),
  unit: z.string().trim().max(100).default(""),
  resident_name: z.string().trim().max(200).default(""),
  arrival_at: isoDateTime,
  departure_at: optionalIsoDateTime.default(""),
  visit_type: z.string().trim().max(60).default(""),
  status: z.string().trim().min(1, "status is required").max(100),
});

export const bookingRowSchema = z.object({
  external_id: z.string().trim().max(100).default(""),
  amenity: z.string().trim().min(1, "amenity is required").max(100),
  unit: z.string().trim().max(100).default(""),
  booked_by: z.string().trim().max(200).default(""),
  booking_at: isoDateTime,
  status: z.string().trim().min(1, "status is required").max(100),
});

export const vehicleStickerRowSchema = z.object({
  external_id: z.string().trim().max(100).default(""),
  unit: z.string().trim().max(100).default(""),
  owner_name: z.string().trim().max(200).default(""),
  vehicle: z.string().trim().max(200).default(""),
  sticker_type: z.string().trim().max(60).default(""),
  issued_date: isoDate.default(""),
});

export const announcementRowSchema = z.object({
  external_id: z.string().trim().max(100).default(""),
  title: z.string().trim().min(1, "title is required").max(300),
  body: z.string().trim().max(5000).default(""),
  audience: z.string().trim().max(200).default(""),
  sent_at: isoDateTime,
});

export const CSV_TEMPLATES: Record<string, string> = {
  WORK_ORDERS: "external_id,issue,unit,added_by,order_date,service_charges,assignee,status",
  VISITS: "external_id,visitor_name,unit,resident_name,arrival_at,departure_at,visit_type,status",
  VISITORS: "external_id,visitor_name,unit,resident_name,arrival_at,departure_at,visit_type,status",
  CINEMA_BOOKINGS: "external_id,amenity,unit,booked_by,booking_at,status",
  AMENITY_BOOKINGS: "external_id,amenity,unit,booked_by,booking_at,status",
  VEHICLE_STICKERS: "external_id,unit,owner_name,vehicle,sticker_type,issued_date",
  ANNOUNCEMENTS: "external_id,title,body,audience,sent_at",
};
