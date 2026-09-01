import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { hashPassword } from "better-auth/crypto";
import { db } from "@/server/db";
import {
  account,
  auditLogs,
  checklistCategories,
  checklistEntries,
  checklistItems,
  checklistResponsePhotos,
  checklistResponses,
  properties,
  propOneBookings,
  propOneSyncRuns,
  propOneVisits,
  propOneWidgetConfigs,
  propOneWorkOrders,
  propOneVehicleStickers,
  propOneAnnouncements,
  user,
  weeklyMedia,
  weeklyReports,
  weeklyTasks,
} from "@/db/schema";
import { getStorage } from "@/server/storage";
import { buildObjectKey } from "@/server/storage/images";
import { addDays, currentWeekStart, todayStr } from "@/lib/week";

/**
 * DEVELOPMENT/DEMO SEED — never run in production.
 *
 * Everything created here is synthetic and labeled "DEMO". Reference sample
 * figures from the old Opal/Aurum/Quadrangle dashboard are deliberately NOT
 * copied onto the production portfolio.
 */

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "ZameenDev!2026";

async function upsertUser(opts: {
  name: string;
  email: string;
  role: string;
  propertyId?: string | null;
}) {
  const existing = await db.select().from(user).where(eq(user.email, opts.email));
  if (existing[0]) return existing[0];
  const id = crypto.randomUUID();
  const [created] = await db
    .insert(user)
    .values({
      id,
      name: opts.name,
      email: opts.email,
      emailVerified: true,
      role: opts.role,
      propertyId: opts.propertyId ?? null,
    })
    .returning();
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    issuer: "local:credential",
    userId: id,
    password: await hashPassword(DEMO_PASSWORD),
  });
  await db.insert(auditLogs).values({
    actorUserId: null,
    action: "user.created",
    entityType: "user",
    entityId: id,
    propertyId: opts.propertyId ?? null,
    afterData: { email: opts.email, role: opts.role },
    metadata: { source: "demo-seed" },
  });
  console.log(`  + user ${opts.email} (${opts.role})`);
  return created!;
}

