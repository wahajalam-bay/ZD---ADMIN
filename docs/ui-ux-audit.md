# UI/UX Audit — pre-overhaul baseline

Audited every user-facing route against **Bayut Dashboard Design System v3.1**
(`Bayut-Dashboard-Design-System-v3.pdf`, read in full: foundations §1, data-viz colour
system §2, visualization catalog + selection guide §3, interaction & drill-down §4, core
components §5, domain blueprints §6, modes §7, accessibility §8, tokens §9).

Severity: **S1** blocks the primary objective · **S2** significant friction · **S3** polish.

## Global / shell

| # | Issue | Screens | Sev | Fix |
| --- | --- | --- | --- | --- |
| G1 | Brand truncates to "Zameen Developme…" in the 250px sidebar | all | S1 | Compact brand panel: ZA mark + two-line lockup, no truncation |
| G2 | Main canvas capped at `max-w-[1180px]` and centred — ~700px dead space at 1920 | all | S1 | Fluid width, `max-w-[1600px]`, 24–32px inline padding |
| G3 | No dark mode; no presentation mode (system §7 requires both) | all | S1 | Token-switching `ThemeProvider` (light/dark) + presentation mode |
| G4 | Pale-green border on every surface → flat hierarchy, "boxes in boxes" | all | S1 | Neutral border default; green reserved for active nav, primary action, positive metric, brand anchors |
| G5 | No sticky page header; context (week, publication state) scrolls away | dashboards | S2 | Reusable sticky `PageHeader` with breadcrumb + title + controls |
| G6 | Reporting controls fragmented (dropdown + 2 pills) | dashboards | S2 | One control cluster; segmented Published / Approved Preview + preview warning |
| G7 | User block is prototype-styled ("Demo Manager Admin / Sign out" raw) | all | S2 | Avatar + name/role + ⋯ menu (Account, Sign out) |
| G8 | No skeletons — pages pop in fully rendered or blank | all | S2 | Component-level skeletons (KPI, chart, table, cards) |
| G9 | No error states; failures fall through to the global boundary | all | S2 | `ErrorState` with human copy + Retry |
| G10 | Native `title=` tooltips on Site Videos / Live Camera badges | property | S3 | Premium tooltip component; never native |
| G11 | Status conveyed by colour alone in several badges | all | S2 | Unified badge: icon + colour + label everywhere |
| G12 | No cross-filtering, drill-down or slide-in analytics panel (system §4) | dashboards | S1 | `AnalyticsPanel` + clickable KPIs/bars/issues with URL-driven filter state |

## Portfolio Overview (`/command-center`)

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| P1 | Passive layout: no "what needs attention" surface — a Director cannot answer "which property needs attention / which issue is most serious" in 10s | S1 | Add **Attention Required** feed directly under property health, severity+age sorted, evidence-linked |
| P2 | Total Area occupies a primary weekly KPI slot | S2 | Demote to header metadata; KPI strip = Completed, In Process, Compliance, Open Bottlenecks, Site Photos |
| P3 | KPI cards are static numbers — no delta, no comparison, no micro-viz (system §5.1 anatomy) | S1 | Icon chip + label + value + delta pill vs previous week + sparkline/ring; whole card clickable |
| P4 | Property cards: 150px hero image dominates, 4 inline stats, no tracking prominence | S1 | Analytical-first health cards: thin hero strip, status, completed/in-process/compliance/issues/photos |
| P5 | Compliance % shown per property card only — no portfolio compliance | S2 | Portfolio compliance KPI (weighted across published entries) |
| P6 | Donut has no direct labels; relies on legend | S3 | Direct labelling, green/orange/neutral remainder |

## Property page (`/command-center/[code]`)

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| R1 | PropOne renders **before** operational risk and consumes ~3 full-width panels | S1 | Reorder: header → summary → KPIs → attention → task/compliance → PropOne → tasks → media |
| R2 | Visits chart plots Today (30) / This Week (112) / All-time (3,108) on one bar axis — incomparable scopes | S1 | **Remove**; three KPI values + real weekly visits line |
| R3 | Work-order monthly stacked bar with ~2 months of history | S2 | Status composition; trend only when ≥4 periods exist |
| R4 | Every PropOne domain is a separate giant section | S1 | Tabbed PropOne: Overview / Work Orders / Visits / Amenities (+Cinema where data exists) |
| R5 | Bottleneck table lacks age and status; "Date" only | S2 | Severity · Checklist · Point · Issue · Date/Age · Evidence · Status |
| R6 | Evidence opens a bare lightbox — no issue context, no timeline | S1 | Slide-in evidence panel: issue, severity, submitter/reviewer, photos, captions, workflow timeline |
| R7 | Weekly summary buried inside the master-data card | S2 | Dedicated Weekly Management Summary surface with tracking status |
| R8 | Task/compliance donuts use heavy rings | S3 | Progress rings, green/neutral, direct side legend |

