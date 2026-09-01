import type { PropOneDomain } from "@/lib/propone-metrics";

/**
 * PropOne is an EXTERNAL system. No API endpoint, credential or proprietary
 * schema has been provided — this module defines the integration boundary so
 * the real feed can be connected later without touching the Command Center.
 * See docs/decisions.md → "PropOne connectivity".
 */

export interface NormalizedWorkOrder {
  externalId: string | null;
  issue: string;
  unit: string;
  addedBy: string;
  orderDate: string | null; // yyyy-MM-dd
  serviceCharges: string;
  assignee: string;
  status: string;
}

export interface NormalizedVisit {
  externalId: string | null;
  visitorName: string;
  unit: string;
  residentName: string;
  arrivalAt: Date;
  departureAt: Date | null;
  visitType: string | null;
  status: string;
}

export interface NormalizedBooking {
  externalId: string | null;
  amenity: string;
  unit: string;
  bookedBy: string;
  bookingAt: Date;
  status: string;
}

export interface NormalizedVehicleSticker {
  externalId: string | null;
  unit: string;
  ownerName: string;
  vehicle: string;
  stickerType: string;
  issuedDate: string | null;
}

export interface NormalizedAnnouncement {
  externalId: string | null;
  title: string;
  body: string;
  audience: string;
  sentAt: Date;
}

export type NormalizedRecord =
  | { domain: "WORK_ORDERS"; record: NormalizedWorkOrder }
  | { domain: "VISITS" | "VISITORS"; record: NormalizedVisit }
  | { domain: "CINEMA_BOOKINGS" | "AMENITY_BOOKINGS"; record: NormalizedBooking }
  | { domain: "VEHICLE_STICKERS"; record: NormalizedVehicleSticker }
  | { domain: "ANNOUNCEMENTS"; record: NormalizedAnnouncement };

export interface FetchOptions {
  propertyExternalId: string | null;
  since?: Date;
}

/** Contract every PropOne source (API or file) must satisfy. */
export interface PropOneAdapter {
  readonly mode: "API" | "FILE_IMPORT";
  /** Human-readable readiness state for the admin integrations page. */
  describe(): { ready: boolean; detail: string };
  fetchRecords?(domain: PropOneDomain, opts: FetchOptions): Promise<NormalizedRecord[]>;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportReport {
  syncRunId: string;
  processed: number;
  imported: number;
  rejected: number;
  errors: ImportRowError[];
}
