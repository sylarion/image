import sharp from 'sharp';
import { BoundingBox, GarmentCrop, SourceImage } from '@/types';
import { computeSha256 } from '@/lib/images/normalizer';
import { getImageStorage } from '@/lib/storage/image-storage';

export class InvalidBoundingBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBoundingBoxError';
  }
}

/**
 * Validates and normalizes bounding box coordinates within [0.0, 1.0] range.
 * Throws InvalidBoundingBoxError if out of bounds or dimensions non-positive.
 */
export function validateAndClampBoundingBox(
  box: BoundingBox,
  imageWidth: number,
  imageHeight: number
): { left: number; top: number; width: number; height: number; clampedBox: BoundingBox } {
  if (
    !Number.isFinite(box.x) ||
    !Number.isFinite(box.y) ||
    !Number.isFinite(box.width) ||
    !Number.isFinite(box.height)
  ) {
    throw new InvalidBoundingBoxError('BoundingBox contiene valores no numéricos.');
  }

  // Validate range
  if (box.x < 0 || box.x >= 1 || box.y < 0 || box.y >= 1) {
    throw new InvalidBoundingBoxError(
      `BoundingBox origen fuera del rango [0, 1]: x=${box.x}, y=${box.y}`
    );
  }

  if (box.width <= 0 || box.height <= 0) {
    throw new InvalidBoundingBoxError(
      `BoundingBox dimensiones deben ser positivas: width=${box.width}, height=${box.height}`
    );
  }

  // Float clamp tolerance (up to 1.02 clamped to 1.0)
  const clampedX = Math.min(1.0, Math.max(0.0, box.x));
  const clampedY = Math.min(1.0, Math.max(0.0, box.y));
  const clampedWidth = Math.min(1.0 - clampedX, Math.max(0.01, box.width));
  const clampedHeight = Math.min(1.0 - clampedY, Math.max(0.01, box.height));

  const left = Math.max(0, Math.floor(clampedX * imageWidth));
  const top = Math.max(0, Math.floor(clampedY * imageHeight));
  const width = Math.min(imageWidth - left, Math.max(1, Math.round(clampedWidth * imageWidth)));
  const height = Math.min(imageHeight - top, Math.max(1, Math.round(clampedHeight * imageHeight)));

  return {
    left,
    top,
    width,
    height,
    clampedBox: {
      x: Number((left / imageWidth).toFixed(4)),
      y: Number((top / imageHeight).toFixed(4)),
      width: Number((width / imageWidth).toFixed(4)),
      height: Number((height / imageHeight).toFixed(4)),
    },
  };
}

export class PhysicalGarmentCropper {
  /**
   * Cuts a physical sub-image corresponding to a BoundingBox using sharp.
   * Stores the cropped image in persistent ImageStorage and returns a GarmentCrop entity.
   */
  async cropGarment(
    sourceImage: SourceImage,
    sourceBuffer: Buffer,
    detectionId: string,
    box: BoundingBox
  ): Promise<{ crop: GarmentCrop; buffer: Buffer }> {
    const { left, top, width, height, clampedBox } = validateAndClampBoundingBox(
      box,
      sourceImage.width,
      sourceImage.height
    );

    // Extract exact sub-region preserving format and max native resolution
    let pipeline = sharp(sourceBuffer).extract({ left, top, width, height });

    if (sourceImage.mimeType === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality: 95 });
    } else if (sourceImage.mimeType === 'image/png') {
      pipeline = pipeline.png({ compressionLevel: 8 });
    } else if (sourceImage.mimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: 95 });
    }

    const cropBuffer = await pipeline.toBuffer();
    const sha256 = computeSha256(cropBuffer);

    // Generate unique storage key
    const extension = sourceImage.mimeType === 'image/jpeg' ? 'jpg' : sourceImage.mimeType === 'image/png' ? 'png' : 'webp';
    const storageKey = `crop-${detectionId}-${sha256.slice(0, 12)}.${extension}`;

    const storage = getImageStorage();
    const storageResult = await storage.put(storageKey, cropBuffer, sourceImage.mimeType);

    const cropId = `crop-${detectionId}-${Date.now()}`;

    const crop: GarmentCrop = {
      id: cropId,
      sourceImageId: sourceImage.id,
      detectionId,
      storageKey: storageResult.storageKey,
      url: storageResult.url,
      width,
      height,
      sha256,
      boundingBox: clampedBox,
    };

    return { crop, buffer: cropBuffer };
  }
}
