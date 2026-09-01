#!/bin/sh
# Container entrypoint.
#
# Applies pending database migrations, then hands control to the Next.js
# server. Migrations run through Drizzle's migrator, which records what it has
# applied — re-running is a no-op, so a restart or a second replica is safe.
#
# Nothing here ever creates users or seeds data: an operator does that
# explicitly (see docs/deployment.md).

set -eu

echo "[entrypoint] applying database migrations…"
cd /tools
if ! node_modules/.bin/tsx src/db/migrate.ts; then
  echo "[entrypoint] migration failed — refusing to start the application." >&2
  exit 1
fi

cd /app
echo "[entrypoint] starting application on port ${PORT:-3000}"
exec "$@"