async function makeDemoImage(label: string, color: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560">
    <rect width="800" height="560" fill="${color}"/>
    <rect x="24" y="24" width="752" height="512" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>
    <text x="400" y="260" font-family="Arial" font-size="34" fill="#ffffff" text-anchor="middle" font-weight="bold">${label}</text>
    <text x="400" y="310" font-family="Arial" font-size="20" fill="rgba(255,255,255,.85)" text-anchor="middle">DEMO EVIDENCE — development seed</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

async function storeDemoImage(propertyId: string, domain: "checklist" | "weekly", label: string, color: string) {
  const storage = getStorage();
  const buf = await makeDemoImage(label, color);
  const thumb = await sharp(buf).resize({ width: 480 }).jpeg({ quality: 74 }).toBuffer();
  const { key, thumbKey } = buildObjectKey(propertyId, domain);
  await storage.put(key, buf, "image/jpeg");
  await storage.put(thumbKey, thumb, "image/jpeg");
  const meta = await sharp(buf).metadata();
  return { key, thumbKey, sizeBytes: buf.byteLength, width: meta.width ?? 800, height: meta.height ?? 560 };
}

export async function runDemoSeed() {
  console.log("Seeding DEMO development data…");

  const allProps = await db.select().from(properties).orderBy(properties.displayOrder);
  const byCode = new Map(allProps.map((p) => [p.code, p]));
  const maybeOpal = byCode.get("opal");
  const maybeAurum = byCode.get("aurum");
  const maybeQuad = byCode.get("quadrangle");
  if (!maybeOpal || !maybeAurum || !maybeQuad) throw new Error("Baseline seed must run first");
  const opal = maybeOpal;
  const aurum = maybeAurum;
  const quadrangle = maybeQuad;

  // ── Accounts ────────────────────────────────────────────────────────────
  const manager = await upsertUser({
    name: "Demo Manager Admin",
    email: "manager.admin@zameen.local",
    role: "MANAGER_ADMIN",
  });
  const assistant = await upsertUser({
    name: "Demo Assistant Manager",
    email: "assistant.manager@zameen.local",
    role: "ASSISTANT_MANAGER",
  });
  const opalUser = await upsertUser({
    name: "Demo Opal Site User",
    email: "opal.site@zameen.local",
    role: "SITE_USER",
    propertyId: opal.id,
  });
  const aurumUser = await upsertUser({
    name: "Demo Aurum Site User",
    email: "aurum.site@zameen.local",
    role: "SITE_USER",
    propertyId: aurum.id,
  });
  await upsertUser({
    name: "Demo Quadrangle Site User",
    email: "quadrangle.site@zameen.local",
    role: "SITE_USER",
    propertyId: quadrangle.id,
  });

  // Idempotency guard: if Opal already has a weekly report, assume demo data exists.
  const existingReports = await db
    .select()
    .from(weeklyReports)
    .where(eq(weeklyReports.propertyId, opal.id))
    .limit(1);
  if (existingReports.length > 0) {
    console.log("  demo data already present — skipping data seed");
    return;
  }

  const thisWeek = currentWeekStart();
  const lastWeek = addDays(thisWeek, -7);
  const now = new Date();
  const today = todayStr();

  const publishedStamps = {
    submittedBy: opalUser.id,
    submittedAt: now,
    reviewedBy: assistant.id,
    reviewedAt: now,
    approvedBy: assistant.id,
    approvedAt: now,
    publishedBy: assistant.id,
    publishedAt: now,
  };

  // ── Weekly reports + tasks + media ──────────────────────────────────────
  const weeklySpec: Array<{
    property: typeof opal;
    siteUser: typeof opalUser;
    week: string;
    status: "PUBLISHED" | "APPROVED" | "SUBMITTED";
    tracking: "ON_TRACK" | "WATCH" | "AT_RISK";
    summary: string;
    tasks: Array<{ task: string; status: "COMPLETED" | "IN_PROCESS"; eta: string | null }>;
    photos: Array<{ label: string; color: string; caption: string }>;
  }> = [
    {
      property: opal,
      siteUser: opalUser,
      week: lastWeek,
      status: "PUBLISHED",
      tracking: "ON_TRACK",
      summary: "DEMO: 3 tasks completed last week, 1 in process. Checklists largely clean.",
      tasks: [
        { task: "DEMO — B1 interior paint work completed", status: "COMPLETED", eta: addDays(lastWeek, 2) },
        { task: "DEMO — Faulty NVR camera rectified", status: "COMPLETED", eta: addDays(lastWeek, 3) },
        { task: "DEMO — Fire hose reel sub-pipes rectified", status: "COMPLETED", eta: addDays(lastWeek, 4) },
        { task: "DEMO — Planter area tiles installation", status: "IN_PROCESS", eta: addDays(thisWeek, 3) },
      ],
      photos: [
        { label: "Opal lobby cleaning", color: "#0f766e", caption: "DEMO: Main lobby area cleaning" },
        { label: "Opal rooftop", color: "#155e75", caption: "DEMO: Rooftop cleaning" },
      ],
    },
    {
      property: opal,
      siteUser: opalUser,
      week: thisWeek,
      status: "PUBLISHED",
      tracking: "ON_TRACK",
      summary: "DEMO: 2 tasks completed this week, 2 in process. One generator issue flagged.",
      tasks: [
        { task: "DEMO — Passenger elevator branding completed", status: "COMPLETED", eta: addDays(thisWeek, 1) },
        { task: "DEMO — FFP room distempered", status: "COMPLETED", eta: addDays(thisWeek, 2) },
        { task: "DEMO — Diesel level gauge marking", status: "IN_PROCESS", eta: addDays(thisWeek, 8) },
        { task: "DEMO — ACB breaker replacement", status: "IN_PROCESS", eta: addDays(thisWeek, 9) },
      ],
      photos: [
        { label: "Opal boundary wall", color: "#0d9488", caption: "DEMO: Boundary area cleaning" },
        { label: "Opal gym", color: "#4338ca", caption: "DEMO: Fitness center maintenance" },
        { label: "Opal pool", color: "#0369a1", caption: "DEMO: Swimming pool skimming" },
      ],
    },
    {
      property: aurum,
      siteUser: aurumUser,
      week: thisWeek,
      status: "PUBLISHED",
      tracking: "WATCH",
      summary: "DEMO: Building cracks under observation; 1 task completed, 2 in process.",
      tasks: [
        { task: "DEMO — Genset magnetic contactor inspection", status: "COMPLETED", eta: addDays(thisWeek, 1) },
        { task: "DEMO — Rooftop marble rectification", status: "IN_PROCESS", eta: addDays(thisWeek, 6) },
        { task: "DEMO — Building cracks and leakages survey", status: "IN_PROCESS", eta: addDays(thisWeek, 10) },
      ],
      photos: [
        { label: "Aurum corridor ceiling", color: "#b45309", caption: "DEMO: Corridor ceiling rectification" },
        { label: "Aurum genset room", color: "#334155", caption: "DEMO: Genset room inspection" },
      ],
    },
    {
      property: quadrangle,
      siteUser: opalUser, // created by mgmt on behalf of site (demo)
      week: thisWeek,
      status: "SUBMITTED",
      tracking: "ON_TRACK",
      summary: "DEMO: Awaiting review — 1 completed, 1 in process.",
      tasks: [
        { task: "DEMO — Fire fighting cage welded in B-2", status: "COMPLETED", eta: addDays(thisWeek, 1) },
        { task: "DEMO — Terrace chairs & cushion covers", status: "IN_PROCESS", eta: addDays(thisWeek, 7) },
      ],
      photos: [],
    },
  ];

  for (const spec of weeklySpec) {
    const stamps =
      spec.status === "PUBLISHED"
        ? { ...publishedStamps, submittedBy: spec.siteUser.id }
        : spec.status === "APPROVED"
          ? {
              submittedBy: spec.siteUser.id,
              submittedAt: now,
              reviewedBy: assistant.id,
              reviewedAt: now,
              approvedBy: assistant.id,
              approvedAt: now,
            }
          : { submittedBy: spec.siteUser.id, submittedAt: now };

    const [report] = await db
      .insert(weeklyReports)
      .values({
        propertyId: spec.property.id,
        weekStart: spec.week,
        trackingStatus: spec.tracking,
        summary: spec.summary,
        notes: "DEMO data — not real submissions.",
        workflowStatus: spec.status,
        createdBy: spec.siteUser.id,
        ...stamps,
      })
      .returning();

    await db.insert(weeklyTasks).values(
      spec.tasks.map((t, i) => ({
        weeklyReportId: report!.id,
        propertyId: spec.property.id,
        task: t.task,
        status: t.status,
        etaDate: t.eta,
        sortOrder: (i + 1) * 10,
      })),
    );

    for (const photo of spec.photos) {
      const stored = await storeDemoImage(spec.property.id, "weekly", photo.label, photo.color);
      await db.insert(weeklyMedia).values({
        weeklyReportId: report!.id,
        propertyId: spec.property.id,
        mediaType: "IMAGE",
        storageKey: stored.key,
        thumbnailKey: stored.thumbKey,
        originalFilename: `${photo.label.replaceAll(" ", "_")}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: stored.sizeBytes,
        width: stored.width,
        height: stored.height,
        caption: photo.caption,
        uploadedBy: spec.siteUser.id,
      });
    }
  }

  // ── Checklist entries (published, with one flagged NEO bottleneck) ──────
  const categories = await db.select().from(checklistCategories);
  const catByKey = new Map(categories.map((c) => [c.key, c]));

  async function seedEntry(opts: {
    property: typeof opal;
    creator: typeof opalUser;
    categoryKey: string;
    entryDate: string;
    status: "PUBLISHED" | "SUBMITTED" | "RETURNED" | "DRAFT";
    defect?: { itemIndex: number; comment: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; photoLabel: string };
    logValues?: Record<string, string>;
  }) {
    const category = catByKey.get(opts.categoryKey);
    if (!category) throw new Error(`Unknown category ${opts.categoryKey}`);
    const stamps =
      opts.status === "PUBLISHED"
        ? { ...publishedStamps, submittedBy: opts.creator.id }
        : opts.status === "SUBMITTED"
          ? { submittedBy: opts.creator.id, submittedAt: now }
          : opts.status === "RETURNED"
            ? {
                submittedBy: opts.creator.id,
                submittedAt: now,
                returnedBy: assistant.id,
                returnedAt: now,
                returnReason: "DEMO: please attach evidence for flagged rows and resubmit.",
              }
            : {};
    const [entry] = await db
      .insert(checklistEntries)
      .values({
        propertyId: opts.property.id,
        categoryId: category.id,
        entryDate: opts.entryDate,
        workflowStatus: opts.status,
        signDutyTechnician: opts.status === "PUBLISHED" ? "Demo Technician" : "",
        signAmAdmin: opts.status === "PUBLISHED" ? "Demo Assistant Manager" : "",
        signManagerAdmin: opts.status === "PUBLISHED" ? "Demo Manager Admin" : "",
        createdBy: opts.creator.id,
        ...stamps,
      })
      .returning();

    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.categoryId, category.id))
      .orderBy(checklistItems.sortOrder);

    for (const [i, item] of items.entries()) {
      const defect = opts.defect && opts.defect.itemIndex === i ? opts.defect : null;
      const [response] = await db
        .insert(checklistResponses)
        .values({
          entryId: entry!.id,
          checklistItemId: item.id,
          op: !defect,
          cl: !defect,
          comment: defect?.comment ?? "",
          severity: defect?.severity ?? null,
        })
        .returning();
      if (defect) {
        const stored = await storeDemoImage(
          opts.property.id,
          "checklist",
          defect.photoLabel,
          "#b91c1c",
        );
        await db.insert(checklistResponsePhotos).values({
          checklistResponseId: response!.id,
          propertyId: opts.property.id,
          storageKey: stored.key,
          thumbnailKey: stored.thumbKey,
          originalFilename: "demo-evidence.jpg",
          mimeType: "image/jpeg",
          sizeBytes: stored.sizeBytes,
          width: stored.width,
          height: stored.height,
          caption: `DEMO evidence: ${defect.comment}`,
          uploadedBy: opts.creator.id,
        });
      }
    }
    return entry!;
  }

  // Opal: published clean + flagged entries inside the current week
  await seedEntry({ property: opal, creator: opalUser, categoryKey: "housekeeping", entryDate: addDays(thisWeek, 0), status: "PUBLISHED" });
  await seedEntry({ property: opal, creator: opalUser, categoryKey: "swimming_pool", entryDate: addDays(thisWeek, 1), status: "PUBLISHED" });
  await seedEntry({
    property: opal,
    creator: opalUser,
    categoryKey: "genset_operational",
    entryDate: addDays(thisWeek, 1),
    status: "PUBLISHED",
    defect: {
      itemIndex: 11, // "Emergency Stop Functional"
      comment: "DEMO: Emergency stop button unresponsive on first press",
      severity: "HIGH",
      photoLabel: "Opal genset emergency stop",
    },
  });
  await seedEntry({
    property: opal,
    creator: opalUser,
    categoryKey: "cctv_room",
    entryDate: addDays(thisWeek, 2),
    status: "PUBLISHED",
    defect: {
      itemIndex: 0, // "All Cameras Check"
      comment: "DEMO: 2 basement cameras offline since Monday",
      severity: "MEDIUM",
      photoLabel: "Opal CCTV wall",
    },
  });
  // Opal: today's submissions pending review
  await seedEntry({ property: opal, creator: opalUser, categoryKey: "rooftop", entryDate: today, status: "SUBMITTED" });
  await seedEntry({ property: opal, creator: opalUser, categoryKey: "garbage_chute", entryDate: today, status: "RETURNED" });

  // Aurum: published entries, one flagged
  await seedEntry({ property: aurum, creator: aurumUser, categoryKey: "housekeeping", entryDate: addDays(thisWeek, 0), status: "PUBLISHED" });
  await seedEntry({
    property: aurum,
    creator: aurumUser,
    categoryKey: "firefighting_pumps",
    entryDate: addDays(thisWeek, 2),
    status: "PUBLISHED",
    defect: {
      itemIndex: 8, // "Battery (Diesel Pump)"
      comment: "DEMO: Diesel pump battery voltage low — replacement requested",
      severity: "CRITICAL",
      photoLabel: "Aurum diesel pump battery",
    },
  });
  await seedEntry({ property: aurum, creator: aurumUser, categoryKey: "lift", entryDate: today, status: "SUBMITTED" });

  // LOG-category demo entry (genset readings) for Opal
  {
    const category = catByKey.get("genset_500")!;
    const [entry] = await db
      .insert(checklistEntries)
      .values({
        propertyId: opal.id,
        categoryId: category.id,
        entryDate: addDays(thisWeek, 1),
        workflowStatus: "PUBLISHED",
        signDutyTechnician: "Demo Technician",
        signAmAdmin: "Demo Assistant Manager",
        signManagerAdmin: "Demo Manager Admin",
        createdBy: opalUser.id,
        ...publishedStamps,
      })
      .returning();
    const { checklistFieldDefinitions } = await import("@/db/schema");
    const defs = await db
      .select()
      .from(checklistFieldDefinitions)
      .where(eq(checklistFieldDefinitions.categoryId, category.id));
    const demoValues: Record<string, string> = {
      opening_reading: "10234.5",
      closing_reading: "10241.2",
      total_hours: "6.7",
      fuel_used_ltr: "88",
      reading_done_by: "Demo Technician",
      entered_by: "Demo Opal Site User",
      verified_by: "Demo Assistant Manager",
    };
    const { checklistFieldValues } = await import("@/db/schema");
    for (const def of defs) {
      await db.insert(checklistFieldValues).values({
        entryId: entry!.id,
        fieldDefinitionId: def.id,
        value: demoValues[def.key] ?? "",
      });
    }
  }

  // ── PropOne demo configuration + records ────────────────────────────────
  const [syncRun] = await db
    .insert(propOneSyncRuns)
    .values({
      mode: "FILE_IMPORT",
      status: "SUCCESS",
      filename: "demo-seed.csv",
      recordsProcessed: 30,
      recordsImported: 30,
      recordsRejected: 0,
      initiatedBy: manager.id,
      finishedAt: now,
    })
    .returning();
  const runId = syncRun!.id;

  // Widget layout mirrors the reference Command Center per property:
  // Opal → Visits; Aurum → Work Orders + Visits + Cinema Bookings;
  // Quadrangle → Work Orders + Visitors + Vehicle Stickers + Snooker + Announcements.
  const widgetSpec: Array<{ propertyId: string; domain: "WORK_ORDERS" | "VISITS" | "VISITORS" | "CINEMA_BOOKINGS" | "AMENITY_BOOKINGS" | "VEHICLE_STICKERS" | "ANNOUNCEMENTS"; order: number }> = [
    { propertyId: opal.id, domain: "VISITS", order: 10 },
    { propertyId: aurum.id, domain: "WORK_ORDERS", order: 10 },
    { propertyId: aurum.id, domain: "VISITS", order: 20 },
    { propertyId: aurum.id, domain: "CINEMA_BOOKINGS", order: 30 },
    { propertyId: quadrangle.id, domain: "WORK_ORDERS", order: 10 },
    { propertyId: quadrangle.id, domain: "VISITORS", order: 20 },
    { propertyId: quadrangle.id, domain: "VEHICLE_STICKERS", order: 30 },
    { propertyId: quadrangle.id, domain: "AMENITY_BOOKINGS", order: 40 },
    { propertyId: quadrangle.id, domain: "ANNOUNCEMENTS", order: 50 },
  ];
  for (const w of widgetSpec) {
    await db
      .insert(propOneWidgetConfigs)
      .values({ propertyId: w.propertyId, metricDomain: w.domain, sortOrder: w.order })
      .onConflictDoNothing();
  }

  const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

  // Visits (Opal + Aurum), plus visitor entries for Quadrangle
  const visitRows: Array<typeof propOneVisits.$inferInsert> = [];
  for (let i = 0; i < 21; i++) {
    const propertyId = [opal.id, aurum.id, quadrangle.id][i % 3]!;
    const arrival = new Date(now.getTime() - i * 12 * 3600_000);
    visitRows.push({
      propertyId,
      externalId: `DEMO-V-${i + 1}`,
      visitorName: `Demo Visitor ${String(i + 1).padStart(2, "0")}`,
      unit: `${100 + i}${i % 3 === 0 ? " (STR)" : ""}`,
      residentName: `Demo Resident ${String(i + 1).padStart(2, "0")}`,
      arrivalAt: arrival,
      departureAt: i % 4 === 0 ? null : new Date(arrival.getTime() + 5 * 3600_000),
      visitType: i % 3 === 0 ? "EXTENDED_STAY" : "SHORT_VISIT",
      status: i % 4 === 0 ? "Pending" : "Completed",
      syncRunId: runId,
      rawHash: hash(`visit-${i}`),
    });
  }
  await db.insert(propOneVisits).values(visitRows).onConflictDoNothing();

  // Work orders (Aurum + Quadrangle, matching the reference layout)
  const woStatus = ["Completed", "Completed", "Completed", "Rejected", "Pending Procurement"];
  const woRows: Array<typeof propOneWorkOrders.$inferInsert> = [];
  for (let i = 0; i < 16; i++) {
    const propertyId = [aurum.id, quadrangle.id][i % 2]!;
    woRows.push({
      propertyId,
      externalId: `DEMO-WO-${i + 1}`,
      issue: `DEMO ${["Plumbing Visit (Basic)", "Electrical Visit (Basic)", "Area Not Cleaned", "Major Plumbing Work", "AC Gas Refill"][i % 5]}`,
      unit: `${200 + i}`,
      addedBy: `Demo Resident ${String(i + 1).padStart(2, "0")}`,
      orderDate: addDays(today, -i),
      serviceCharges: i % 2 === 0 ? "PKR 1,000" : "PKR 0",
      assignee: i % 3 === 0 ? "Demo Maintenance Team" : "",
      status: woStatus[i % woStatus.length]!,
      syncRunId: runId,
      rawHash: hash(`wo-${i}`),
    });
  }
  await db.insert(propOneWorkOrders).values(woRows).onConflictDoNothing();

  // Cinema bookings (Aurum) + amenity bookings (Quadrangle snooker)
  const bookingRows: Array<typeof propOneBookings.$inferInsert> = [];
  for (let i = 0; i < 8; i++) {
    bookingRows.push({
      propertyId: aurum.id,
      externalId: `DEMO-CB-${i + 1}`,
      amenity: "CINEMA",
      unit: `${300 + i}`,
      bookedBy: `Demo Resident ${String(i + 1).padStart(2, "0")}`,
      bookingAt: new Date(now.getTime() - i * 24 * 3600_000),
      status: i % 4 === 3 ? "Cancelled" : i % 4 === 2 ? "Pre-booked" : "Attended",
      syncRunId: runId,
      rawHash: hash(`cb-${i}`),
    });
  }
  for (let i = 0; i < 6; i++) {
    bookingRows.push({
      propertyId: quadrangle.id,
      externalId: `DEMO-SB-${i + 1}`,
      amenity: "SNOOKER",
      unit: `${400 + i}`,
      bookedBy: `Demo Resident ${String(i + 20).padStart(2, "0")}`,
      bookingAt: new Date(now.getTime() - i * 18 * 3600_000),
      status: "Attended",
      syncRunId: runId,
      rawHash: hash(`sb-${i}`),
    });
  }
  await db.insert(propOneBookings).values(bookingRows).onConflictDoNothing();

  // Vehicle stickers + announcements (Quadrangle)
  await db
    .insert(propOneVehicleStickers)
    .values(
      Array.from({ length: 5 }, (_, i) => ({
        propertyId: quadrangle.id,
        externalId: `DEMO-VS-${i + 1}`,
        unit: `${500 + i}`,
        ownerName: `Demo Owner ${i + 1}`,
        vehicle: `Demo Vehicle ${i + 1}`,
        stickerType: i % 2 === 0 ? "OWNER" : "LTR",
        issuedDate: addDays(today, -i * 2),
        syncRunId: runId,
        rawHash: hash(`vs-${i}`),
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(propOneAnnouncements)
    .values(
      Array.from({ length: 3 }, (_, i) => ({
        propertyId: quadrangle.id,
        externalId: `DEMO-AN-${i + 1}`,
        title: `DEMO Announcement ${i + 1}: scheduled maintenance notice`,
        body: "DEMO announcement body — development data only.",
        audience: "All residents",
        sentAt: new Date(now.getTime() - i * 5 * 24 * 3600_000),
        syncRunId: runId,
        rawHash: hash(`an-${i}`),
      })),
    )
    .onConflictDoNothing();

  console.log("Demo seed done.");
  console.log(`  Demo password for all demo accounts: (see SEED_DEMO_PASSWORD in .env)`);
}
