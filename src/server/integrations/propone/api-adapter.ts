import { env } from "@/server/env";
import type { PropOneAdapter } from "./types";

/**
 * Placeholder for the real PropOne API integration.
 *
 * The production PropOne API specification (base URL, authentication, response
 * schemas, pagination) has NOT been provided. This adapter intentionally does
 * not invent endpoints — it reports "not configured" until PROPONE_API_BASE_URL
 * and PROPONE_API_TOKEN are supplied AND the fetch/mapping logic is implemented
 * against the real contract. The rest of the system (storage, metrics,
 * dashboards) is already wired to consume whatever this adapter normalizes.
 */
export class PropOneApiAdapter implements PropOneAdapter {
  readonly mode = "API" as const;

  describe() {
    const configured = Boolean(env.PROPONE_API_BASE_URL && env.PROPONE_API_TOKEN);
    return {
      ready: false,
      detail: configured
        ? "API credentials are set, but the PropOne API mapping is pending the official specification. Use file import meanwhile."
        : "PropOne API is not configured (PROPONE_API_BASE_URL / PROPONE_API_TOKEN missing). Use file import meanwhile.",
    };
  }
}