## Photos (`/command-center/photos`)

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| M1 | Album cards show only name + 2 counts — sparse | S2 | Cover + name + photo count + new-this-week + last upload |
| M2 | No type filter at album level (progress vs evidence) | S2 | Filter chips: All/Opal/Aurum/Quadrangle × Progress/Evidence |
| M3 | Lightbox controls overlap content on mobile | S2 | Repositioned controls, safe areas, keyboard + swipe-friendly |
| M4 | Videos/Live Camera advertised as tabs though never configured | S3 | Shown as disabled secondary options with honest state |

## Data Entry (`/entry`, `/entry/[code]/…`)

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| E1 | Manager landing = three near-empty "choose a property" cards | S1 | Operational cards: today's checklist progress, pending review, weekly report status |
| E2 | Site-user landing redirects but then shows a generic overview | S2 | "My Site" operations view: today's progress, drafts, returned, weekly status, primary actions |
| E3 | Checklist board: 22 cards, no search, no status filter, returned items not surfaced | S1 | Search + status filter chips, returned float to top, per-card item count + progress |
| E4 | **Checklist entry is unusable on mobile** — 7-column table squeezes horizontally | S1 | Card-per-item layout below `lg`; sticky-header table on desktop |
| E5 | OP/CL are 20px native checkboxes — far below 40px touch target | S1 | Large toggle controls, OP/CL semantics preserved verbatim |
| E6 | Healthy rows carry the same form weight as defect rows | S2 | Progressive disclosure: severity + evidence emphasis appear when an issue is recorded |
| E7 | Save state invisible until toast; no autosave | S2 | Sticky action bar with live state (Unsaved / Saving / Saved HH:MM) + debounced draft autosave |
| E8 | Weekly report is one long unsectioned form | S2 | Sectioned: status, tracking segmented control, summary, tasks, photos, notes, sticky actions |
| E9 | Task rows show "ETA" label even when task is Completed | S3 | Label switches to Completion Date for completed tasks |

## Review (`/review`, `/review/*/[id]`)

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| V1 | No queue counts (pending/returned/approved/published) | S1 | Count segmented control that also filters |
| V2 | Review detail lists all 20+ items — defects buried among healthy rows | S1 | **Issues-first** default tab + All Items secondary |
| V3 | Row shows raw ids/edge data, multiple competing actions | S2 | One primary action ("Review"), clean summary row |
| V4 | Return dialog does not indicate which item is at fault | S2 | Optional affected-item selector in return dialog |
| V5 | Site user's returned state is a plain red strip | S2 | Returned banner with reason + "Fix Submission" CTA |

## Admin

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| A1 | Users table: three buttons in every row | S2 | ⋯ menu (Edit / Reset password / Disable) |
| A2 | No "last active" visibility | S3 | Last-active column from session data |
| A3 | Audit log prints raw JSON in the main table | S2 | Human sentence rendering + expandable details |
| A4 | Integrations page reads like a data dump | S2 | Ops framing: connection state, mode, last sync/attempt, records, errors, actions, history |
| A5 | Properties admin over-built for a 3-property portfolio | S3 | Simplify to the fields that matter |

## Responsiveness / a11y

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| X1 | Command Center tables overflow at 768px | S2 | Horizontal scroll containers with sticky first column, or card fallback |
| X2 | Charts overflow at 1024px in 2-col grid | S2 | Responsive grid breakpoints |
| X3 | No focus-visible styling on custom controls (kit requires `--ring`) | S2 | Global ring token on all interactive elements |
| X4 | Panels/dialogs lack focus trap | S2 | Native `<dialog>` for modals, focus-managed slide-in panel, Esc everywhere |
| X5 | Physical margins throughout (no RTL readiness) | S3 | Logical properties where practical |

## Content

| # | Issue | Sev | Fix |
| --- | --- | --- | --- |
| C1 | Empty states say "No data" style copy in places | S2 | Contextual copy naming property/week/action |
| C2 | "Demo …" strings visible in production-styled UI | S2 | Demo data is legitimate here — surface an explicit **Demo data** environment chip (`APP_ENV=demo`) rather than hiding it |
| C3 | Repeated "View details →" inside every PropOne KPI | S3 | Remove; card interactivity is implied by affordance |
| C4 | Stale portfolio references (NEO/Vault/ARX/…) | S2 | Verified: none in `src/` — only inside preserved `/reference` artifacts and historical docs |

---

## Post-overhaul status

Every S1/S2 finding above is implemented. Verification at the end of the
overhaul: `pnpm lint` clean, `pnpm typecheck` clean, 68/68 unit tests,
production build succeeds, 15/15 Playwright tests (11 pre-existing workflow /
isolation / photo-linkage specs updated to the new UI + 4 new mode & interaction
specs).

**Green intensity note.** A deeper-green variant (green-tinted ground, washed
card/sidebar surfaces, green ink) was trialled at management's request and then
reverted — the design-system palette reads better for dense operational work.
The shipped palette is the kit's: `#f4f8f5` ground, white cards, neutral-leaning
borders, `#1a2e22` ink, with Bayut green reserved for the brand header, active
navigation, primary actions and positive metrics (audit G4).
