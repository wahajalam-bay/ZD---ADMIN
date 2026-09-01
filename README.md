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
disk-backed media storage (no object store required) · Vitest · Playwright.

## Project structure

```
.
├── src/
│   ├── app/                      routes — App Router
│   │   ├── command-center/       management dashboards (portfolio, property, photos)
│   │   ├── entry/                Data Entry Engine (checklists, weekly reports)
│   │   ├── review/               review, return, approve, publish
│   │   ├── admin/                users, properties, integrations, audit
│   │   ├── api/                  auth handler, health, authorised media reads
│   │   └── login/
│   ├── components/
│   │   ├── ui/                   design-system primitives (KPI card, panel, table…)
│   │   ├── shell/                app shell, sidebar, page header, reporting controls
│   │   └── theme/                light / dark / presentation modes
│   ├── features/                 feature UI, one folder per area
│   │   ├── command-center/       boards, charts, drill-down panels, PropOne
│   │   ├── entry/                checklist + weekly report forms
│   │   ├── review/               review queue and detail views
│   │   └── admin/                user, property and integration admin
│   ├── lib/                      pure, unit-tested logic (roles, weeks, compliance,
│   │                             metrics, validation) — no I/O
│   ├── server/
│   │   ├── auth/                 Better Auth config + session reader
│   │   ├── permissions/          authoritative guards (property + role)
│   │   ├── services/             all SQL lives here
│   │   ├── actions/              server actions — validated, authorised, audited
│   │   ├── integrations/propone/ Redshift/CSV adapters behind one boundary
│   │   ├── storage/              disk media driver, image validation, thumbnails
│   │   └── env.ts                validated environment, fails fast
│   └── db/
│       ├── schema/               Drizzle tables
│       └── seeds/                baseline · demo · legacy Command Center week
├── drizzle/                      version-controlled migrations
├── docker/                       container entrypoint (runs migrations, then serves)
├── docs/                         audit, decisions, deployment, backup, UI/UX
├── reference/                    the original prototypes, preserved verbatim
├── scripts/                      operator CLIs (dev DB, admin bootstrap, imports)
├── tests/unit/                   Vitest
└── tests/e2e/                    Playwright
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

## Run it

### Docker (everything in one command)

```bash
cp .env.example .env
# set BETTER_AUTH_SECRET and POSTGRES_PASSWORD in .env:
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

docker compose up -d --build          # Postgres 18 + the app; migrations run on boot
docker compose exec app sh -c 'cd /tools && node_modules/.bin/tsx scripts/bootstrap-admin.ts'
```

Then open <http://localhost:3000>. Media is stored on the `media` volume — there is
**no S3 or MinIO to configure**. Back that volume up with the database
([docs/backup-and-restore.md](./docs/backup-and-restore.md)).

### Local development

```bash
pnpm install
pnpm db:dev                # embedded PostgreSQL 18 on port 5544
cp .env.example .env       # DATABASE_URL default matches pnpm db:dev
pnpm db:migrate
pnpm db:seed:demo          # baseline + labelled DEMO data + demo accounts
pnpm db:seed:legacy        # the legacy Command Center week, merged verbatim
pnpm dev                   # http://localhost:3000
```

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
| `pnpm db:seed:legacy` | Merge the legacy Command Center week (verbatim tasks, issues, summaries) |
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

Multi-stage `Dockerfile` (Node 24, standalone output, non-root, healthcheck) plus a
`docker-compose.yml` that brings up PostgreSQL and the app together. Migrations run
automatically at container start; nothing seeds itself.

Media lives on a mounted volume rather than an object store — the app refuses to
start in production if `STORAGE_MEDIA_PATH` is not an absolute path, so photographs
can never be written somewhere that disappears on the next deploy.

See [docs/deployment.md](./docs/deployment.md) for topology, environment, TLS,
upgrades and the admin bootstrap, and
[docs/backup-and-restore.md](./docs/backup-and-restore.md) for backups.

## Mobile

Site teams file checklists from a phone, so every screen is built for touch: a
drawer navigation, 36–44px tap targets, 16px form text (iOS zooms anything smaller),
safe-area padding for notched devices, and wide data tables that become card lists
below 640px instead of scrolling sideways.
