import sharp from "sharp";

export type ProcessedImage = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  width: number;
  height: number;
  bytes: number;
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB raw upload cap
const MAX_EDGE = 1024; // longest edge Claude sees
const JPEG_QUALITY = 82;

/**
 * Validate, sniff, downscale, and re-encode to JPEG.
 * Strips EXIF. No persistence anywhere.
 */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("image_too_large");
  }

  // Magic-byte sniff via sharp metadata (sharp will throw on invalid).
  const meta = await sharp(buffer).metadata();
  const format = meta.format;
  if (!format || !["jpeg", "png", "webp", "heif", "gif"].includes(format)) {
    throw new Error("unsupported_image_format");
  }

  // HEIF / HEIC / anything else → JPEG. Downscale longest edge to 1024.
  const out = await sharp(buffer, { failOn: "error" })
    .rotate() // respect EXIF orientation, then strip
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    base64: out.data.toString("base64"),
    mediaType: "image/jpeg",
    width: out.info.width,
    height: out.info.height,
    bytes: out.info.size,
  };
}
