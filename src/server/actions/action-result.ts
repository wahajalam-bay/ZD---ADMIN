import { AuthenticationError, AuthorizationError } from "@/server/permissions";
import { ImageValidationError } from "@/server/storage/images";
import { logger } from "@/server/logger";
import { ZodError } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Uniform server-action error envelope: expected errors surface a friendly
 * message; unexpected errors are logged server-side and masked to the client.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    if (
      err instanceof AuthorizationError ||
      err instanceof AuthenticationError ||
      err instanceof ImageValidationError
    ) {
      return { ok: false, error: err.message };
    }
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid input" };
    }
    // Better Auth APIError and friends carry a message worth surfacing.
    if (err && typeof err === "object" && "body" in err) {
      const body = (err as { body?: { message?: string } }).body;
      if (body?.message) return { ok: false, error: body.message };
    }
    logger.error("Unhandled action error", { error: String(err) });
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
