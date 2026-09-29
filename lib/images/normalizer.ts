import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_DIMENSION_LIMIT = 4096; // 4096px max dimension limit
export const ABSOLUTE_MAX_INPUT_DIMENSION = 16384; // Prevent decompression bombs

export type AllowedMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface NormalizedImageResult {
  buffer: Buffer;
  mimeType: AllowedMimeType;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
}

/**
 * Detects real MIME type by inspecting the file's magic bytes.
 * Never trusts user-supplied file.type or file extension alone.
 */
export function detectMimeFromMagicBytes(buffer: Buffer): AllowedMimeType | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP magic bytes: RIFF [4 bytes size] WEBP
  // 'RIFF' = 0x52 0x49 0x46 0x46
  // 'WEBP' = 0x57 0x45 0x42 0x50
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Sanitizes a filename, stripping directory path traversal patterns
 * and restricting to safe alphanumeric characters, dashes, underscores, and dots.
 */
export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename || 'image.jpg');
  // Strip control chars, directory traversal, and weird symbols
  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^_+/, '')
    .slice(0, 100);

  return sanitized || `image_${Date.now()}.jpg`;
}

/**
 * Computes SHA-256 hash of a buffer.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Normalizes an image buffer using sharp:
 * 1. Validates magic bytes and rejects forbidden formats.
 * 2. Auto-rotates orientation using EXIF orientation tags.
 * 3. Converts color space to sRGB.
 * 4. Resizes gracefully if dimension exceeds MAX_DIMENSION_LIMIT (without distortion or enlargement).
 * 5. Strips dangerous/extraneous EXIF/metadata.
 * 6. Preserves visual fidelity (no tinting, no alteration of garment appearance).
 * 7. Computes SHA-256 on the resulting normalized bytes for true deduplication.
 */
export async function normalizeImage(
  inputBuffer: Buffer,
  declaredMimeType?: string
): Promise<NormalizedImageResult> {
  // 1. Size check
  if (inputBuffer.length > MAX_IMAGE_FILE_SIZE) {
    throw new Error(
      `El archivo excede el tamaño máximo permitido de 10 MB (tamaño recibido: ${(inputBuffer.length / (1024 * 1024)).toFixed(2)} MB).`
    );
  }

  // 2. Real MIME detection via magic bytes
  const realMime = detectMimeFromMagicBytes(inputBuffer);
  if (!realMime) {
    throw new Error(
      `Formato de archivo inválido o corrupto. Los magic bytes no corresponden a JPEG, PNG o WebP permitidos.`
    );
  }

  if (declaredMimeType && declaredMimeType !== realMime) {
    console.warn(`MIME type discrepante: declarado "${declaredMimeType}", detectado real "${realMime}". Usando real.`);
  }

  // 3. Inspect metadata with sharp
  const pipeline = sharp(inputBuffer);
  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('No se pudieron extraer las dimensiones válidas de la imagen.');
  }

  // Decompression bomb safety guard
  if (metadata.width > ABSOLUTE_MAX_INPUT_DIMENSION || metadata.height > ABSOLUTE_MAX_INPUT_DIMENSION) {
    throw new Error(
      `Dimensiones de imagen excesivas (${metadata.width}x${metadata.height}). Límite de seguridad: ${ABSOLUTE_MAX_INPUT_DIMENSION}px.`
    );
  }

  // 4. Build transformation pipeline
  let transform = pipeline
    .rotate() // auto-rotates based on EXIF orientation tag
    .toColorspace('srgb'); // ensures standard color gamut

  // Resize only if larger than MAX_DIMENSION_LIMIT
  if (metadata.width > MAX_DIMENSION_LIMIT || metadata.height > MAX_DIMENSION_LIMIT) {
    transform = transform.resize({
      width: MAX_DIMENSION_LIMIT,
      height: MAX_DIMENSION_LIMIT,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Preserve format with high quality (no visual loss)
  if (realMime === 'image/jpeg') {
    transform = transform.jpeg({ quality: 92, mozjpeg: true });
  } else if (realMime === 'image/png') {
    transform = transform.png({ compressionLevel: 8 });
  } else if (realMime === 'image/webp') {
    transform = transform.webp({ quality: 92 });
  }

  const normalizedBuffer = await transform.toBuffer();

  // Inspect output dimensions
  const finalMeta = await sharp(normalizedBuffer).metadata();
  const finalWidth = finalMeta.width || metadata.width;
  const finalHeight = finalMeta.height || metadata.height;

  // 5. SHA-256 hash of normalized buffer
  const sha256 = computeSha256(normalizedBuffer);

  return {
    buffer: normalizedBuffer,
    mimeType: realMime,
    width: finalWidth,
    height: finalHeight,
    byteSize: normalizedBuffer.length,
    sha256,
  };
}
