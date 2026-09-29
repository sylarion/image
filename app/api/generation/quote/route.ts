import { NextResponse } from 'next/server';
import { ProductionSelectionSchema, prepareGenerationPlan } from '@/lib/production/selection';
import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { GenerationPricingService } from '@/lib/pricing/pricing-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawSelection = body?.selection ?? body;
    const parsed = ProductionSelectionSchema.safeParse(rawSelection);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos para cotización', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const run = await getAnalysisRunRepository().getById(parsed.data.analysisRunId);
    if (!run) return NextResponse.json({success:false,error:'INVALID_ANALYSIS'}, {status:400});
    const { plan, planKey } = prepareGenerationPlan(run, parsed.data);
    const quote = GenerationPricingService.createQuote({
      selectedVariantCount: plan.products.length, selectedShotCount: plan.shots.length,
      qualityProfile: parsed.data.qualityProfile, aspectRatio: plan.aspectRatio,
      resolution: plan.resolution, planKey,
    });

    return NextResponse.json({
      success: true,
      plan,
      planKey,
      // Core Quote metrics
      costPerImage: quote.estimatedCostPerImageUsd,
      quantity: quote.totalImages,
      estimatedCost: quote.estimatedTotalCostUsd,
      maxCostWithRetries: quote.maxEstimatedCostUsd,
      maxAttempts: quote.maxAttempts,
      maxEstimatedCostUsd: quote.maxEstimatedCostUsd,
      quoteId: quote.quoteId,
      totalImages: quote.totalImages,
      selectedVariantCount: quote.selectedVariantCount,
      selectedShotCount: quote.selectedShotCount,
      estimatedCostPerImageUsd: quote.estimatedCostPerImageUsd,
      estimatedGenerationCostUsd: quote.estimatedGenerationCostUsd,
      estimatedValidationCostUsd: quote.estimatedValidationCostUsd,
      estimatedTotalCostUsd: quote.estimatedTotalCostUsd,
      currency: quote.currency,
      isEstimate: quote.isEstimate,
      calculatedAt: quote.calculatedAt,
      qualityProfile: quote.qualityProfile,
      provider: quote.provider,
      model: quote.model,
      // Also provide the rates for all quality tiers so UI can render the quality selector with prices
      qualityTierRates: GenerationPricingService.getQualityTierRates(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PRICING_CONFIGURATION_REQUIRED:')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 503 });
    }
    if (error instanceof Error && /^(PREFLIGHT_|INVALID_|COST_GUARD|JOB_COUNT_MISMATCH)/.test(error.message)) return NextResponse.json({success:false,error:error.message}, {status:422});
    console.error('Error generating pre-generation cost quote:', error);
    return NextResponse.json(
      { success: false, error: 'No pudimos calcular el costo de esta producción. Intentá nuevamente.' },
      { status: 500 }
    );
  }
}
