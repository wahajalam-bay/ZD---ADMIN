/**
 * LEGACY MERGE — "Week of 20 Aug 2026" from `Zameen_Admin_Properties_Command_Center (1).html`.
 *
 * A reconciliation of the legacy deck against the live database found that the
 * legacy reporting week existed nowhere in the tool: its 24 weekly tasks, 12
 * checklist bottlenecks and 3 management summaries had only been approximated
 * by shortened "DEMO —" placeholders, and the 146 imported reference
 * photographs had been parked on whatever week happened to be current at
 * import time. This module merges the legacy content back in **verbatim**.
 *
 * Rules followed:
 * - Task text, ETA/completion dates, statuses, issue text and severities are
 *   copied CHARACTER-FOR-CHARACTER from the deck. Nothing is paraphrased.
 * - The deck names four checklists that the Data Entry Engine schema does not
 *   contain. They are added as clearly-marked deck-sourced categories rather
 *   than being force-fitted into an unrelated engine category (see
 *   docs/reference-audit.md → "Legacy merge").
 * - Where the deck flags a sheet-level omission (a blank sign-off, a blank date
 *   field, an entirely blank day column) and no checklist point can carry it, a
 *   single explicit "Sheet Completeness & Sign-off" point is added to that
 *   category. The engine's original points are untouched.
 * - The deck's own compliance percentages are NOT copied. They counted slide
 *   pages; this system counts checklist points (docs/decisions.md §1), so the
 *   figures are recomputed from the merged records.
 */
import type { Severity } from "@/lib/compliance";

/** The deck's "Week of 20 Aug 2026" — Monday-start reporting week. */
export const LEGACY_WEEK_START = "2026-08-17";
export const LEGACY_WEEK_END = "2026-08-23";

/** Point added where a deck issue is about the sheet, not a single check. */
export const SHEET_POINT = "Sheet Completeness & Sign-off";

export interface LegacyTask {
  task: string;
  status: "COMPLETED" | "IN_PROCESS";
  /** ISO date; the deck printed dd-MM-yyyy. */
  etaDate: string;
}

/** Verbatim from the deck's "Updates — Task Status" tables. */
export const LEGACY_TASKS: Record<string, LegacyTask[]> = {
  opal: [
    { task: "B1 interior paint work has been completed", status: "COMPLETED", etaDate: "2026-08-12" },
    { task: "Faults in the network switches and NVR have been rectified", status: "COMPLETED", etaDate: "2026-08-13" },
    {
      task: "The cracked cargo elevator supporting pulley has been removed and sent for replacement",
      status: "COMPLETED",
      etaDate: "2026-08-15",
    },
    { task: "FFP Room has been distempered", status: "COMPLETED", etaDate: "2026-08-17" },
    {
      task: "Apartment G-17 AC gas refilling, door polishing, paintwork, plumbing, and electrical works completed prior to handover",
      status: "COMPLETED",
      etaDate: "2026-08-15",
    },
    { task: "Damaged and leaking fire hose reel sub-pipes have been rectified", status: "COMPLETED", etaDate: "2026-08-12" },
    { task: "The faulty camera in Lift A has been rectified", status: "COMPLETED", etaDate: "2026-08-13" },
    { task: "Faulty leveling switches in Elevator B have been replaced", status: "COMPLETED", etaDate: "2026-08-13" },
    { task: "Passenger elevator branding work has been completed", status: "COMPLETED", etaDate: "2026-08-11" },
    { task: "Planter area tiles installation", status: "IN_PROCESS", etaDate: "2026-08-20" },
    { task: "Diesel level gauge marking", status: "IN_PROCESS", etaDate: "2026-08-25" },
    { task: "ACB breaker replacement", status: "IN_PROCESS", etaDate: "2026-08-20" },
  ],
  aurum: [
    { task: "Apartment 405 Genset magnetic contactor inspection work", status: "COMPLETED", etaDate: "2026-08-15" },
    { task: "Ground floor corridor ceiling work", status: "COMPLETED", etaDate: "2026-08-15" },
    { task: "Rooftop marble rectification", status: "COMPLETED", etaDate: "2026-08-15" },
    { task: "New plants for site", status: "IN_PROCESS", etaDate: "2026-08-15" },
    { task: "Building cracks and leakages", status: "IN_PROCESS", etaDate: "2026-08-18" },
  ],
  quadrangle: [
    { task: "Damaged Fire Fighting Cage welded in B-2", status: "COMPLETED", etaDate: "2026-08-11" },
    { task: "Generator Monitoring System installed for generator reading", status: "COMPLETED", etaDate: "2026-08-13" },
    { task: "2 AC gas refill in apartment 1103", status: "COMPLETED", etaDate: "2026-08-14" },
    { task: "Fire Fighting Motor commissioning", status: "IN_PROCESS", etaDate: "2026-08-20" },
    { task: "Genset EMS (Energy Monitoring System) — template pending", status: "IN_PROCESS", etaDate: "2026-08-25" },
    { task: "Terrace chairs & cushion covers", status: "IN_PROCESS", etaDate: "2026-08-20" },
    { task: "Swimming pool area window blinds", status: "IN_PROCESS", etaDate: "2026-08-20" },
  ],
};

