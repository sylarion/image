import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { getAiConfig, getRuntimeAIStatus } from '@/lib/ai/config';
import { getImageGenerationProvider } from '@/lib/ai';
import { FalImageGenerator } from '@/lib/ai/fal-generator';
import { GeminiImageValidator } from '@/lib/ai/gemini-validator';
import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { GenerationJobRunner } from '@/lib/ai/job-runner';
import { Project, GenerationJob, GarmentLock } from '@/types';

async function runLiveSmokeValidation() {
  console.log('==================================================');
  console.log('REAL PROVIDER SMOKE VALIDATION RUNNER');
  console.log('==================================================\n');

  const config = getAiConfig();
  const hasGeminiKey = Boolean(config.geminiApiKey?.trim());
  const hasFalKey = Boolean(config.falKey?.trim());

  console.log(`AI_MODE: ${config.aiMode}`);
  console.log(`ANALYSIS_PROVIDER: ${config.analysisProvider}`);
  console.log(`GENERATION_PROVIDER: ${config.generationProvider}`);
  console.log(`GENERATION_MODEL: ${config.generationModel}`);
  console.log(`VALIDATION_PROVIDER: ${config.validationProvider}`);
  console.log(`GEMINI KEY CONFIGURED: ${hasGeminiKey ? 'true' : 'false'}`);
  console.log(`FAL KEY CONFIGURED: ${hasFalKey ? 'true' : 'false'}\n`);

  if (!hasFalKey || !hasGeminiKey) {
    console.error('❌ Keys not fully configured. Aborting real smoke test.');
    process.exit(1);
  }

  // 1. Retrieve real crop from latest analysis run
  const runRepo = getAnalysisRunRepository();
  const latestRun = await runRepo.getLatest();
  assert.ok(latestRun, 'Expected an existing AnalysisRun from detection pipeline');

  const group = latestRun.productGroups[0];
  assert.ok(group, 'Expected a ProductGroup in latest analysis run');
  const variant = group.variants[0];
  assert.ok(variant, 'Expected a variant in product group');
  assert.ok(variant.referenceCrops.length > 0, 'Expected reference crops in variant');

  const cropUrl = variant.referenceCrops[0];
  console.log(`Target Garment: ${group.category} (${variant.color.observedName})`);
  console.log(`Crop URL: ${cropUrl}`);

  // 2. Test Fal.ai direct upload to fal.storage and input payload contract
  console.log('\n2. Testing Fal.ai Storage & Payload Contract...');
  const falGenerator = new FalImageGenerator(config.falKey!, config.generationModel);
  const { resolveImageBytes } = await import('@/lib/storage/image-storage');
  const resolvedCrop = await resolveImageBytes(cropUrl);
  assert.ok(resolvedCrop, 'Resolved crop binary must exist');
  console.log(`Crop resolved: ${resolvedCrop.mimeType} (${resolvedCrop.buffer.length} bytes)`);

  let falCdnUrl: string | undefined;
  let inputType: 'PUBLIC_HTTPS' | 'DATA_URI' = 'DATA_URI';

  try {
    falCdnUrl = await falGenerator.uploadToFalStorage(resolvedCrop.buffer, resolvedCrop.mimeType, 'smoke-crop.png');
    console.log(`✓ fal.storage upload succeeded: ${falCdnUrl}`);
    inputType = 'PUBLIC_HTTPS';
  } catch (storageErr) {
    console.warn(`! fal.storage upload failed or unsupported (${storageErr instanceof Error ? storageErr.message : storageErr}). Falling back to Data URI.`);
    falCdnUrl = `data:${resolvedCrop.mimeType};base64,${resolvedCrop.buffer.toString('base64')}`;
    inputType = 'DATA_URI';
  }

  // 3. Smoke Test: 1 variant x 1 FRONT
  console.log('\n3. Executing Smoke Test: 1 variant x 1 FRONT shot...');
  const now = new Date().toISOString();
  const smokeProjectId = `proj-real-smoke-${Date.now()}`;

  const smokeGarment: GarmentLock = {
    id: group.id,
    name: group.name,
    category: 'Remera',
    material: 'Algodón morley',
    pattern: group.visualSignature.patternType,
    details: group.visualSignature.distinctiveDetails,
    pockets: false,
    sizes: ['M'],
    mustPreserve: ['silueta', 'estampa'],
    colorVariants: [
      {
        id: variant.id,
        name: variant.color.observedName,
        detectedColor: variant.color.observedName,
        colorDescription: variant.color.observedName,
        approximateHex: variant.color.hex,
        referenceCrop: cropUrl,
        referenceAssets: [
          {
            id: `ref-smoke-${Date.now()}`,
            type: 'REFERENCE',
            source: 'UPLOAD',
            url: cropUrl,
            order: 0,
            createdAt: now,
          },
        ],
        selected: true,
        order: 0,
      },
    ],
    referenceImages: [
      {
        id: `ref-smoke-${Date.now()}`,
        type: 'REFERENCE',
        source: 'UPLOAD',
        url: cropUrl,
        order: 0,
        createdAt: now,
      },
    ],
  };

  const smokeJob: GenerationJob = {
    id: `job-smoke-real-${Date.now()}`,
    projectId: smokeProjectId,
    colorVariantId: variant.id,
    colorName: variant.color.observedName,
    productionStyle: 'STUDIO_WHITE',
    shotView: 'FRONT',
    label: `${variant.color.observedName} — Frente`,
    status: 'QUEUED',
    progress: 0,
    attempts: 0,
    createdAt: now,
  };

  const smokeProject: Project = {
    id: smokeProjectId,
    name: 'Real Smoke Test Production',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: {
      modelId: 'model-female-sofia',
      name: 'Sofía',
      gender: 'Femenino',
      apparentAge: '24',
      bodyType: 'Editorial',
      skinTone: 'Claro',
      hairColor: 'Castaño',
      hairLength: 'Largo',
      hairStyle: 'Ondas',
      previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
    },
    garment: smokeGarment,
    jobs: [smokeJob],
  };

  const projectRepo = getProjectRepository();
  await projectRepo.create(smokeProject);

  // Time submission and execution
  const startTime = Date.now();
  console.log(`Starting GenerationJobRunner for project ${smokeProjectId}...`);

  await GenerationJobRunner.runProject(smokeProjectId, 1);
  const totalDurationMs = Date.now() - startTime;

  const finalStatus = await GenerationJobRunner.getProjectStatus(smokeProjectId);
  assert.ok(finalStatus, 'Final status must exist');
  const finishedJob = finalStatus.jobs[0];
  assert.ok(finishedJob, 'Finished job must exist');

  console.log('\n==================================================');
  console.log('REAL PROVIDER SMOKE VALIDATION RESULTS');
  console.log('==================================================');
  console.log(`AI_MODE: ${config.aiMode}`);
  console.log(`ANALYSIS PROVIDER: ${config.analysisProvider}`);
  console.log(`GENERATION PROVIDER: ${config.generationProvider}`);
  console.log(`VALIDATION PROVIDER: ${config.validationProvider}`);
  console.log(`INPUT TYPE TO FAL: ${inputType}`);
  console.log(`SMOKE TEST 1x1: ${finishedJob.status === 'APPROVED' ? 'PASS' : 'FAIL'}`);
  console.log(`FINAL JOB STATUS: ${finishedJob.status}`);
  console.log(`PROVIDER REQUEST ID: ${finishedJob.providerRequestId || 'N/A'}`);
  console.log(`GENERATION & VALIDATION TOTAL LATENCY: ${totalDurationMs}ms`);
  console.log(`OUTPUT URL: ${finishedJob.outputUrl || 'N/A'}`);
  console.log(`OUTPUT IMAGE VALID: ${finishedJob.outputUrl ? 'YES' : 'NO'}`);
  console.log(`GEMINI REAL VALIDATION: ${finishedJob.validationScore ? 'PASS' : 'FAIL'}`);
  if (finishedJob.validationScore) {
    console.log(`   Overall Score: ${finishedJob.validationScore.overallScore}`);
    console.log(`   Garment Identity: ${finishedJob.validationScore.garmentIdentityScore}`);
    console.log(`   Color Accuracy: ${finishedJob.validationScore.colorAccuracyScore}`);
    console.log(`   Hard Gates Passed: ${finishedJob.validationScore.policyPassed}`);
  }
  if (finishedJob.errorCode || finishedJob.errorMessage) {
    console.log(`ERROR CODE: ${finishedJob.errorCode}`);
    console.log(`ERROR MESSAGE: ${finishedJob.errorMessage}`);
  }
  console.log('==================================================\n');

  if (finishedJob.status !== 'APPROVED') {
    console.error(`❌ Smoke test did not end in APPROVED (was ${finishedJob.status})`);
    process.exit(1);
  } else {
    console.log('🎉 REAL SMOKE TEST PASSED! The provider pipeline is verified end-to-end.');
  }
}

runLiveSmokeValidation().catch((err) => {
  console.error('Fatal error during smoke validation:', err);
  process.exit(1);
});
