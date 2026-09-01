# ── Zameen Admin Properties — production image ─────────────────────────────
# Multi-stage build: Node 24 LTS, pnpm, Next.js standalone output, non-root.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 1. Dependencies (cached until lockfile changes)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env: only placeholders are needed — runtime env is injected by
# the orchestrator. next.config marks pg/sharp as external server packages.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV BETTER_AUTH_SECRET="build-time-placeholder-secret"
ENV STORAGE_DRIVER="local"
RUN pnpm build

# 3. Runtime (minimal, non-root)
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migration runner + migrations so `node_modules/.bin` is not required at runtime:
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
