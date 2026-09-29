import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

(process.env as any).NODE_ENV = 'test';
process.env.AI_MODE = 'mock';

import { VisualDetectionPipeline } from '../lib/vision';
import { SceneSanityChecker } from '../lib/vision/sanity-checker';
import { getImageStorage } from '../lib/storage/image-storage';
import { getAnalysisRunRepository } from '../lib/storage/analysis-run.repository';
import { VisualWizardAdapters } from '../features/wizard/models/wizard.types';
import { createSelectedProduction } from '../lib/production/selection';
import { SourceImage, GarmentInstance, GarmentCrop, ProductGroup } from '../types';

async function main() {
  console.log('🧪 Starting MULTI-GARMENT FLOW REDESIGN Test Suite...');

  // 1. Physical Garment Instance Detection (One bbox per physical garment)
  console.log('\n1. Testing: physical garment instance detection (one bbox per visible garment)...');
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'real-catalog-five-variants.png');
  const rawBytes = fs.readFileSync(fixturePath);
  const metadata = await sharp(rawBytes).metadata();

  const storageKey = 'uploads/test-multi-garment-redesign.png';
  await getImageStorage().put(storageKey, rawBytes, 'image/png');

  const sourceImage: SourceImage = {
    id: 'src-multi-redesign-1',
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

  const pipeline = new VisualDetectionPipeline();
  const pipelineResult = await pipeline.processSourceImages([sourceImage]);

  assert.ok(pipelineResult.instances, 'Pipeline result must include instances array');
  assert.equal(pipelineResult.instances.length, 5, 'Must detect exactly 5 physical garment instances');
  for (const instance of pipelineResult.instances) {
    assert.ok(instance.id, 'Instance must have id');
    assert.ok(instance.boundingBox, 'Instance must have boundingBox');
    assert.ok(instance.boundingBox.width > 0 && instance.boundingBox.height > 0);
  }
  console.log('   ✓ 5 physical instances detected with individual bounding boxes');

  // 2. Physical Crop Generation (sharp.extract without filters)
  console.log('\n2. Testing: physical crop generation...');
  assert.equal(pipelineResult.crops.length, 5, 'Must generate exactly 5 physical crops');
  for (const crop of pipelineResult.crops) {
    const bytes = await getImageStorage().get(crop.storageKey);
    assert.ok(bytes && bytes.length > 0, `Crop ${crop.id} must exist in storage`);
    assert.ok(crop.url.startsWith('/uploads/crop-'), 'Crop URL must point to crop file');
  }
  console.log('   ✓ 5 physical crops extracted and persisted to disk');

  // 3. Same Design Grouping
  console.log('\n3. Testing: same design grouping...');
  assert.equal(pipelineResult.productGroups.length, 1, 'All 5 garments share the same design -> 1 ProductGroup');
  const group = pipelineResult.productGroups[0];
  console.log(`   ✓ Grouped into single product group: ${group.name}`);

  // 4. Multi-color Variant Reconciliation
  console.log('\n4. Testing: multi-color variant reconciliation...');
  assert.equal(group.variants.length, 5, 'Must reconcile 5 distinct colorways');
  const expectedColors = ['Celeste', 'Crudo', 'Verde Agua', 'Negro', 'Beige'];
  for (const exp of expectedColors) {
    const found = group.variants.some(v => v.color.canonicalName.toLowerCase().includes(exp.toLowerCase()));
    assert.ok(found, `Variant with color ${exp} must be present`);
  }
  console.log('   ✓ 5 color variants cleanly reconciled without collapsing');

  // 5. Scene / Variant Sanity Check
  console.log('\n5. Testing: scene/variant sanity check...');
  const sanityCheck = pipelineResult.sanityCheck;
  assert.ok(sanityCheck, 'Pipeline must return sanity check evaluation');
  assert.equal(sanityCheck.passed, true, 'Sanity check must pass for consistent 5 instances -> 5 variants');
  assert.equal(sanityCheck.instanceCount, 5);
  assert.equal(sanityCheck.cropCount, 5);
  assert.equal(sanityCheck.variantCount, 5);
  assert.equal(sanityCheck.conflicts.length, 0);
  console.log('   ✓ Sanity check passed: 5 instances = 5 crops -> 1 product -> 5 variants');

  // 6. Conflict Handling (VARIANT_RECONCILIATION_CONFLICT)
  console.log('\n6. Testing: conflict handling (VARIANT_RECONCILIATION_CONFLICT)...');
  const fakeInstances: GarmentInstance[] = [
    { id: 'inst-1', sourceImageId: 'src-1', boundingBox: { x: 0, y: 0, width: 0.2, height: 0.8 }, confidence: 0.9 },
    { id: 'inst-2', sourceImageId: 'src-1', boundingBox: { x: 0.3, y: 0, width: 0.2, height: 0.8 }, confidence: 0.9 },
    { id: 'inst-3', sourceImageId: 'src-1', boundingBox: { x: 0.6, y: 0, width: 0.2, height: 0.8 }, confidence: 0.9 },
  ];
  const fakeCrops: GarmentCrop[] = fakeInstances.map((inst, i) => ({
    id: `crop-${i}`, sourceImageId: 'src-1', detectionId: inst.id, storageKey: `crop-${i}.png`, url: `/uploads/crop-${i}.png`,
    width: 200, height: 400, sha256: `sha-${i}`, boundingBox: inst.boundingBox,
  }));
  // Simulating the bug where 3 physical garments were collapsed into 1 single variant
  const buggedGroups: ProductGroup[] = [
    {
      id: 'grp-bugged', name: 'Mono', category: 'Mono', confidence: 0.9,
      visualSignature: { category: 'Mono', silhouette: 'Caja', neckline: 'V', sleeveType: 'Corta', length: 'Midi', hasPockets: false, patternType: 'Liso', distinctiveDetails: [] },
      references: [],
      variants: [
        { id: 'var-only-one', productGroupId: 'grp-bugged', color: { canonicalName: 'Negro', observedName: 'Negro', hex: '#000000', confidence: 0.9 }, referenceCrops: ['/uploads/crop-0.png'], sourceImageIds: ['src-1'] }
      ]
    }
  ];
  const conflictResult = SceneSanityChecker.evaluate({
    instances: fakeInstances,
    crops: fakeCrops,
    productGroups: buggedGroups,
  });
  assert.equal(conflictResult.passed, false, 'Conflict evaluation must fail');
  assert.ok(conflictResult.conflicts.some(c => c.code === 'VARIANT_RECONCILIATION_CONFLICT'), 'Must flag VARIANT_RECONCILIATION_CONFLICT');
  console.log('   ✓ VARIANT_RECONCILIATION_CONFLICT successfully intercepted: 3 instances -> 1 variant flagged');

  // 7. Wizard Multi-Variant Rendering & Ordering
  console.log('\n7. Testing: wizard multi-variant rendering...');
  const choices = VisualWizardAdapters.toProductChoices(pipelineResult);
  assert.equal(choices.length, 1);
  const p = choices[0];
  assert.equal(p.colors.length, 5, 'Wizard must present 5 color options');
  for (const c of p.colors) {
    assert.ok(c.cropUrl.startsWith('/uploads/crop-'), 'Color card must have cropUrl');
  }
  console.log('   ✓ Wizard presented 5 colors, each with individual cropUrl');

  // 8. Human Confirmation: User corrects commercial garment name
  console.log('\n8. Testing: human confirmation of commercial identity...');
  const selectedVariantIds = [p.colors[0].id, p.colors[1].id, p.colors[2].id]; // 3 selected
  const selection = {
    analysisRunId: pipelineResult.analysisRunId!,
    products: [
      {
        productGroupId: p.id,
        identity: {
          productGroupId: p.id,
          aiSuggestedName: p.title,
          aiSuggestedCategory: p.category,
          confirmedName: 'Remera de morley estampada',
          confirmedCategory: 'Remera',
          source: 'USER_CORRECTED' as const,
          confirmedAt: new Date().toISOString(),
        },
        selectedVariantIds,
        customColorNames: {},
      },
    ],
    shots: ['FRONT', 'SIDE', 'BACK', 'ACTION'] as ('FRONT' | 'SIDE' | 'BACK' | 'ACTION')[],
    destination: 'INSTAGRAM' as const,
    style: 'LIFESTYLE' as const,
    modelId: 'model-female-sofia' as const,
    expectedJobs: 12,
  };
  const run = (await getAnalysisRunRepository().getById(pipelineResult.analysisRunId!))!;
  const project = createSelectedProduction(run, selection);
  assert.equal(project.garment.name, 'Remera de morley estampada');
  console.log('   ✓ Human confirmed identity "Remera de morley estampada" retained');

  // 9. Exact Generation Job Count Invariant: 3 colors x 4 shots = exactly 12 jobs
  console.log('\n9. Testing: exact generation job count (3 colors x 4 shots = 12 jobs)...');
  assert.equal(project.jobs.length, 12, 'Must create exactly 12 generation jobs');
  assert.equal(project.garment.colorVariants.length, 3);
  console.log('   ✓ Exactly 12 jobs created (Ni 4, ni 16, ni 48)');

  console.log('\n🎉 ALL MULTI-GARMENT FLOW REDESIGN TESTS PASSED!\n');
}

main().catch(err => {
  console.error('❌ MULTI-GARMENT FLOW REDESIGN FAILED:', err);
  process.exit(1);
});
