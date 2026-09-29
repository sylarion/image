import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { VisualDetectionPipeline } from '../lib/vision';
import { getImageStorage } from '../lib/storage/image-storage';
import { getAnalysisRunRepository } from '../lib/storage/analysis-run.repository';
import { VisualWizardAdapters } from '../features/wizard/models/wizard.types';
import { createSelectedProduction } from '../lib/production/selection';
import { SourceImage } from '../types';

async function main() {
  const isReal = process.env.AI_MODE === 'real';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasFalKey = Boolean(process.env.FAL_KEY?.trim());
  if (!isReal || !hasGeminiKey || !hasFalKey) {
    console.log('REAL CATALOG ACCEPTANCE TEST: BLOCKED');
    console.log(`AI_MODE=real: ${isReal ? 'yes' : 'no'}; GEMINI_API_KEY configured: ${hasGeminiKey ? 'yes' : 'no'}; FAL_KEY configured: ${hasFalKey ? 'yes' : 'no'}`);
    console.log('Configure both providers locally, then re-run this command. Mock tests do not constitute real-provider acceptance.');
    process.exitCode = 2;
    return;
  }
  console.log('REAL CATALOG ACCEPTANCE TEST (Execution: LIVE GEMINI + FAL)...');

  // 1. Ingest genuine bytes from official acceptance fixture
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'real-catalog-five-variants.png');
  assert.ok(fs.existsSync(fixturePath), 'Fixture real-catalog-five-variants.png must exist');

  const rawBytes = fs.readFileSync(fixturePath);
  assert.ok(rawBytes.length > 300000, `Expected real image bytes (>300KB), got ${rawBytes.length}`);

  const metadata = await sharp(rawBytes).metadata();
  assert.ok(metadata.width && metadata.width > 0, 'Image must have valid width');
  assert.ok(metadata.height && metadata.height > 0, 'Image must have valid height');

  const storageKey = 'uploads/real-catalog-five-variants.png';
  await getImageStorage().put(storageKey, rawBytes, 'image/png');

  const sourceImage: SourceImage = {
    id: 'src-6a23a8ec8827706d',
    storageKey,
    originalFilename: 'real-catalog-five-variants.png',
    mimeType: 'image/png',
    byteSize: rawBytes.length,
    sha256: '6a23a8ec8827706dbe45cd46055df63a52df94005b39b8bd0180ba11e74933d0',
    width: metadata.width || 1280,
    height: metadata.height || 720,
    url: `/uploads/${storageKey}`,
    role: 'UNKNOWN',
    source: 'USER_UPLOAD',
    createdAt: new Date().toISOString(),
  };

  console.log(`\n1. Ingested source image: ${sourceImage.originalFilename} (${sourceImage.width}x${sourceImage.height}, ${sourceImage.byteSize} bytes, SHA-256: ${sourceImage.sha256.slice(0, 16)}...)`);

  // 2. Run through VisualDetectionPipeline
  console.log('\n2. Executing VisualDetectionPipeline (scene analysis, physical crops, color LAB, grouping)...');
  const pipeline = new VisualDetectionPipeline();
  const pipelineResult = await pipeline.processSourceImages([sourceImage]);

  assert.ok(pipelineResult.analysisRunId, 'Pipeline must return an analysisRunId');
  const runId = pipelineResult.analysisRunId;

  const run = await getAnalysisRunRepository().getById(runId);
  assert.ok(run, 'AnalysisRun must be persisted in repository');
  assert.equal(run.status, 'COMPLETED');
  assert.equal(run.mode, isReal ? 'REAL' : 'MOCK');
  assert.equal(run.fallbackUsed, false, 'Fallback must NOT be used');

  // 3. Validate Physical Detections
  console.log(`\n3. Validating Physical Detections: ${run.detections.length} garments detected...`);
  assert.ok(run.detections.length >= 5, 'Must detect the five visible tops; the visible trousers may be a separate product');

  // 4. Validate Physical Crops
  console.log(`\n4. Validating Physical Crops: ${run.crops.length} crops generated...`);
  assert.equal(run.crops.length, run.detections.length, 'Each detection must have a crop');
  for (const crop of run.crops) {
    const cropBytes = await getImageStorage().get(crop.storageKey);
    assert.ok(cropBytes && cropBytes.length > 0, `Crop ${crop.id} must exist in storage and have bytes`);
    assert.ok(crop.url.startsWith('/uploads/crop-'), `Crop url ${crop.url} must point to crops directory`);
    assert.ok(crop.width > 0 && crop.height > 0, 'Crop dimensions must be positive');
  }

  // 5. Validate ObservedVariants layer
  console.log(`\n5. Validating ObservedVariants layer: ${run.observedVariants.length} observations...`);
  assert.equal(run.observedVariants.length, run.detections.length, 'Every detection must retain its observation');
  for (const obs of run.observedVariants) {
    assert.equal(obs.analysisRunId, runId);
    assert.ok(obs.cropId, 'ObservedVariant must reference a cropId');
    assert.ok(obs.cropUrl && obs.cropUrl.includes('/uploads/crop-'), 'ObservedVariant must have valid cropUrl');
    assert.ok(obs.rawColorHex?.startsWith('#') || obs.observedColor?.rawHex?.startsWith('#'), 'ObservedVariant must have valid rawColorHex');
    assert.equal((obs.colorLab || obs.observedColor?.lab)?.length, 3, 'ObservedVariant must have [L, a, b] coordinates');
    assert.ok((obs.semanticColorName || obs.observedColor?.semanticName)?.length, 'ObservedVariant must have semanticColorName');
  }

  // 6. Validate Grouping into 1 ProductGroup and 5 GarmentVariants
  console.log(`\n6. Validating Product Grouping: ${run.productGroups.length} product groups, ${run.executionMetrics.finalVariantsCount} variants...`);
  const group = run.productGroups.find(g=>g.variants.length === 5);
  assert.ok(group, 'Five tops of the same design must retain five variants in one group');
  assert.equal(group.variants.length, 5, 'ProductGroup must have exactly 5 variants');

  // Verify that all 5 variants have reference crops pointing to physical crops (NOT original image)
  for (const variant of group.variants) {
    assert.ok(variant.referenceCrops.length > 0, `Variant ${variant.id} must have reference crops`);
    for (const cropUrl of variant.referenceCrops) {
      assert.ok(cropUrl.startsWith('/uploads/crop-'), `Variant referenceCrop ${cropUrl} must be a physical crop URL`);
    }
  }

  // 7. Validate Wizard Adapter
  console.log('\n7. Validating VisualWizardAdapters.toProductChoices...');
  const productChoices = VisualWizardAdapters.toProductChoices({
    analyses: run.analyses,
    crops: run.crops,
    productGroups: run.productGroups,
    observability: pipelineResult.observability,
  });

  const wizardProduct = productChoices.find(p=>p.id===group.id)!;
  assert.equal(wizardProduct.colors.length, 5, 'Wizard must present 5 color options');
  console.log(`   Wizard colors presented: ${wizardProduct.colors.map(c => `${c.name} (${c.hex})`).join(', ')}`);

  // Verify each color card has a cropUrl
  for (const col of wizardProduct.colors) {
    assert.ok(col.cropUrl, `Wizard color ${col.name} must have a dedicated cropUrl`);
    assert.ok(col.cropUrl.startsWith('/uploads/crop-'), `Wizard color ${col.name} cropUrl must point to physical crop`);
  }

  // 8. User Interaction: User corrects name to 'Remera de morley estampada' and selects 3 variants
  console.log('\n8. Simulating User Interaction (Name correction + 3 variants selected)...');
  const selectedColors = wizardProduct.colors.filter(c => 
    c.name.toLowerCase().includes('negro') ||
    c.name.toLowerCase().includes('verde') ||
    c.name.toLowerCase().includes('beige')
  );
  assert.equal(selectedColors.length, 3, 'Must match 3 selected colors: Negro, Verde Agua, Beige');

  const selection = {
    analysisRunId: runId,
    products: [
      {
        productGroupId: wizardProduct.id,
        identity: {
          productGroupId: wizardProduct.id,
          aiSuggestedName: wizardProduct.confirmedIdentity?.aiSuggestedName || 'Remera',
          aiSuggestedCategory: wizardProduct.confirmedIdentity?.aiSuggestedCategory || 'Remera',
          confirmedName: 'Remera de morley estampada',
          confirmedCategory: 'Remera',
          source: 'USER_CORRECTED' as const,
          confirmedAt: new Date().toISOString(),
        },
        selectedVariantIds: selectedColors.map(c => c.id),
        customColorNames: {},
      },
    ],
    shots: ['FRONT', 'SIDE', 'BACK', 'ACTION'] as ('FRONT' | 'SIDE' | 'BACK' | 'ACTION')[],
    destination: 'INSTAGRAM' as const,
    style: 'LIFESTYLE' as const,
    modelId: 'model-female-sofia' as const,
    expectedJobs: 12,
  };

  // 9. Validate Backend Project & Generation Jobs Creation
  console.log('\n9. Creating Selected Production Project and verifying Generation Jobs...');
  const project = createSelectedProduction(run, selection);

  assert.equal(project.garment.name, 'Remera de morley estampada', 'Garment name must match user correction');
  assert.equal(project.garment.colorVariants.length, 3, 'Project must contain exactly 3 color variants');
  assert.equal(project.jobs.length, 12, 'Project must contain EXACTLY 12 generation jobs (3 colors x 4 shots)');

  // Ensure each job references the right colorway and shot
  const jobLabels = project.jobs.map(j => j.label);
  for (const col of selectedColors) {
    for (const shot of ['FRONT', 'SIDE', 'BACK', 'ACTION']) {
      const found = jobLabels.some(l => l.includes(col.name) && l.includes(shot));
      assert.ok(found, `Expected job for ${col.name} - ${shot}`);
    }
  }

  // Ensure unselected colors (Celeste, Crudo) generated zero jobs
  const unselectedColor = wizardProduct.colors.find(c => c.name.toLowerCase().includes('celeste'));
  if (unselectedColor) {
    const hasUnselected = project.jobs.some(j => j.colorVariantId === unselectedColor.id);
    assert.equal(hasUnselected, false, 'Unselected color (Celeste) must generate ZERO jobs');
  }

  console.log('\n======================================================');
  console.log('REAL RUNTIME VALIDATION SUMMARY:');
  console.log(`AI mode: ${run.mode}`);
  console.log(`Visual provider: ${run.provider}`);
  console.log(`Fallback used: ${run.fallbackUsed ? 'YES' : 'NO'}`);
  console.log(`Input garments visible: 5`);
  console.log(`Detected garments: ${run.detections.length}`);
  console.log(`Physical crops: ${run.crops.length}`);
  console.log(`Observed variants: ${run.observedVariants.length}`);
  console.log(`Final variants: ${group.variants.length}`);
  console.log(`Wizard color cards: ${wizardProduct.colors.length}`);
  console.log(`User selected variants: ${selectedColors.length}`);
  console.log(`Requested shots: ${selection.shots.length}`);
  console.log(`Expected jobs: 12`);
  console.log(`Actual jobs: ${project.jobs.length}`);
  console.log('REAL PROVIDER ANALYSIS CONTRACT: PASS');
  console.log('REAL BROWSER E2E: NOT RUN');
  console.log('READY FOR REAL GENERATION: NO (manual browser acceptance pending)');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('❌ REAL CATALOG RUNTIME VALIDATION FAILED:', err);
  process.exit(1);
});
