import { 
  GarmentLock, 
  GarmentValidationResult,
  GenerationRequest,
  ImageAsset,
} from '@/types';

export interface ProviderCapabilities {
  readonly supportsImageReference: boolean;
  readonly supportsMultipleReferences: boolean;
  readonly supportsSeed: boolean;
  readonly supportsNegativePrompt: boolean;
  readonly supportsImageToImage: boolean;
  readonly maxReferenceCount: number;
}

export interface AnalyzeGarmentOptions {
  name: string;
  category: string;
  sizes: string[];
  referenceImages: ImageAsset[];
}

export interface ImageGenerationProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  
  /**
   * Analyzes reference garment images and infers structured specifications (Garment Lock).
   */
  analyzeGarment(options: AnalyzeGarmentOptions): Promise<GarmentLock>;

  /**
   * Generates a single visual asset according to normalized GenerationRequest.
   */
  generateImage(request: GenerationRequest): Promise<ImageAsset>;

  /**
   * Compares the generated result with the source Garment Lock to verify fidelity.
   */
  validateImage(
    generatedAsset: ImageAsset,
    garment: GarmentLock,
    options?: {
      colorVariant?: import('@/types').ColorVariant;
      modelLock?: import('@/types').ModelLock;
      shotView?: import('@/types').MandatoryShotView;
    }
  ): Promise<GarmentValidationResult>;

  /**
   * Estimates generation cost based on image count and requested quality profile.
   */
  estimateCost?(request: import('@/lib/pricing/types').CostEstimationRequest): Promise<import('@/lib/pricing/types').GenerationCostEstimate>;
}
