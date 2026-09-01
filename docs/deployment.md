# Production Deployment

Portable container deployment — company VPS, internal Linux server, AWS, Azure,
DigitalOcean or any Docker-capable host. **No Vercel-only dependencies.**

## Topology

```
Internet / Company Network
        │  HTTPS (company subdomain, e.g. admin-properties.company.com)
        ▼
Reverse proxy / load balancer (nginx / Caddy / Traefik — TLS terminates here)
        ▼
Next.js app container (this image, port 3000, non-root)
        ├──► PostgreSQL 18 (private network only — never publicly exposed)
        └──► S3-compatible object storage, PRIVATE bucket
             (AWS S3 / Cloudflare R2 / self-hosted MinIO)
```

## 1. Prerequisites

- A Linux host with Docker (or a container platform) and a reverse proxy for TLS.
- **DNS**: an A/CNAME record for the chosen subdomain pointing at the proxy.
- **HTTPS is required** — auth cookies are `Secure` in production. Configure the
  proxy to forward `Host` and `X-Forwarded-*` headers to the app.
- PostgreSQL 18 (managed service or container) reachable from the app only.
- An S3-compatible bucket, **private**, with an access key limited to that bucket.

## 2. Environment variables

Copy `.env.example` and set real values (never commit secrets):

| Variable | Value |
| --- | --- |
| `APP_URL`, `BETTER_AUTH_URL` | `https://<your-domain>` (both, exactly) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — unique per environment |
| `DATABASE_URL` | `postgres://user:pass@host:5432/zameen_admin` |
| `STORAGE_DRIVER` | `s3` (production must not use `local`) |
| `S3_ENDPOINT` | Provider endpoint (omit for AWS S3) |
| `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket credentials |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO/R2, `false` for AWS |
| `PROPONE_MODE` | `file` until the PropOne API is specified |

## 3. Build & start

```bash
docker build -t zameen-admin-properties:v1 .
docker run -d --name zameen-admin \
  --env-file /srv/zameen/.env \
  -p 127.0.0.1:3000:3000 \
  --restart unless-stopped \
  zameen-admin-properties:v1
```

Point the reverse proxy at `127.0.0.1:3000`. The container exposes
`GET /api/health` (used by the image HEALTHCHECK) returning
`{"status":"ok","database":true}`.

Example nginx location:

```nginx
server {
  server_name admin-properties.company.com;
  # ... TLS config (certbot etc.) ...
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20m;   # photo uploads
  }
}
```

## 4. Database migrations

Migrations are version-controlled in `drizzle/` and must run against the production
database **before** starting a new app version. From a checkout (CI job or ops
machine that can reach the DB):

```bash
pnpm install --frozen-lockfile
DATABASE_URL=postgres://... pnpm db:migrate
```

Never enable schema auto-sync in production; `pnpm db:migrate` is the only mechanism.

## 5. Baseline seed & initial admin bootstrap

```bash
DATABASE_URL=postgres://... pnpm db:seed        # properties + 22 checklist definitions (idempotent)
```

Create the first Manager/Admin (one-off, run from the checkout):

```bash
DATABASE_URL=postgres://... \
ADMIN_EMAIL=ops.manager@company.com ADMIN_NAME="Ops Manager" ADMIN_PASSWORD='<strong password>' \
pnpm bootstrap:admin
```

The command is idempotent (refuses to duplicate an existing email). From then on all
accounts are created in the UI at **Admin → Users**. **Never run `pnpm db:seed:demo`
in production** — it creates labeled demo data for development only.

## 6. Upgrades

1. Build the new image (`:v2`).
2. `pg_dump` backup (see [backup-and-restore.md](./backup-and-restore.md)).
3. Run migrations: `DATABASE_URL=... pnpm db:migrate`.
4. `docker stop zameen-admin && docker rm zameen-admin`, start the new image.
5. Verify `/api/health` and sign in.

Rollback: restart the previous image tag. If a migration must be rolled back,
restore the pre-upgrade dump (migrations are forward-only).

## 7. Security notes

- The database and MinIO must not be exposed to the public internet.
- The media bucket stays private; all reads flow through the app's authenticated
  `/api/media` route.
- Security headers (CSP, nosniff, frame-deny, referrer policy) ship in
  `next.config.ts`; add HSTS at the proxy once HTTPS is stable:
  `add_header Strict-Transport-Security "max-age=31536000" always;`
- Session cookies are HttpOnly; authorization is enforced in server code (proxy
  middleware is a UX convenience only).

## 8. Still required from the business (external dependencies)

- Production domain name + TLS certificate strategy.
- Production PostgreSQL credentials/hosting choice.
- Production object-storage credentials (S3/R2/MinIO).
- PropOne API specification or committed weekly export format (until then:
  CSV import at Admin → Integrations).
- SMTP details only if self-service password reset is wanted later.