/**
 * Verbatim from the deck's PropOne status paragraphs. These are the site's own
 * management summaries for the week and are stored as written — the live
 * PropOne tables are fed by the Redshift sync and are NOT overwritten by them.
 */
export const LEGACY_SUMMARIES: Record<string, string> = {
  opal:
    "Visitor extended-stay & short-visit log for Zameen Opal residents. Status tracked Completed/Pending per visit.",
  aurum:
    "23 work orders logged (15 completed, 6 rejected, 2 pending procurement). Cinema booking log: 22 latest entries — 16 attended, 4 pre-booked, 2 cancelled.",
  quadrangle:
    "17 work orders (14 completed, 3 rejected). 22 visitor entries Aug 10–17. 8 announcements sent (latest Jul 31 — none new this week). 14 owner/LTR vehicle stickers issued. 11 snooker bookings, all attended.",
};

/**
 * Checklists the deck reports on that the Data Entry Engine schema omits.
 * Added as first-class categories so the legacy issues keep their real
 * attribution instead of being filed under an unrelated checklist.
 */
export const DECK_CATEGORIES = [
  {
    key: "genset_100_log",
    name: "100 KVA Genset Reading Log",
    type: "CHECK" as const,
    sortOrder: 231,
    items: [
      "Reading Date Current",
      "Opening Reading Recorded",
      "Closing Reading Recorded",
      "Total Hours Recorded",
      "Fuel Used (Ltr) Recorded",
      SHEET_POINT,
    ],
    topFields: ["Reading Done By", "Entered By", "Verified By"],
  },
  {
    key: "genset_maintenance",
    name: "Genset Maintenance Sign-off",
    type: "CHECK" as const,
    sortOrder: 232,
    items: ["Service Performed", "Next Visit Date", "Maintenance Notes", SHEET_POINT],
    topFields: ["Serviced By", "Verified By"],
  },
  {
    key: "genset_performance",
    name: "Genset Performance Metrics",
    type: "CHECK" as const,
    sortOrder: 233,
    items: ["Pass / Fail Result", "Service Required", "Load Test Result", SHEET_POINT],
    topFields: ["Measured By", "Verified By"],
  },
  {
    key: "reception",
    name: "Reception Checklist",
    type: "CHECK" as const,
    sortOrder: 234,
    items: [
      "Air Conditioning",
      "Lighting",
      "Sofa & Upholstery Cleaning",
      "Desk & Counter Clean",
      "Visitor Log Maintained",
      SHEET_POINT,
    ],
    topFields: ["Duty Receptionist Sign", "A.M Admin"],
  },
];

/** Engine categories that must gain the sheet-level point (and nothing else). */
export const SHEET_POINT_CATEGORIES = ["gym", "cafeteria", "swimming_pool", "fire_fighting"];

export interface LegacyBottleneck {
  /** Property code. */
  property: string;
  /** The checklist name exactly as the deck printed it. */
  deckChecklist: string;
  /** Category key this is recorded against in the tool. */
  categoryKey: string;
  /** Checklist point this is recorded against. */
  itemName: string;
  /** Verbatim issue text from the deck. */
  issue: string;
  severity: Severity;
  /** Day within the legacy week the entry is filed under. */
  entryDate: string;
}

/**
 * All 12 deck bottlenecks with their mapping onto real checklist points.
 * `deckChecklist` is retained so the mapping stays auditable.
 */
