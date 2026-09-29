export type QualityProfile = 'draft' | 'standard' | 'final';

export interface GenerationCostQuote {
  planKey?: string;
  maxAttempts?: number;
  maxEstimatedCostUsd?: number;
  quoteId: string;
  provider: string;
  model: string;
  qualityProfile: QualityProfile;

  selectedVariantCount: number;
  selectedShotCount: number;
  totalImages: number;

  estimatedCostPerImageUsd: number | null;
  estimatedGenerationCostUsd: number | null;

  estimatedValidationCostUsd?: number | null;
  estimatedTotalCostUsd: number | null;

  currency: 'USD';

  isEstimate: true;
  calculatedAt: string;
}

export interface CostEstimationRequest {
  imageCount: number;
  qualityProfile: QualityProfile;
  aspectRatio?: string;
  resolution?: string;
}

export interface GenerationCostEstimate {
  estimatedCostPerImageUsd: number | null;
  estimatedGenerationCostUsd: number | null;
  currency: 'USD';
}

export interface ProviderPricingRule {
  provider: string;
  model: string;
  qualityProfile: QualityProfile;
  estimatedCostPerImageUsd: number;
}

export interface GenerationPricingSnapshot {
  planKey?: string;
  confirmedAt?: string;
  maxAttempts?: number;
  maxEstimatedCostUsd?: number;
  quoteId: string;
  provider: string;
  model: string;
  qualityProfile: QualityProfile;
  imageCount: number;
  estimatedCostPerImageUsd: number | null;
  estimatedGenerationCostUsd: number | null;
  estimatedValidationCostUsd: number | null;
  estimatedTotalCostUsd: number | null;
  currency: 'USD';
  quotedAt: string;
}

export interface ActualGenerationCost {
  estimatedUsd: number | null;
  actualUsd: number | null;
  generatedImages: number;
  failedImages: number;
  attemptsCount: number;
  billableRequestsCount: number;
}
