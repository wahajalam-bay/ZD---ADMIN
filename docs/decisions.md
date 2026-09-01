# Engineering Decisions & Open Business Questions

Ambiguities are resolved explicitly here — never hidden inside implementation.

## 1. Checklist compliance formula (preserved, with one mapping decision)

The reference Command Center **does** define a formula (`renderSiteCharts`):

```js
pct = Math.round((checklist_clean / checklist_total) * 100) // legend: Clean / Flagged / Total pages
```

It is preserved verbatim in `src/lib/compliance.ts` (unit-tested). One mapping was
required: the reference counted static *deck pages*; the live system counts
**published checklist entries** (one property + category + day) as the compliance unit.

An entry is **flagged** when any item response has a defect comment/severity **or** is
not marked complete for both OP and CL — the reference bottlenecks explicitly treat
blank/unchecked sheets as issues ("Friday column left entirely blank", "Date field
left blank"). LOG categories have no item rows and cannot flag.

*The formula lives in one isolated, unit-tested module so the business rule can be
changed centrally if management prefers a different definition.*

## 2. Bottleneck severity (product improvement, recorded)

The Data Entry Engine **never captured severity**; the reference Command Center
displays severities (Low/Medium/High) that existed only in static sample rows — no
derivation logic exists in either reference. Decision:

- An explicit severity selector (**Low / Medium / High / Critical**) appears on a
  checklist row **only when a defect comment is entered** — severity is never forced
  on healthy rows.
- A defect without a chosen severity defaults to **Low**.
- Bottleneck rows = responses with a described defect (comment/severity), ordered
  most-severe → most recent. Rows that are merely incomplete (unchecked OP/CL, no
  comment) reduce compliance but are not listed as bottlenecks, matching the
  reference's curated issue list.

## 3. Production portfolio

Per current direction, only the **built and functional** properties are seeded:
**Opal, Aurum, Quadrangle**, using master data clearly identified in the reference
(location, type, area, development status). Weekly sample operational figures from the
reference were **not** treated as production data. Properties under construction are
added later at `/admin/properties` — the entire system (navigation, permissions,
KPIs, PropOne widgets) is property-record-driven, nothing is hard-coded to the three.

## 4. Sidebar status dot / phase code semantics — UNRESOLVED

The requested compact sidebar style shows a status dot and optional right-side
metadata (e.g. "P0"). No reference document defines what the colors or phase codes
mean. They are implemented as **configurable display metadata**
(`properties.statusIndicator` ∈ green/orange/blue/grey, `properties.phaseCode` free
text) editable at `/admin/properties`. **Business meaning must be supplied by
management before these are used for reporting logic.**

## 5. PropOne connectivity — EXTERNAL DEPENDENCY

No PropOne API endpoint, credentials or export schema was provided. Decisions:

- Integration boundary at `src/server/integrations/propone/` with two adapters:
  `PropOneApiAdapter` (placeholder that reports "not configured" — it deliberately
  invents **no** endpoints) and `PropOneFileImportAdapter` (working, validated CSV
  import).
- Normalized storage per domain (work orders, visits/visitors, bookings, vehicle
  stickers, announcements) with provenance (sync run, raw-row hash, external id,
  imported-at). Re-imports are idempotent (dedupe on property + row hash).
- **CSV** is the supported import format (templates shown on `/admin/integrations`).
  XLSX exports should be saved as CSV; native XLSX parsing can be added behind the
  same adapter without touching dashboards.
- Dashboard PropOne **widgets are configuration** (`propone_widget_configs`) because
  the real property↔PropOne dataset mapping for future properties is unknown. The
  demo seed mirrors the reference layout (Opal→Visits; Aurum→Work Orders/Visits/
  Cinema; Quadrangle→Work Orders/Visitors/Stickers/Snooker/Announcements).

**Needed from PropOne/management:** API base URL + auth + response schemas (or a
committed weekly export format) to implement `api-adapter` mapping.

## 6. Publication model

Publication is **state, not copies**: `PUBLISHED` is a workflow status on source
records; every Command Center number is computed from published rows at read time —
reproducible, never manually keyed. Publication works per submission (review detail)
**and** as a weekly property batch ("Publish week": all APPROVED checklist entries in
the week + the approved weekly report, in one transaction with one audit event). No
snapshot/KPI table exists because nothing needed one; if snapshotting is ever
required, it should store references, not duplicated numbers.

## 7. Media storage

S3-compatible object storage (AWS S3 / Cloudflare R2 / MinIO) with **private**
objects; the database stores keys + metadata only. Uploads are server-proxied through
server actions (validated + re-encoded via sharp, EXIF stripped, randomized keys,
thumbnails generated) rather than browser-presigned — simpler, and it guarantees
authorization + normalization happen before any byte is stored. Reads go through
`/api/media/*`, which authorizes per property on every request. A local-disk driver
exists for development machines without Docker (never for production).

## 8. Password reset

No SMTP service was specified, so v1 uses **admin-driven reset** (Manager/Admin sets a
new password at `/admin/users`; all sessions of that user are revoked), matching the
deployment request ("reset passwords" as an admin capability). Self-service email
reset can be enabled later by configuring Better Auth's `sendResetPassword` with a
mail provider.

## 9. Site videos & live camera

Modeled but honest: `weekly_media.mediaType` supports `VIDEO` (no fake data seeded);
Live Camera renders a configuration-pending empty state. No feeds are fabricated.

## 10. Review-time editing

AM/Manager "edit submissions" is implemented by opening the same entry form with
role-based edit rights (`canEditSubmission`): AM edits anything unpublished,
Manager/Admin can also override published records (fully audited). This avoids a
second, divergent editing UI.
