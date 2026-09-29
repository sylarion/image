import { randomUUID } from 'node:crypto';
import { getAiConfig } from '@/lib/ai/config';
import { MAX_GENERATION_ATTEMPTS } from '@/lib/ai/job-state-machine';
import { 
  QualityProfile, 
  GenerationCostQuote, 
  CostEstimationRequest, 
  ProviderPricingRule 
} from './types';

export class GenerationPricingService {
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hour validity
  private static quotesStore = new Map<string, { quote: GenerationCostQuote; expiresAt: number }>();

  // Centralized Provider Pricing Rules
  private static pricingRules: ProviderPricingRule[] = [
    // Fal.ai (FLUX)
    { provider: 'fal', model: 'fal-ai/flux-pro/v1.1', qualityProfile: 'draft', estimatedCostPerImageUsd: 0.02 },
    { provider: 'fal', model: 'fal-ai/flux-pro/v1.1', qualityProfile: 'standard', estimatedCostPerImageUsd: 0.04 },
    { provider: 'fal', model: 'fal-ai/flux-pro/v1.1', qualityProfile: 'final', estimatedCostPerImageUsd: 0.08 },

    // OpenAI (DALL-E 3)
    { provider: 'openai', model: 'dall-e-3', qualityProfile: 'draft', estimatedCostPerImageUsd: 0.04 },
    { provider: 'openai', model: 'dall-e-3', qualityProfile: 'standard', estimatedCostPerImageUsd: 0.08 },
    { provider: 'openai', model: 'dall-e-3', qualityProfile: 'final', estimatedCostPerImageUsd: 0.12 },

    // Google Imagen
    { provider: 'gemini', model: 'imagen-3.0', qualityProfile: 'draft', estimatedCostPerImageUsd: 0.03 },
    { provider: 'gemini', model: 'imagen-3.0', qualityProfile: 'standard', estimatedCostPerImageUsd: 0.04 },
    { provider: 'gemini', model: 'imagen-3.0', qualityProfile: 'final', estimatedCostPerImageUsd: 0.06 },

    // Local GPU (No API fee, only electricity/hardware)
    { provider: 'local', model: 'local-flux', qualityProfile: 'draft', estimatedCostPerImageUsd: 0 },
    { provider: 'local', model: 'local-flux', qualityProfile: 'standard', estimatedCostPerImageUsd: 0 },
    { provider: 'local', model: 'local-flux', qualityProfile: 'final', estimatedCostPerImageUsd: 0 },

    // Mock
    { provider: 'mock', model: 'mock-model', qualityProfile: 'draft', estimatedCostPerImageUsd: 0 },
    { provider: 'mock', model: 'mock-model', qualityProfile: 'standard', estimatedCostPerImageUsd: 0 },
    { provider: 'mock', model: 'mock-model', qualityProfile: 'final', estimatedCostPerImageUsd: 0 },
  ];

  /**
   * Validation cost per image when Gemini validation is active
   */
  private static readonly GEMINI_VALIDATION_COST_PER_IMAGE = 0.0025; // ~$0.05 per 20 images

  /**
   * Returns rule matching provider, model, and qualityProfile.
   */
  static getPricingRule(provider: string, qualityProfile: QualityProfile): ProviderPricingRule {
    const normalizedProvider = provider.toLowerCase();
    if (normalizedProvider === 'gemini') {
      const config = getAiConfig();
      const rate = config.generationCostPerImageUsd;
      if (rate === undefined || !Number.isFinite(rate) || rate < 0) {
        throw new Error('PRICING_CONFIGURATION_REQUIRED: configurá GENERATION_COST_PER_IMAGE_USD con una tarifa verificada para GENERATION_MODEL.');
      }
      return { provider: normalizedProvider, model: config.generationModel, qualityProfile, estimatedCostPerImageUsd: rate };
    }
    const match = this.pricingRules.find(
      (r) => r.provider === normalizedProvider && r.qualityProfile === qualityProfile
    );
    if (match) return match;

    // Fallback rule for unknown provider
    const fallbackCost = normalizedProvider === 'local' || normalizedProvider === 'mock' ? 0 : 0.04;
    return {
      provider: normalizedProvider,
      model: 'default',
      qualityProfile,
      estimatedCostPerImageUsd: fallbackCost,
    };
  }

  /**
   * Returns cost per image for each quality tier for the active provider.
   */
  static getQualityTierRates(provider?: string): Record<QualityProfile, number> {
    const config = getAiConfig();
    const activeProvider = provider || (config.aiMode === 'real' ? config.generationProvider : 'mock');

    return {
      draft: this.getPricingRule(activeProvider, 'draft').estimatedCostPerImageUsd,
      standard: this.getPricingRule(activeProvider, 'standard').estimatedCostPerImageUsd,
      final: this.getPricingRule(activeProvider, 'final').estimatedCostPerImageUsd,
    };
  }

