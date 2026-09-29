import assert from 'node:assert/strict';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { GeminiImageValidator } from '@/lib/ai/gemini-validator';
import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { ImageAsset, GarmentLock, ModelLock, Project } from '@/types';

async function testGeminiRealMultimodal() {
  console.log('Testing Real Multimodal Gemini Image Validator live with GEMINI_API_KEY...');

  const apiKey = process.env.GEMINI_API_KEY;
  assert.ok(apiKey, 'GEMINI_API_KEY must be configured');

  const { LocalJsonStore } = await import('@/lib/storage/local-json');
  const projectStore = new LocalJsonStore<Project>('projects');
  const project = await projectStore.get('proj-3a2d4a54-e9e4-4590-bc1b-52371db6604d');
  assert.ok(project, 'Expected saved project on disk');

  const sourceGarment = project.garment;
  const variant = sourceGarment.colorVariants[0];
  const cropUrl = variant.referenceCrop || variant.referenceAssets?.[0]?.url;
  assert.ok(cropUrl, 'Expected a real crop URL');

  const validator = new GeminiImageValidator(apiKey, 'gemini-2.5-flash');

  const referenceAsset: ImageAsset = {
    id: 'ref-test-crop',
    type: 'REFERENCE',
    source: 'UPLOAD',
    url: cropUrl,
    name: 'Crop Referencia Celeste',
    mimeType: 'image/png',
    createdAt: new Date().toISOString(),
  };

  // We test auditing the reference crop against itself as a ground-truth calibration
  const garmentLock: GarmentLock = {
    ...project.garment,
    referenceImages: [referenceAsset],
  };

  const modelLock: ModelLock = {
    modelId: 'model-female-sofia',
    name: 'Sofía',
    gender: 'Femenino',
    apparentAge: '24',
    bodyType: 'Editorial',
    skinTone: 'Claro',
    hairColor: 'Castaño',
    hairLength: 'Largo',
    hairStyle: 'Ondas',
    previewUrl: '',
  };

  const startTime = Date.now();
  const valResult = await validator.validate({
    generatedAsset: referenceAsset,
    garmentLock,
    colorVariant: garmentLock.colorVariants[0],
    modelLock,
    shotView: 'FRONT',
    referenceAssets: [referenceAsset],
  });
  const durationMs = Date.now() - startTime;

  console.log('\n--- GEMINI LIVE VALIDATION RESULTS ---');
  console.log(`Latency: ${durationMs}ms`);
  console.log(`Overall Score: ${valResult.overallScore}`);
  console.log(`Garment Identity: ${valResult.garmentIdentityScore}`);
  console.log(`Color Accuracy: ${valResult.colorAccuracyScore}`);
  console.log(`Policy Passed: ${valResult.policyPassed}`);
  console.log(`Issues: ${JSON.stringify(valResult.issues)}`);
  console.log(`Failed Gates: ${JSON.stringify(valResult.failedGates)}`);
  console.log('--------------------------------------\n');

  assert.ok(valResult.overallScore > 0, 'Gemini must return real numeric score');
  console.log('✓ Gemini Real Multimodal Validator verified live!');
}

testGeminiRealMultimodal().catch((err) => {
  console.error('Gemini test failed:', err);
  process.exit(1);
});
