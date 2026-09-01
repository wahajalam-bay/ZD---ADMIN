# Reference Audit

The production system was rebuilt from three source artifacts (preserved verbatim in
[/reference](../reference/)). This document records what each contains and how it maps
into the application.

| Source | Role |
| --- | --- |
| `Deployment Request Zameen Admin Dashboard.docx` | Business/deployment requirements (roles, isolation, PropOne, photo linkage) |
| `Admin_Data_Entry_Engine.html` | Data-entry behavior + authoritative checklist schema |
| `Zameen_Admin_Properties_Command_Center (1).html` | Dashboard design language, KPI concepts, compliance/bottleneck presentation, PropOne sections |

`Admin_Live_Dashboard.html` was **not present** in the repository. Per the approved
architecture direction, the **Command Center itself is the live dashboard** — no
duplicate dashboard was built; `/dashboard` redirects to `/command-center`.

## 1. Deployment Request (DOCX)

Extracted requirements → implementation:

| Requirement (section) | Implementation |
| --- | --- |
| Replace `window.storage` with a real database (§3) | PostgreSQL 18 + Drizzle ORM; no browser storage holds business data |
| Login system, per-user accounts (§3, §8) | Better Auth email/password, server-side DB sessions |
| Server-enforced site isolation — "not just hidden in the browser" (§3, §5) | `requirePropertyAccess` / `requirePropertyByCode` guards on every property-scoped read/write/upload/media fetch; E2E-tested with forged URLs/IDs |
| Roles: Site User (own site), AM (all sites + review/approve/publish), Manager/Admin (+ accounts, resets, overrides) (§5) | `SITE_USER` / `ASSISTANT_MANAGER` / `MANAGER_ADMIN` in `src/lib/roles.ts` + server guards |
| Entry stays "pending" until AM/Admin approves before it shows on the dashboard (§8) | Workflow `DRAFT → SUBMITTED → (RETURNED) → APPROVED → PUBLISHED`; Command Center reads `PUBLISHED` only (management preview may include `APPROVED`) |
| PropOne data live-connected, weekly refreshed, not pasted into HTML (§6) | PropOne integration layer: normalized tables, adapter boundary, validated CSV import fallback, admin page (`/admin/integrations`) |
| Photo tied to its exact checklist point, shown only there (§7) | `checklist_response_photos.checklistResponseId` FK; bottleneck evidence opens only that response's photos (E2E-verified positive + negative) |
| Both tools under one link: `/entry` + dashboard (§8) | Single Next.js app: `/entry`, `/review`, `/command-center`, `/admin`; `/dashboard` → `/command-center` |
| Dummy account per role to verify restrictions (§8) | `pnpm db:seed:demo` creates one account per role + per-property site users; restrictions covered by Playwright suite |
| Note on how new users are added (§9) | `/admin/users` (Manager/Admin) + README/deployment docs |

## 2. Data Entry Engine (HTML)

Authoritative schema extracted from the `SCHEMA` constant — **22 categories**, seeded
verbatim by `src/db/seeds/checklist-definitions.ts`:

- **LOG categories (4)**: `genset_500`, `genset_250` (fields: Opening Reading, Closing
  Reading, Total Hours, Fuel Used (Ltr), Reading Done By, Entered By, Verified By);
  `fuel_refill_500`, `fuel_refill_250` (Liters Refilled, Refilled By, Verified By, Remarks).
- **CHECK categories (18)**: Generator Checklist (20 items), Firefighting Pumps (22),
  Swimming Pool (10), Cafeteria (13), Cinema (8), Gym / Fitness Center (15), Kids Play
  Area (7), Garbage Chute (5), Housekeeping (6), Rooftop (6), Terraces (7), All Floor
  Meter Rooms (13), CCTV / IT Room (11), LT Room (8), Fire Fighting General (5),
  Lift (24), Tubewell (7), Basement 2 Motor Pump (13). Item wording preserved verbatim.
- The source also defines an `eval` type (Pass/Fail/N/A rating) that **no category
  uses**; the `category_type` enum preserves `EVAL` for forward-compatibility.

Behavior preserved:

- **OP / CL** = per-item opening/closing check marks (confirmed by items like
  "Time (Opening & Closing)"). Not reinterpreted as pass/fail.
