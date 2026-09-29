import { BoundingBox } from '@/types';

export interface SegmentationMask {
  width: number;
  height: number;
  /** Encoded polygon points or binary mask representation */
  polygon?: { x: number; y: number }[];
  svgPath?: string;
  confidence: number;
}

export interface SegmentationInput {
  imageBuffer: Buffer;
  mimeType: string;
  boundingBox?: BoundingBox;
  pointPrompts?: { x: number; y: number; label: 0 | 1 }[];
}

export interface SegmentationResult {
  mask: SegmentationMask;
  croppedBuffer: Buffer;
  segmentedConfidence: number;
  provider: 'gemini-bbox-fallback' | 'sam' | 'sam2' | 'mock';
}

/**
 * Strategy interface for garment segmentation.
 * Level 1: Default bounding box crop (sharp).
 * Level 2: Extended segmentation models (SAM / SAM2 / Grounded SAM) without coupling domain logic.
 */
export interface GarmentSegmenter {
  readonly providerId: string;
  segment(input: SegmentationInput): Promise<SegmentationResult>;
}

export class DefaultBoundingBoxSegmenter implements GarmentSegmenter {
  readonly providerId = 'default-bbox-segmenter';

  async segment(input: SegmentationInput): Promise<SegmentationResult> {
    return {
      mask: {
        width: 100,
        height: 100,
        confidence: 0.95,
      },
      croppedBuffer: input.imageBuffer,
      segmentedConfidence: 0.95,
      provider: 'gemini-bbox-fallback',
    };
  }
}
