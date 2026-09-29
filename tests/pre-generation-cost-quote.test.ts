import assert from 'node:assert';
import { GenerationPricingService } from '@/lib/pricing/pricing-service';
import { createSelectedProduction } from '@/lib/production/selection';
import { AnalysisRun } from '@/types';

async function runCostQuoteTests() {
  console.log('🧪 Starting Pre-Generation Cost Quote & Pricing Service Test Suite...\n');

  // Test 1: Exact calculation (selected variants × selected shots = total images, total × cost = total cost)
  console.log('1. Testing exact image count and cost calculation (5 variants × 4 shots = 20 images)...');
  const quote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'standard',
    provider: 'fal',
    model: 'fal-ai/flux-pro/v1.1',
  });

  assert.strictEqual(quote.totalImages, 20);
  assert.strictEqual(quote.selectedVariantCount, 5);
  assert.strictEqual(quote.selectedShotCount, 4);
  assert.strictEqual(quote.estimatedCostPerImageUsd, 0.04);
  assert.strictEqual(quote.estimatedGenerationCostUsd, 0.80);
  assert.strictEqual(quote.currency, 'USD');
  assert.ok(quote.quoteId && quote.quoteId.startsWith('quote-'));
  assert.strictEqual(quote.isEstimate, true);
  console.log('   ✓ Exact calculation verified: 5 × 4 = 20 images at $0.04 = $0.80\n');

  // Test 2: Real-time recalculation when selection changes (e.g. 3 variants instead of 5)
  console.log('2. Testing recalculation with 3 variants (3 × 4 = 12 images)...');
  const quote12 = GenerationPricingService.createQuote({
    selectedVariantCount: 3,
    selectedShotCount: 4,
    qualityProfile: 'standard',
    provider: 'fal',
  });

  assert.strictEqual(quote12.totalImages, 12);
  assert.strictEqual(quote12.estimatedGenerationCostUsd, 0.48);
  console.log('   ✓ 3 variants × 4 shots = 12 images ($0.48), no stale 20-image quote.\n');

  // Test 3: Quality profile tiers (draft vs standard vs final)
  console.log('3. Testing quality profile pricing tiers (draft, standard, final)...');
  const draftQuote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'draft',
    provider: 'fal',
  });
  const standardQuote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'standard',
    provider: 'fal',
  });
  const finalQuote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'final',
    provider: 'fal',
  });

  assert.strictEqual(draftQuote.estimatedCostPerImageUsd, 0.02);
  assert.strictEqual(draftQuote.estimatedGenerationCostUsd, 0.40);

  assert.strictEqual(standardQuote.estimatedCostPerImageUsd, 0.04);
  assert.strictEqual(standardQuote.estimatedGenerationCostUsd, 0.80);

  assert.strictEqual(finalQuote.estimatedCostPerImageUsd, 0.08);
  assert.strictEqual(finalQuote.estimatedGenerationCostUsd, 1.60);
  console.log('   ✓ Quality tiers verified: draft ($0.02), standard ($0.04), final ($0.08).\n');

  // Test 4: Local and Mock providers
  console.log('4. Testing local and mock provider API cost (USD 0.00)...');
  const localQuote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'standard',
    provider: 'local',
  });
  assert.strictEqual(localQuote.estimatedCostPerImageUsd, 0);
  assert.strictEqual(localQuote.estimatedGenerationCostUsd, 0);
  assert.strictEqual(localQuote.estimatedTotalCostUsd, 0);

  const mockQuote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'standard',
    provider: 'mock',
  });
  assert.strictEqual(mockQuote.estimatedCostPerImageUsd, 0);
  assert.strictEqual(mockQuote.estimatedGenerationCostUsd, 0);
  console.log('   ✓ Local and mock providers correctly quote USD 0.00 API cost.\n');

  // Test 5: Quote match validation & mismatch rejection
  console.log('5. Testing quote match validation (quoteId + job count)...');
  const testQuote = GenerationPricingService.createQuote({
    selectedVariantCount: 5,
    selectedShotCount: 4,
    qualityProfile: 'standard',
    provider: 'fal',
  });

  // Exact match
  const matchOk = GenerationPricingService.validateQuoteMatch(testQuote.quoteId, 20);
  assert.strictEqual(matchOk.valid, true);

  // Mismatch
  const matchMismatch = GenerationPricingService.validateQuoteMatch(testQuote.quoteId, 12);
  assert.strictEqual(matchMismatch.valid, false);
  assert.ok(matchMismatch.error?.includes('no coincide'));

  // Missing
  const matchMissing = GenerationPricingService.validateQuoteMatch('quote-non-existent', 20);
  assert.strictEqual(matchMissing.valid, false);
  assert.ok(matchMissing.error?.includes('expiró o no es válida'));
  console.log('   ✓ Exact job match enforced: rejects tampering or count mismatch.\n');

  // Test 6: createSelectedProduction integration with pricingSnapshot and actualCost
  console.log('6. Testing production creation integration with price snapshot...');
  const run: AnalysisRun = {
    analysisRunId: 'ar_test_pricing',
    createdAt: new Date().toISOString(),
    mode: 'MOCK',
    provider: 'Mock',
    model: 'mock-model',
    sourceImageIds: ['src_1'],
    fallbackUsed: false,
    status: 'COMPLETED',
    sourceImages: [
      {
        id: 'src_1',
        mimeType: 'image/png',
        byteSize: 1000,
        width: 500,
        height: 500,
        createdAt: new Date().toISOString(),
        originalFilename: 'test.png',
        role: 'UNKNOWN',
        sha256: 'abc',
        source: 'USER_UPLOAD',
        storageKey: 'test.png',
        url: '/uploads/test.png',
      },
    ],
    analyses: [],
    detections: [],
    crops: [
      {
        id: 'crop_v1',
        analysisRunId: 'ar_test_pricing',
        boundingBox: { x: 0, y: 0, width: 0.5, height: 0.5 },
        detectionId: 'det_1',
        height: 100,
        width: 100,
        sha256: 'crop1',
        sourceImageId: 'src_1',
        storageKey: 'crop1.png',
        url: '/uploads/crop1.png',
      },
      {
        id: 'crop_v2',
        analysisRunId: 'ar_test_pricing',
        boundingBox: { x: 0.5, y: 0, width: 0.5, height: 0.5 },
        detectionId: 'det_2',
        height: 100,
        width: 100,
        sha256: 'crop2',
        sourceImageId: 'src_1',
        storageKey: 'crop2.png',
        url: '/uploads/crop2.png',
      },
    ],
    observedVariants: [],
    productGroups: [
      {
        id: 'pg_1',
        analysisRunId: 'ar_test_pricing',
        name: 'Vestido Ibiza',
        category: 'Vestido',
        confidence: 0.95,
        visualSignature: {
          category: 'Vestido',
          distinctiveDetails: ['volados'],
          hasPockets: false,
          patternType: 'Liso',
          silhouette: 'A-Line',
          neckline: 'V',
          sleeveType: 'None',
          length: 'Midi',
        },
        references: [],
        variants: [
          {
            id: 'var_1',
            analysisRunId: 'ar_test_pricing',
            productGroupId: 'pg_1',
            color: { canonicalName: 'Rojo', hex: '#FF0000', observedName: 'Rojo', confidence: 0.98 },
            referenceCrops: ['/uploads/crop1.png'],
            sourceImageIds: ['src_1'],
          },
          {
            id: 'var_2',
            analysisRunId: 'ar_test_pricing',
            productGroupId: 'pg_1',
            color: { canonicalName: 'Negro', hex: '#000000', observedName: 'Negro', confidence: 0.98 },
            referenceCrops: ['/uploads/crop2.png'],
            sourceImageIds: ['src_1'],
          },
        ],
      },
    ],
    executionMetrics: {
      totalDurationMs: 100,
      cropsCount: 2,
      detectionCount: 2,
      finalVariantsCount: 2,
      observedVariantsCount: 2,
      productGroupsCount: 1,
    },
  };

  const quoteProd = GenerationPricingService.createQuote({
    selectedVariantCount: 2,
    selectedShotCount: 2,
    qualityProfile: 'standard',
    provider: 'fal',
  });

  const project = createSelectedProduction(run, {
    analysisRunId: 'ar_test_pricing',
    quoteId: quoteProd.quoteId,
    qualityProfile: 'standard',
    expectedJobs: 4,
    shots: ['FRONT', 'BACK'],
    destination: 'MERCADO_LIBRE',
    style: 'FONDO_BLANCO',
    modelId: 'model-female-sofia',
    products: [
      {
        productGroupId: 'pg_1',
        identity: {
          productGroupId: 'pg_1',
          aiSuggestedName: 'Vestido',
          aiSuggestedCategory: 'Vestido',
          confirmedName: 'Vestido Confirmado',
          confirmedCategory: 'Vestido',
          source: 'AI_CONFIRMED',
          confirmedAt: new Date().toISOString(),
        },
        selectedVariantIds: ['var_1', 'var_2'],
        customColorNames: {},
      },
    ],
  });

  // Verify: quote.totalImages === selectedVariants × selectedShots === GenerationJobs.length
  assert.strictEqual(quoteProd.totalImages, 4);
  assert.strictEqual(project.jobs.length, 4);
  assert.ok(project.pricingSnapshot);
  assert.strictEqual(project.pricingSnapshot?.quoteId, quoteProd.quoteId);
  assert.strictEqual(project.pricingSnapshot?.imageCount, 4);
  assert.strictEqual(project.pricingSnapshot?.estimatedTotalCostUsd, quoteProd.estimatedTotalCostUsd);

  assert.ok(project.actualCost);
  assert.strictEqual(project.actualCost?.estimatedUsd, quoteProd.estimatedTotalCostUsd);
  assert.strictEqual(project.actualCost?.actualUsd, null);
  assert.strictEqual(project.actualCost?.generatedImages, 0);
  assert.strictEqual(project.actualCost?.failedImages, 0);
  console.log('   ✓ Production project successfully stores pricingSnapshot and actualCost structure.\n');

  // Test 7: POST /api/generation/quote route validation and response
  console.log('7. Testing POST /api/generation/quote route handler directly...');
  const { POST: quoteHandler } = await import('@/app/api/generation/quote/route');
  const { getAnalysisRunRepository } = await import('@/lib/storage/analysis-run.repository');

  // Save the run so the route can fetch it by ID
  await getAnalysisRunRepository().save(run);

  // 7a: Invalid payload rejection with 400
  const invalidReq = new Request('http://localhost/api/generation/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variantIds: ['v1'], shots: ['FRONT'] }), // Old/invalid payload without selection
  });
  const invalidRes = await quoteHandler(invalidReq);
  assert.strictEqual(invalidRes.status, 400, 'Route must reject invalid payload with 400');
  const invalidJson = await invalidRes.json();
  assert.strictEqual(invalidJson.success, false);
  assert.ok(invalidJson.error.includes('Parámetros inválidos'));

  // 7b: Valid selection payload accepted with 200 and full metrics
  const validReq = new Request('http://localhost/api/generation/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      selection: {
        analysisRunId: 'ar_test_pricing',
        products: [
          {
            productGroupId: 'pg_1',
            identity: {
              productGroupId: 'pg_1',
              aiSuggestedName: 'Vestido',
              aiSuggestedCategory: 'Vestido',
              confirmedName: 'Vestido Confirmado',
              confirmedCategory: 'Vestido',
              source: 'AI_CONFIRMED',
              confirmedAt: new Date().toISOString(),
            },
            selectedVariantIds: ['var_1', 'var_2'],
            customColorNames: {},
          },
        ],
        shots: ['FRONT', 'BACK'],
        destination: 'MERCADO_LIBRE',
        style: 'FONDO_BLANCO',
        modelId: 'model-female-sofia',
        qualityProfile: 'standard',
        expectedJobs: 4,
      },
    }),
  });
  const validRes = await quoteHandler(validReq);
  assert.strictEqual(validRes.status, 200, 'Route must succeed with 200 for valid selection payload');
  const validJson = await validRes.json();
  assert.strictEqual(validJson.success, true);
  assert.strictEqual(validJson.quantity, 4);
  assert.strictEqual(validJson.qualityProfile, 'standard');
  assert.ok(validJson.maxCostWithRetries !== undefined);
  assert.ok(validJson.plan);
  assert.ok(validJson.planKey);

  // 7c: Direct flat selection (without nesting under { selection }) and defaulted qualityProfile
  const flatReq = new Request('http://localhost/api/generation/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysisRunId: 'ar_test_pricing',
      products: [
        {
          productGroupId: 'pg_1',
          identity: {
            productGroupId: 'pg_1',
            aiSuggestedName: 'Vestido',
            aiSuggestedCategory: 'Vestido',
            confirmedName: 'Vestido Confirmado',
            confirmedCategory: 'Vestido',
            source: 'AI_CONFIRMED',
            confirmedAt: new Date().toISOString(),
          },
          selectedVariantIds: ['var_1'],
        },
      ],
      shots: ['FRONT'],
    }),
  });
  const flatRes = await quoteHandler(flatReq);
  assert.strictEqual(flatRes.status, 200, 'Route must succeed for flat payload with defaulted options');
  const flatJson = await flatRes.json();
  assert.strictEqual(flatJson.success, true);
  assert.strictEqual(flatJson.quantity, 1);
  assert.strictEqual(flatJson.qualityProfile, 'standard', 'Omitted qualityProfile must default to standard');
  console.log('   ✓ POST /api/generation/quote route verified: rejects bad payload (400), accepts valid selection (200) with defaults.\n');

  console.log('🎉 ALL PRE-GENERATION COST QUOTE TESTS PASSED SUCCESSFULLY!\n');
}

runCostQuoteTests().catch((err) => {
  console.error('❌ Cost Quote Test Failed:', err);
  process.exit(1);
});
