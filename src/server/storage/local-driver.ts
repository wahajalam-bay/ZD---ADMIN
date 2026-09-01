import fs from "node:fs/promises";
import path from "node:path";
import type { StorageDriver, StoredObject } from "./types";

/**
 * Development-only disk storage. Keys are sanitized and resolved strictly
 * beneath the configured root to prevent path traversal.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly kind = "local" as const;
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    const safe = path.resolve(this.root, key);
    if (!safe.startsWith(this.root + path.sep) && safe !== this.root) {
      throw new Error("Invalid storage key");
    }
    return safe;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
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
}
