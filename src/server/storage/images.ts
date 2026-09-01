import crypto from "node:crypto";
import sharp, { type Metadata } from "sharp";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024; // 12 MB
export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export interface ProcessedImage {
  main: { buffer: Buffer; contentType: string; width: number; height: number };
  thumb: { buffer: Buffer; contentType: string };
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

/**
 * Server-side upload validation + normalization:
 * - size limit
 * - the file must actually DECODE as an image (signature-level check via
 *   sharp — a renamed executable or html file fails here)
 * - re-encoded to JPEG (strips EXIF/GPS metadata), capped at 1920px
 * - 480px thumbnail generated
 * Never trusts the client-provided MIME type or filename.
 */
export async function processImageUpload(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new ImageValidationError("Empty file");
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("Image exceeds the 12 MB limit");
  }

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw new ImageValidationError("File is not a valid image");
  }
  const format = meta.format ?? "";
  if (!["jpeg", "png", "webp", "heif", "avif", "tiff"].includes(format)) {
    throw new ImageValidationError(`Unsupported image format: ${format || "unknown"}`);
  }

  const main = await sharp(input, { limitInputPixels: 80_000_000 })
    .rotate() // honor EXIF orientation before stripping metadata
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const thumb = await sharp(main.data)
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 74, mozjpeg: true })
    .toBuffer();

  return {
    main: {
      buffer: main.data,
      contentType: "image/jpeg",
      width: main.info.width,
      height: main.info.height,
    },
    thumb: { buffer: thumb, contentType: "image/jpeg" },
  };
}

/** Randomized object key — original filenames are metadata, never keys. */
export function buildObjectKey(propertyId: string, domain: "checklist" | "weekly", ext = "jpg") {
  const rand = crypto.randomUUID();
  const key = `properties/${propertyId}/${domain}/${rand}.${ext}`;
  return { key, thumbKey: `properties/${propertyId}/${domain}/${rand}-thumb.${ext}` };
}

/** Extracts the propertyId segment from a storage key for authorization. */
export function propertyIdFromKey(key: string): string | null {
  const m = /^properties\/([0-9a-f-]{36})\//.exec(key);
  return m?.[1] ?? null;
}
