import { env } from "@/server/env";
import { LocalStorageDriver } from "./local-driver";
import { S3StorageDriver } from "./s3-driver";
import type { StorageDriver } from "./types";

const globalForStorage = globalThis as unknown as { __zameenStorage?: StorageDriver };

export function getStorage(): StorageDriver {
  if (globalForStorage.__zameenStorage) return globalForStorage.__zameenStorage;
  const driver: StorageDriver =
    env.STORAGE_DRIVER === "s3"
      ? new S3StorageDriver({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET!,
          accessKeyId: env.S3_ACCESS_KEY_ID!,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
          forcePathStyle: Boolean(env.S3_FORCE_PATH_STYLE),
        })
      : new LocalStorageDriver(env.STORAGE_LOCAL_PATH);
  globalForStorage.__zameenStorage = driver;
  return driver;
}

export type { StorageDriver };