  /**
   * Creates a formal GenerationCostQuote based on real selection and saves it with quoteId.
   */
  static createQuote(params: {
    planKey?: string;
    selectedVariantCount: number;
    selectedShotCount: number;
    qualityProfile?: QualityProfile;
    aspectRatio?: string;
    resolution?: string;
    provider?: string;
    model?: string;
  }): GenerationCostQuote {
    const config = getAiConfig();
    const qualityProfile = params.qualityProfile || 'standard';
    const isReal = config.aiMode === 'real';

    const provider = params.provider || (isReal ? config.generationProvider : 'mock');
    const model = params.model || (isReal ? config.generationModel : 'mock-model');

    const totalImages = params.selectedVariantCount * params.selectedShotCount;
    if (!Number.isSafeInteger(totalImages) || totalImages <= 0) throw new Error('INVALID_QUOTE_QUANTITY');
    if (isReal && (!Number.isSafeInteger(config.maxRealGenerationsPerProduction) || config.maxRealGenerationsPerProduction < totalImages)) {
      throw new Error('COST_GUARD: la cantidad excede MAX_REAL_GENERATIONS.');
    }
    const maxAttempts = isReal ? Math.min(totalImages * MAX_GENERATION_ATTEMPTS, config.maxRealGenerationsPerProduction) : totalImages * MAX_GENERATION_ATTEMPTS;
    const rule = this.getPricingRule(provider, qualityProfile);

    // Generation cost calculation
    const isFreeApi = provider === 'local' || provider === 'mock';
    const estimatedCostPerImageUsd = isFreeApi ? 0 : rule.estimatedCostPerImageUsd;
    const estimatedGenerationCostUsd = isFreeApi 
      ? 0 
      : Number((totalImages * estimatedCostPerImageUsd).toFixed(2));

    // Validation cost calculation (if Gemini validator is active and provider is cloud)
    let estimatedValidationCostUsd = 0;
    if (isReal && config.validationProvider === 'gemini' && !isFreeApi) {
      estimatedValidationCostUsd = Number((totalImages * this.GEMINI_VALIDATION_COST_PER_IMAGE).toFixed(2));
    }

    const estimatedTotalCostUsd = Number((estimatedGenerationCostUsd + estimatedValidationCostUsd).toFixed(2));

    const quoteId = `quote-${randomUUID()}`;
    const calculatedAt = new Date().toISOString();

    const quote: GenerationCostQuote = {
      planKey: params.planKey,
      maxAttempts,
      maxEstimatedCostUsd: Number((maxAttempts * (estimatedCostPerImageUsd + (isReal && config.validationProvider === 'gemini' && !isFreeApi ? this.GEMINI_VALIDATION_COST_PER_IMAGE : 0))).toFixed(4)),
      quoteId,
      provider,
      model,
      qualityProfile,
      selectedVariantCount: params.selectedVariantCount,
      selectedShotCount: params.selectedShotCount,
      totalImages,
      estimatedCostPerImageUsd,
      estimatedGenerationCostUsd,
      estimatedValidationCostUsd: estimatedValidationCostUsd > 0 ? estimatedValidationCostUsd : 0,
      estimatedTotalCostUsd,
      currency: 'USD',
      isEstimate: true,
      calculatedAt,
    };

    // Store in active quotes cache
    this.quotesStore.set(quoteId, {
      quote,
      expiresAt: Date.now() + this.TTL_MS,
    });

    return quote;
  }

  /**
   * Retrieves an active quote by quoteId. Returns null if expired or missing.
   */
  static getQuote(quoteId: string): GenerationCostQuote | null {
    const entry = this.quotesStore.get(quoteId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.quotesStore.delete(quoteId);
      return null;
    }
    return entry.quote;
  }

  /**
   * Validates that the provided quoteId matches the expected total generation jobs count.
   */
  static validateQuoteMatch(quoteId: string, expectedJobsCount: number): {
    valid: boolean;
    quote?: GenerationCostQuote;
    error?: string;
  } {
    const quote = this.getQuote(quoteId);
    if (!quote) {
      return {
        valid: false,
        error: 'La cotización expiró o no es válida. Por favor calculá el costo nuevamente antes de confirmar.',
      };
    }

    if (quote.totalImages !== expectedJobsCount) {
      return {
        valid: false,
        quote,
        error: `La cantidad de imágenes cotizadas (${quote.totalImages}) no coincide con los trabajos a generar (${expectedJobsCount}).`,
      };
    }

    return { valid: true, quote };
  }
}