- **Defect / Comment** free-text per item → drives bottlenecks.
- **Photo per checklist item** (`itemImages`) → `checklist_response_photos` (object
  storage, exact-response FK) instead of base64-in-record.
- **Sign-off fields**: "Duty Electrician / Technician Sign", "A.M Admin",
  "Manager Admin" → columns on `checklist_entries`, plus authenticated
  submitter/reviewer/approver/publisher ids + timestamps for real auditability.
- **Weekly report**: Monday `weekStart`; tracking **On track / Watch / At risk**;
  one-line summary; task list with **Completed / In Process** + ETA date; photos with
  captions; notes; Save draft / Submit for review.
- Statuses draft/submitted/reviewed → upgraded to the five-state workflow (the
  reference "reviewed" splits into APPROVED and PUBLISHED per the deployment request).

## 3. Command Center (HTML)

Design language preserved (light grey ground, white cards, teal `#0d9488` accent,
Inter + IBM Plex Mono, left navigation, dense KPI cards) and rebuilt as React
components on live queries.

| Reference element | Live implementation |
| --- | --- |
| Portfolio KPIs: Properties / Total Area / Completed This Week / In Process / Site Photos | `portfolioMetrics` service — computed from active properties + published weekly tasks/media for the selected week |
| "Week of 20 Aug 2026" hardcoded week | Reporting-week selector; defaults to latest published week; Published / Approved-Preview / No-Data states |
| Completed vs In Process by property (bar), Portfolio Task Status donut (62% done) | Recharts fed by SQL aggregation; % from `taskCompletionPct` (divide-by-zero safe) |
| Property cards with hero, meta, stats | DB-driven property cards; master data for **Opal (300,000+ Sft, Completed), Aurum (163,000 Sft, Constructed), Quadrangle (252,000+ Sft, Completed)**, all "Lahore, Pakistan · Residential Apartments" — seeded as master data |
| Checklist Compliance donut: `pct = round(clean/total*100)`, legend Clean/Flagged/Total pages | **Formula found in reference JS and preserved** (`renderSiteCharts`), with "pages" → published checklist entries; unit-tested in `tests/unit/compliance.test.ts` |
| Bottlenecks: Checklist / Issue Found / Severity (High/Medium/Low) / **Slide** | Live columns Checklist / Checklist Point / Issue Found / Severity / Date / **Evidence** — evidence opens the exact response's photos (the "Slide" link is replaced, as required) |
| Task table `# / Task / Status / ETA-Completion`, dd-MM-yyyy ETA | Published `weekly_tasks`, same columns and chips |
| PropOne — Opal Visits (Today/This Week/All-time, detail rows Visitor/Unit/Resident/Arrival/Departure/Status, log-scale bar) | `VISITS` widget: computed metrics + detail dialog; extended-stay/short-visit types supported |
| PropOne — Aurum Work Orders (All/Completed/Rejected/Pending Procurement + donut), Visits, Cinema bookings (Attended/Pre-booked/Cancelled) | `WORK_ORDERS`, `VISITS`, `CINEMA_BOOKINGS` widgets |
| PropOne — Quadrangle Work Orders, Visitors (period), Vehicle Stickers (Owner/LTR), Snooker bookings, Announcements | `WORK_ORDERS`, `VISITORS`, `VEHICLE_STICKERS`, `AMENITY_BOOKINGS`, `ANNOUNCEMENTS` widgets |
| Photos page: per-property galleries, counts, lightbox with prev/next/keyboard/fullscreen | `/command-center/photos` with property + week filters, Progress vs Evidence tabs, accessible lightbox |
| Site Videos (none submitted) / Live Camera (not configured) | Honest empty states; media model supports VIDEO for later; no fabricated feeds |
| Static sample figures (15 completed / 9 in process / 146 photos / all PropOne counts) | **Not seeded as production data** — demo seed creates clearly-labeled synthetic DEMO records instead |

## Unresolved ambiguities

Recorded with rationale in [decisions.md](./decisions.md): severity capture, sidebar
status-dot/phase semantics, PropOne API specification, publication model detail,
compliance mapping from "deck pages" to "entries".
