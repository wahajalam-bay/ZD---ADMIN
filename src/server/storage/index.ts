import { env } from "@/server/env";
import { LocalStorageDriver } from "./local-driver";
import type { StorageDriver } from "./types";

/**
 * Object storage for checklist evidence and progress photographs.
 *
 * This deployment stores media on a mounted disk volume rather than an
 * S3-compatible service — see docs/decisions.md → "Media storage". The driver
 * interface is unchanged, so an object-store driver can be added later without
 * touching any caller.
 *
 * Photographs are never written into `public/`: reads are authorised per
 * request by `/api/media/[...key]`.
 */
const globalForStorage = globalThis as unknown as { __zameenStorage?: LocalStorageDriver };

export function getStorage(): LocalStorageDriver {
  if (globalForStorage.__zameenStorage) return globalForStorage.__zameenStorage;
  const driver = new LocalStorageDriver(env.STORAGE_MEDIA_PATH);
  globalForStorage.__zameenStorage = driver;
  return driver;
}

export type { StorageDriver };