export const LEGACY_BOTTLENECKS: LegacyBottleneck[] = [
  // ── Opal ──────────────────────────────────────────────────────────────────
  {
    property: "opal",
    deckChecklist: "100 KVA Genset Reading Log",
    categoryKey: "genset_100_log",
    itemName: "Reading Date Current",
    issue:
      "Still showing July dates — no fresh August reading logged (same stale sheet 2 weeks running)",
    severity: "HIGH",
    entryDate: "2026-08-19",
  },
  {
    property: "opal",
    deckChecklist: "Mini Cinema Weekly Checklist",
    categoryKey: "cinema",
    itemName: "Projector & Speakers count",
    issue: "Equipment count (12 chairs, projector & speakers) never checked this week",
    severity: "MEDIUM",
    entryDate: "2026-08-19",
  },
  {
    property: "opal",
    deckChecklist: "Fitness Center Checklist",
    categoryKey: "gym",
    itemName: SHEET_POINT,
    issue: "FM Manager's sign blank the entire week (recurring)",
    severity: "MEDIUM",
    entryDate: "2026-08-19",
  },
  // ── Aurum ─────────────────────────────────────────────────────────────────
  {
    property: "aurum",
    deckChecklist: "Mini Cinema Weekly Checklist",
    categoryKey: "cinema",
    itemName: "Projector & Speakers count",
    issue: "Equipment count (chairs, projector) blank all week",
    severity: "MEDIUM",
    entryDate: "2026-08-19",
  },
  {
    property: "aurum",
    deckChecklist: "Washrooms Checklist",
    categoryKey: "cafeteria",
    itemName: SHEET_POINT,
    issue: "Date field left blank (recurring)",
    severity: "LOW",
    entryDate: "2026-08-19",
  },
  {
    property: "aurum",
    deckChecklist: "Genset Maintenance Sign-off",
    categoryKey: "genset_maintenance",
    itemName: "Next Visit Date",
    issue: "Next visit date and notes still blank (recurring)",
    severity: "MEDIUM",
    entryDate: "2026-08-19",
  },
  {
    property: "aurum",
    deckChecklist: "Genset Performance Metrics",
    categoryKey: "genset_performance",
    itemName: "Pass / Fail Result",
    issue:
      'Pass/Fail still unmarked; "Service Required" has both Yes and No ticked (data entry error)',
    severity: "HIGH",
    entryDate: "2026-08-19",
  },
  {
    property: "aurum",
    deckChecklist: "Weekly Pool Maintenance Log",
    categoryKey: "swimming_pool",
    itemName: SHEET_POINT,
    issue:
      "Condition rating blank again; next water-change date not updated for 3 weeks running",
    severity: "HIGH",
    entryDate: "2026-08-19",
  },
  {
    property: "aurum",
    deckChecklist: "IT Room Checklist",
    categoryKey: "cctv_room",
    itemName: "All Cameras Check",
    issue: '"2-3 cameras faulty" noted daily Mon-Sun — unresolved the entire week',
    severity: "HIGH",
    entryDate: "2026-08-19",
  },
  // ── Quadrangle ────────────────────────────────────────────────────────────
  {
    property: "quadrangle",
    deckChecklist: "Swimming Pool's Asset Checklist",
    categoryKey: "swimming_pool",
    itemName: SHEET_POINT,
    issue: "Friday column left entirely blank",
    severity: "MEDIUM",
    entryDate: "2026-08-21",
  },
  {
    property: "quadrangle",
    deckChecklist: "Fire Fighting Room Checklist",
    categoryKey: "fire_fighting",
    itemName: SHEET_POINT,
    issue: "Tuesday closing check and all of Sunday left blank",
    severity: "MEDIUM",
    entryDate: "2026-08-18",
  },
  {
    property: "quadrangle",
    deckChecklist: "Reception Checklist",
    categoryKey: "reception",
    itemName: "Air Conditioning",
    issue: "Staff self-flagged: AC lights not working, sofa cleaning pending",
    severity: "MEDIUM",
    entryDate: "2026-08-19",
  },
];

/**
 * Tracking status derived from the deck's own task-completion percentage
 * (Opal 75%, Aurum 60%, Quadrangle 43%): >=70% on track, 50–69% watch,
 * below 50% at risk. The deck did not print a tracking status.
 */
export function trackingFromCompletion(completed: number, inProcess: number) {
  const total = completed + inProcess;
  if (total === 0) return "WATCH" as const;
  const pct = (completed / total) * 100;
  if (pct >= 70) return "ON_TRACK" as const;
  if (pct >= 50) return "WATCH" as const;
  return "AT_RISK" as const;
}

