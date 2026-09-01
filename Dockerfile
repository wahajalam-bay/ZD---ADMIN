# ── Zameen Admin Properties — production image ─────────────────────────────
# Node 24 LTS · pnpm · Next.js standalone output · non-root.
#
# Layout inside the image:
#   /app    Next.js standalone server (its own traced node_modules)
#   /tools  full dependency tree + source, used only by the entrypoint to run
#           database migrations and the operator CLIs (bootstrap:admin, seeds)
#
# Keeping them apart means the server runs exactly the tree Next traced, while
# `docker compose exec app pnpm db:migrate` still works on a live deployment.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

# 1. Dependencies (cached until the lockfile changes)
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time placeholders only — real values are injected at runtime.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV BETTER_AUTH_SECRET="build-time-placeholder-secret-value"
RUN pnpm build

# 3. Runtime
FROM node:24-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Media volume. env.ts refuses to boot in production on a relative path.
ENV STORAGE_MEDIA_PATH=/var/lib/zameen/media

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /var/lib/zameen/media \
  && chown -R nextjs:nodejs /var/lib/zameen

# Next.js standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Operator toolchain: migrations, admin bootstrap, seeds.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules /tools/node_modules
COPY --chown=nextjs:nodejs package.json tsconfig.json /tools/
COPY --chown=nextjs:nodejs src /tools/src
COPY --chown=nextjs:nodejs scripts /tools/scripts
COPY --chown=nextjs:nodejs drizzle /tools/drizzle
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000
VOLUME ["/var/lib/zameen/media"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
