export interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Minimal storage driver contract. Production uses the S3 driver (AWS S3,
 * Cloudflare R2, MinIO — anything S3-compatible). The local driver is a
 * development fallback writing beneath STORAGE_LOCAL_PATH.
 *
 * The database stores object keys + metadata only — never file bytes.
 */
export interface StorageDriver {
  readonly kind: "s3" | "local";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
