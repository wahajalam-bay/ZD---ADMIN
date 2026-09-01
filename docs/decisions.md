# Engineering Decisions & Open Business Questions

Ambiguities are resolved explicitly here — never hidden inside implementation.

## 1. Checklist compliance formula (point-based — REVISED)

The reference Command Center defines only the **shape** of the metric
(`renderSiteCharts`), with clean/flagged/total supplied as static sample values:

```js
pct = Math.round((checklist_clean / checklist_total) * 100) // legend: Clean / Flagged / Total
```

The Data Entry Engine contains **no** compliance or scoring logic at all, so the
derivation rule had to be decided. It is preserved verbatim in `src/lib/compliance.ts`
(unit-tested), with these decisions:

**Unit = one checklist POINT.** A point is a single `checklist_responses` row: one
checklist item, on one entry (property + category + day). Earlier this project counted
whole *entries*; that made one comment on a 40-item sheet as costly as forty, so the
unit is now the point. Portfolio compliance aggregates every point — it is never an
average of per-property averages (`groupCompliance` + `computeCompliance`,
unit-tested against exactly that mistake).

**A point is flagged only when the site team recorded an issue** — a defect comment
and/or an explicit severity. `responseIsDefect()` is the single definition, shared by
compliance *and* the bottleneck feed, so the two can never disagree.

**OP / CL are NOT pass/fail.** They are the Opening and Closing checks (confirmed by
reference items such as "Time (Opening & Closing)"). An unticked OP or CL is therefore
**not** treated as non-compliance — doing so would invent a failure rule the source
artifacts never state. (This reverses an earlier decision in this project.)

**Visibility.** Only `PUBLISHED` entries count in official reporting; management
preview additionally counts `APPROVED`. `DRAFT`, `SUBMITTED` and `RETURNED` work is
never measured, so an unfinished sheet cannot move a management number
(`PUBLISHED_VISIBILITY` / `PREVIEW_VISIBILITY`, unit-tested).

**No data ≠ 0%.** With zero applicable points `pct` is `null` and the UI shows "—"
plus the reason, never a fabricated zero.

**Rates compare in percentage points.** Week-on-week movement uses
`complianceDeltaPp()` and is labelled `pp`, never `%`. When either week has nothing to
measure the delta is `null` and the KPI says "No prior-week comparison".

*The formula lives in one isolated, unit-tested module, and every server aggregation
(`checklist-compliance-service.ts`) delegates to it, so the business rule can be
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
  most-severe → most recent. This is the same `responseIsDefect()` predicate that
  drives compliance (§1), so the bottleneck count and the flagged-point count always
  reconcile — a unit test asserts it.

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

## 10. Legacy reference photos — imported

The 146 real site photos embedded as base64 in the reference Command Center were
migrated with `pnpm import:reference-photos [--publish]`: each image runs through
the production upload pipeline (sharp validation/re-encode/thumbnail) into object
storage and attaches as weekly progress media on the property's current-week report
with its original caption; reference hero photos become the property hero images.
Idempotent (dedupe by original filename per property). Base64 never enters the
database.

## 11. Redshift (PropOne Pakistan) — LIVE

The PropOne Pakistan warehouse (`magneto-pk`, schema `propone_zameenpk`, FMS
tables) is connected via `PROPONE_REDSHIFT_URL` (Redshift speaks the PostgreSQL
wire protocol; standard `pg` driver). "Sync from Redshift" on Admin →
Integrations pulls, per property mapped through `properties.propOneExternalId`
(= `fms_projects.id`: Opal=17, Aurum=9, Quadrangle=24):

- `fms_work_orders` (+ statuses, units) → **Work Orders site-wise**
- `fms_visits` (+ visitors, units, statuses) → **Visitor records site-wise**
- `fms_amenity_reservations` (+ amenities, statuses) → **Amenities bookings site-wise**

Sync mechanics: CDC snapshots are deduped to the latest row per business id;
synced rows carry the `RS-` externalId prefix and are replaced per
property+domain in a transaction (idempotent, reflects updates/deletes, never
touches CSV-imported rows); every property+domain sync is a recorded
`propone_sync_runs` row (mode REDSHIFT). Inbound strings are sanitized (NUL/
control chars) and the application database is UTF-8 (required for Urdu/Arabic
visitor names — the embedded dev cluster is initialised with
`--encoding=UTF8`). Booking/work-order widgets present real status
vocabularies (`byStatus`) rather than assuming the reference CSV's labels.
Credentials live only in `.env` (never committed). Remaining external inputs:
none for these three domains; a production service account (rather than a
personal login) is recommended before go-live.

## 12. Review-time editing

AM/Manager "edit submissions" is implemented by opening the same entry form with
role-based edit rights (`canEditSubmission`): AM edits anything unpublished,
Manager/Admin can also override published records (fully audited). This avoids a
second, divergent editing UI.
