# Zameen Admin Properties — Operations & Command Center

Internal operations platform for the Zameen Admin Properties portfolio. It replaces
the HTML/window.storage prototypes with a production web application:

- **Data Entry Engine** (`/entry`) — site teams file daily checklists (22 reference
  categories, OP/CL marks, defects with severity, **evidence photos tied to the exact
  checklist point**) and weekly reports (tracking status, summary, tasks, progress
  photos).
- **Review & Publication** (`/review`) — Assistant Managers / Managers review, return
  for correction, approve and publish, per submission or as a weekly property batch.
- **Command Center** (`/command-center`) — the live management dashboard. Every KPI,
  chart, compliance donut, bottleneck row, task table and photo comes from PostgreSQL
  — published data by default, approved-data preview for management. No number is
  ever edited in source code.
- **Administration** (`/admin`) — users, property master data, PropOne integration,
  immutable audit log.

```
Site User → Data Entry Engine → PostgreSQL → AM/Admin Review → Approval → Publication → Command Center
PropOne  → integration/import layer → PostgreSQL ────────────────────────────────────► Command Center
```

The original prototypes are preserved in [/reference](./reference/). See
[docs/reference-audit.md](./docs/reference-audit.md) for the mapping and
[docs/decisions.md](./docs/decisions.md) for recorded decisions/open questions.

## Stack

Next.js 16 (App Router, standalone output) · React 19 · TypeScript (strict) ·
Node 24 LTS · pnpm · PostgreSQL 18 · Drizzle ORM/Kit · Better Auth (server sessions,
admin plugin) · Tailwind CSS 4 · Recharts · React Hook Form + Zod · sharp ·
S3-compatible object storage (AWS S3 / Cloudflare R2 / MinIO) · Vitest · Playwright.

## Architecture

```
src/
  app/                     routes (entry, review, command-center, admin, api)
  components/              UI kit + application shell
  features/                feature components (entry forms, review, dashboards, admin)
  lib/                     pure shared logic (roles/permissions, weeks, compliance,
                           metrics, validation) — unit-tested
  server/
    auth/                  Better Auth config + session reader
    permissions/           authoritative guards (requirePropertyAccess, requireRole …)
    services/              data-access/KPI services (all SQL lives here)
    actions/               server actions (validated, authorized, audited)
    integrations/propone/  adapter boundary, CSV import, validators
    storage/               S3/local drivers, image validation + thumbnails
  db/schema/               Drizzle schema        db/seeds/  baseline + demo seeds
drizzle/                   version-controlled migrations
tests/unit                 Vitest    tests/e2e   Playwright
```

Client components never touch the database. Every property-scoped read/write is
authorized on the server — forged URLs, IDs and payloads are rejected regardless of
what the UI shows (covered by the E2E suite).

## Roles

| Role | Visibility | Can |
| --- | --- | --- |
| `SITE_USER` | Own property only (server-enforced) | Fill/save/submit checklists + weekly reports, upload photos, fix returned items |
| `ASSISTANT_MANAGER` | All properties | Everything above for any site + review, edit, return, approve, publish, preview |
| `MANAGER_ADMIN` | All properties | Everything + users, password resets, property master data, integrations, audit, overrides |

## Properties

The seeded portfolio is the built-and-functional set: **Opal, Aurum, Quadrangle**.
The system is fully property-driven — new properties are added at
**Admin → Properties** without code changes.

## Local development

```bash
pnpm install
docker compose up -d postgres minio createbucket   # PostgreSQL 18 + MinIO (private bucket)
cp .env.example .env                               # defaults match docker-compose
pnpm db:migrate                                    # apply migrations
pnpm db:seed:demo                                  # baseline + labeled DEMO data + demo accounts
pnpm dev                                           # http://localhost:3000
```

**No Docker?** `pnpm db:dev` boots a real embedded PostgreSQL 18 on port 5544
(set `DATABASE_URL=postgres://zameen:zameen@127.0.0.1:5544/zameen_admin`) and
`STORAGE_DRIVER=local` stores media on disk. Development only.

### Demo accounts (`pnpm db:seed:demo`, development only)

All use the password from `SEED_DEMO_PASSWORD` in `.env` (default documented there):

| Email | Role |
| --- | --- |
| `manager.admin@zameen.local` | Manager / Admin |
| `assistant.manager@zameen.local` | Assistant Manager |
| `opal.site@zameen.local` / `aurum.site@zameen.local` / `quadrangle.site@zameen.local` | Site users |

Demo records are labeled `DEMO` and must never be seeded in production.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Run / production build / serve |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply migrations (the only schema mechanism — no auto-sync) |
| `pnpm db:seed` / `pnpm db:seed:demo` | Baseline (properties + 22 checklist definitions) / + demo data |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm bootstrap:admin` | Create the first production Manager/Admin |
| `pnpm lint` / `pnpm typecheck` | ESLint / strict TypeScript |
| `pnpm test` | Vitest unit suite (weeks, compliance, metrics, RBAC, validators, PropOne) |
| `pnpm test:e2e` | Playwright (isolation, escalation, full workflow, exact photo linkage, admin) — needs a seeded demo DB |

## PropOne integration status

External dependency: no API specification has been provided. The integration
boundary, normalized storage, provenance, per-property widget configuration and a
**validated CSV import** (Admin → Integrations, with header templates and an import
report) are fully working. When the real API/export details arrive, only
`src/server/integrations/propone/api-adapter.ts` needs implementing — dashboards are
already wired. Details in [docs/decisions.md](./docs/decisions.md).

## Production

Multi-stage `Dockerfile` (Node 24, standalone output, non-root, healthcheck) — see
[docs/deployment.md](./docs/deployment.md) for topology, environment, migrations,
initial admin bootstrap, upgrades, and
[docs/backup-and-restore.md](./docs/backup-and-restore.md) for backups.
