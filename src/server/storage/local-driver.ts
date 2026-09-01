import fs from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredObject } from "./types";

/**
 * Disk-backed object storage — the supported storage mode for this deployment.
 *
 * Photographs are written under `STORAGE_MEDIA_PATH`, which must be a mounted
 * volume that survives container replacement (see docs/deployment.md). Objects
 * are NEVER served from a public directory: every read goes through
 * `/api/media/[...key]`, which authorises the caller and enforces property
 * isolation before a single byte is returned.
 *
 * Keys are resolved strictly beneath the configured root, so a crafted key
 * (`../../etc/passwd`, an absolute path, a symlinked parent) cannot escape it.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly kind = "local" as const;
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    // Reject anything that is not a plain relative key before touching disk.
    if (!key || path.isAbsolute(key) || key.includes("\0")) {
      throw new Error("Invalid storage key");
    }
    const safe = path.resolve(this.root, key);
    if (!safe.startsWith(this.root + path.sep)) {
      throw new Error("Invalid storage key");
    }
    return safe;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    // Write to a temp file then rename, so a crashed write never leaves a
    // half-written photograph behind a valid database row.
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, body);
    await fs.rename(tmp, file);
    await fs.writeFile(`${file}.meta`, JSON.stringify({ contentType }));
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const file = this.resolve(key);
      const body = await fs.readFile(file);
      let contentType = "application/octet-stream";
      try {
        const meta = JSON.parse(await fs.readFile(`${file}.meta`, "utf8")) as {
          contentType?: string;
        };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // meta missing: fall back to octet-stream
      }
      return { body, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const file = this.resolve(key);
      await fs.unlink(file);
      await fs.unlink(`${file}.meta`).catch(() => undefined);
    } catch {
      // already gone
    }
  }

  /** Startup check: the media volume must exist and be writable. */
  async verifyWritable(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    const probe = path.join(this.root, `.write-probe-${process.pid}`);
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe);
  }

  get rootPath(): string {
    return this.root;
  }
}
