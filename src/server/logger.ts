type Level = "info" | "warn" | "error";

/**
 * Structured server logging. JSON lines in production (machine-parseable),
 * readable output in development. Never log credentials, tokens or passwords.
 */
function write(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, message, ...meta };
  const line = process.env.NODE_ENV === "production" ? JSON.stringify(entry) : `[${level}] ${message}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
