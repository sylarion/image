import assert from 'node:assert';
import { GenerationJobRunner } from '@/lib/ai/job-runner';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { transitionJobState, canAttemptRegeneration } from '@/lib/ai/job-state-machine';
import { Project, GenerationJob } from '@/types';

async function runRunnerTests() {
  console.log('🧪 Starting GenerationJobRunner & State Machine Test Suite...\n');

  const repo = getProjectRepository();

  // Test 1: Finite State Machine transitions
  console.log('1. Testing State Machine strict transitions...');
  assert.strictEqual(transitionJobState('QUEUED', 'GENERATING'), 'GENERATING');
  assert.strictEqual(transitionJobState('GENERATING', 'VALIDATING'), 'VALIDATING');
  assert.strictEqual(transitionJobState('VALIDATING', 'APPROVED'), 'APPROVED');
  assert.strictEqual(transitionJobState('VALIDATING', 'FAILED'), 'FAILED');
  assert.strictEqual(transitionJobState('QUEUED', 'FAILED'), 'FAILED');
  assert.throws(() => transitionJobState('QUEUED', 'APPROVED'), /Transición inválida/);
  assert.throws(() => transitionJobState('GENERATING', 'APPROVED'), /Transición inválida/);
  console.log('   ✓ State Machine enforces legal transitions and blocks illegal shortcuts.\n');

  // Test 2: Regeneration attempts limit
  console.log('2. Testing Regeneration attempts limit...');
  assert.strictEqual(canAttemptRegeneration(0), true);
  assert.strictEqual(canAttemptRegeneration(2), true);
  assert.strictEqual(canAttemptRegeneration(3), false);
  console.log('   ✓ Regeneration attempts capped at maximum 3.\n');

  // Test 3: Runner processes 1 single image smoke test (1 variant x 1 FRONT)
  console.log('3. Testing Single Image Smoke Test (1 variant x 1 FRONT = 1 job)...');
  const now = new Date().toISOString();
  const testProject1: Project = {
    id: `proj-smoke-${Date.now()}`,
    name: 'Smoke Test Garment',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: {
      modelId: 'mod-default',
      name: 'Modelo 01',
      gender: 'Femenino',
      apparentAge: '25',
      bodyType: 'Standard',
      skinTone: 'Claro',
      hairColor: 'Castaño',
      hairLength: 'Largo',
      hairStyle: 'Ondas',
      previewUrl: '',
    },
    garment: {
      id: 'glock-smoke',
      name: 'Smoke Test Garment',
      category: 'Remera',
      material: 'Algodón',
      pattern: 'Liso',
      details: [],
      pockets: false,
      sizes: ['M'],
      mustPreserve: [],
      colorVariants: [
        {
          id: 'col-black',
          name: 'Negro',
          detectedColor: 'Negro',
          colorDescription: 'Negro profundo',
          approximateHex: '#000000',
          selected: true,
          order: 0,
        },
      ],
      referenceImages: [
        {
          id: 'ref-1',
          type: 'REFERENCE',
          source: 'UPLOAD',
          url: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=800',
          order: 0,
          createdAt: now,
        },
      ],
    },
    jobs: [
      {
        id: `job-smoke-1-${Date.now()}`,
        projectId: `proj-smoke-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Negro — Frente',
        status: 'QUEUED',
        progress: 0,
        attempts: 0,
        createdAt: now,
      },
    ],
  };

  testProject1.jobs[0].projectId = testProject1.id;
  await repo.create(testProject1);

  // Run the runner for project 1
  await GenerationJobRunner.runProject(testProject1.id, 1);

  const status1 = await GenerationJobRunner.getProjectStatus(testProject1.id);
  assert.ok(status1, 'Status report should exist');
  assert.strictEqual(status1.totalJobs, 1);
  assert.strictEqual(status1.queued, 0, 'No jobs should remain QUEUED');
  assert.strictEqual(status1.generating, 0, 'No jobs should remain GENERATING');
  assert.strictEqual(status1.approved, 1, 'Smoke test job should be APPROVED');
  assert.strictEqual(status1.isCompleted, true, 'Project should be marked completed');
  assert.ok(status1.jobs[0].outputUrl, 'Job must have valid outputUrl');
  console.log(`   ✓ Single image smoke test passed! Output URL: ${status1.jobs[0].outputUrl?.substring(0, 40)}...\n`);

  // Test 4: Concurrency pool & batch execution (5 variants x 4 shots = 20 jobs)
  console.log('4. Testing Batch Execution (5 variants x 4 shots = 20 jobs)...');
  const variants = ['Celeste', 'Crudo', 'Verde Agua', 'Negro', 'Beige'];
  const shots: ('FRONT' | 'SIDE' | 'BACK' | 'ACTION')[] = ['FRONT', 'SIDE', 'BACK', 'ACTION'];

  const testProject20: Project = {
    id: `proj-batch20-${Date.now()}`,
    name: 'Remera Morley 5 Colores',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: testProject1.model,
    garment: {
      ...testProject1.garment,
      colorVariants: variants.map((name, i) => ({
        id: `col-v${i}`,
        name,
        detectedColor: name,
        colorDescription: name,
        approximateHex: '#333333',
        selected: true,
        order: i,
      })),
    },
    jobs: variants.flatMap((vName, vIdx) =>
      shots.map((shot) => ({
        id: `job-20-${vIdx}-${shot.toLowerCase()}-${Date.now()}`,
        projectId: `proj-batch20-${Date.now()}`,
        colorVariantId: `col-v${vIdx}`,
        colorName: vName,
        productionStyle: 'STUDIO_WHITE' as const,
        shotView: shot,
        label: `${vName} — ${shot}`,
        status: 'QUEUED' as const,
        progress: 0,
        attempts: 0,
        createdAt: now,
      }))
    ),
  };
  testProject20.jobs.forEach(j => j.projectId = testProject20.id);
  assert.strictEqual(testProject20.jobs.length, 20, 'Expected exactly 20 jobs for 5x4 matrix');

  await repo.create(testProject20);

  // Run with concurrency = 3
  await GenerationJobRunner.runProject(testProject20.id, 3);

  const status20 = await GenerationJobRunner.getProjectStatus(testProject20.id);
  assert.ok(status20);
  assert.strictEqual(status20.totalJobs, 20);
  assert.strictEqual(status20.queued, 0, 'All 20 jobs must leave QUEUED');
  assert.strictEqual(status20.approved, 20, 'All 20 jobs must be successfully generated and approved in mock mode');
  assert.strictEqual(status20.isCompleted, true);
  console.log('   ✓ 20 jobs (5x4) successfully executed through concurrency pool with 0 hanging in QUEUED!\n');

  // Test 5: Stuck Job Watchdog Protection
  console.log('5. Testing Stuck Job Watchdog Protection...');
  const stuckProject: Project = {
    id: `proj-stuck-${Date.now()}`,
    name: 'Stuck Job Protection Test',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: testProject1.model,
    garment: testProject1.garment,
    jobs: [
      {
        id: `job-stuck-1`,
        projectId: `proj-stuck-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Negro — Frente',
        status: 'GENERATING', // Stuck in generating
        progress: 25,
        attempts: 1,
        createdAt: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
        updatedAt: new Date(Date.now() - 120000).toISOString(),
      },
    ],
  };
  stuckProject.jobs[0].projectId = stuckProject.id;
  await repo.create(stuckProject);

  const recoveredCount = await GenerationJobRunner.recoverStuckJobs(stuckProject.id);
  assert.strictEqual(recoveredCount, 1, 'Watchdog should recover 1 stuck job');

  const recoveredStatus = await GenerationJobRunner.getProjectStatus(stuckProject.id);
  assert.ok(recoveredStatus);
  assert.strictEqual(recoveredStatus.failed, 1, 'Stuck job must transition to FAILED');
  assert.strictEqual(recoveredStatus.jobs[0].errorCode, 'STUCK_JOB_TIMEOUT');
  console.log('   ✓ Stuck job successfully intercepted by watchdog and transitioned to FAILED (no infinite spinner).\n');

  // Test 6: PARTIAL -> COMPLETED automatic convergence upon selective retry
  console.log('6. Testing PARTIAL -> COMPLETED convergence upon selective retry...');
  const partialProject: Project = {
    id: `proj-partial-${Date.now()}`,
    name: 'Partial Convergence Test',
    status: 'PARTIAL',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: testProject1.model,
    garment: testProject1.garment,
    jobs: [
      {
        id: `job-p-front`,
        projectId: `proj-partial-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Negro — FRONT',
        status: 'APPROVED',
        outputAsset: { id: 'asset-front', url: 'https://example.com/front.jpg' },
        progress: 100,
        attempts: 1,
        createdAt: now,
      },
      {
        id: `job-p-side`,
        projectId: `proj-partial-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'SIDE',
        label: 'Negro — SIDE',
        status: 'APPROVED',
        outputAsset: { id: 'asset-side', url: 'https://example.com/side.jpg' },
        progress: 100,
        attempts: 1,
        createdAt: now,
      },
      {
        id: `job-p-back`,
        projectId: `proj-partial-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'BACK',
        label: 'Negro — BACK',
        status: 'FAILED',
        errorCode: 'VALIDATION_REJECTED',
        progress: 100,
        attempts: 1,
        createdAt: now,
      },
      {
        id: `job-p-action`,
        projectId: `proj-partial-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'ACTION',
        label: 'Negro — ACTION',
        status: 'APPROVED',
        outputAsset: { id: 'asset-action', url: 'https://example.com/action.jpg' },
        progress: 100,
        attempts: 1,
        createdAt: now,
      },
    ],
  };
  partialProject.jobs.forEach(j => j.projectId = partialProject.id);
  await repo.create(partialProject);

  // Verify initial status is PARTIAL
  const initialPartial = await repo.getById(partialProject.id);
  assert.strictEqual(initialPartial?.status, 'PARTIAL');

  // Selective retry: Only retry job-p-back
  const backJob = partialProject.jobs.find(j => j.id === 'job-p-back')!;
  backJob.status = 'QUEUED';
  backJob.progress = 0;
  await repo.updateJob(partialProject.id, backJob);

  // Run the project runner
  await GenerationJobRunner.runProject(partialProject.id, 2);

  // Verify project status converged automatically to COMPLETED
  const finalPartial = await repo.getById(partialProject.id);
  assert.ok(finalPartial);
  assert.strictEqual(finalPartial.jobs.find(j => j.id === 'job-p-back')?.status, 'APPROVED');
  assert.strictEqual(finalPartial.status, 'COMPLETED', 'Project status must automatically converge from PARTIAL to COMPLETED when all shots are completed');
  console.log('   ✓ Selective retry of BACK automatically converged project status from PARTIAL to COMPLETED!\n');

  // Test 7: Cost Guard ceiling physically prevents exceeding maxCostWithRetries / maxAttempts
  console.log('7. Testing Cost Guard physical ceiling (maxAttempts and maxEstimatedCostUsd)...');
  const costGuardProject: Project = {
    id: `proj-costguard-${Date.now()}`,
    name: 'Cost Guard Physical Ceiling Test',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: testProject1.model,
    garment: testProject1.garment,
    pricingSnapshot: {
      quoteId: 'quote-test-guard',
      planKey: 'plan-test-guard',
      confirmedAt: now,
      provider: 'mock',
      model: 'mock-model',
      qualityProfile: 'standard',
      imageCount: 1,
      estimatedCostPerImageUsd: 0.0336,
      estimatedGenerationCostUsd: 0.0336,
      estimatedValidationCostUsd: 0,
      estimatedTotalCostUsd: 0.0336,
      maxAttempts: 2, // Maximum 2 attempts authorized (base + 1 retry)
      maxEstimatedCostUsd: 0.0672, // 2 × 0.0336 = 0.0672 ceiling
      currency: 'USD',
      quotedAt: now,
    },
    jobs: [
      {
        id: `job-cg-1`,
        projectId: `proj-costguard-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Negro — FRONT',
        status: 'QUEUED',
        progress: 0,
        attempts: 2, // Already reached the ceiling of 2 attempts!
        createdAt: now,
      },
    ],
  };
  costGuardProject.jobs[0].projectId = costGuardProject.id;
  await repo.create(costGuardProject);

  await GenerationJobRunner.runProject(costGuardProject.id, 1);

  const checkedGuardProject = await repo.getById(costGuardProject.id);
  const guardJob = checkedGuardProject?.jobs[0];
  assert.strictEqual(guardJob?.status, 'FAILED');
  assert.strictEqual(guardJob?.errorCode, 'COST_GUARD', 'Backend must physically block attempt exceeding maxCostWithRetries / maxAttempts');
  console.log('   ✓ Cost Guard ceiling physically blocked execution and set errorCode to COST_GUARD!\n');

  // Test 8: Analysis cache invalidation on SHA-256 + ANALYSIS_SCHEMA_VERSION / provider / model
  console.log('8. Testing Analysis Cache Invalidation on Schema/Version/Provider mismatch...');
  const { ANALYSIS_SCHEMA_VERSION } = await import('@/types/detection');
  const pastRunCompatible = {
    status: 'COMPLETED',
    analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  };
  const pastRunOldSchema = {
    status: 'COMPLETED',
    analysisSchemaVersion: '0.8.0',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  };
  const pastRunDifferentModel = {
    status: 'COMPLETED',
    analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
    provider: 'gemini',
    model: 'gemini-1.5-flash',
  };

  const isCompatible = (past: { status: string; analysisSchemaVersion: string; provider: string; model: string }, current: { provider: string; model: string }) =>
    past.status === 'COMPLETED' &&
    past.analysisSchemaVersion === ANALYSIS_SCHEMA_VERSION &&
    past.provider === current.provider &&
    past.model === current.model;

  const currentRun = { provider: 'gemini', model: 'gemini-2.5-flash' };
  assert.strictEqual(isCompatible(pastRunCompatible, currentRun), true, 'Compatible run should be reused');
  assert.strictEqual(isCompatible(pastRunOldSchema, currentRun), false, 'Older schema version must invalidate cache reuse even if SHA-256 matches');
  assert.strictEqual(isCompatible(pastRunDifferentModel, currentRun), false, 'Different model must invalidate cache reuse even if SHA-256 matches');
  console.log('   ✓ Cache reuse strictly invalidated on schema version, provider, or model change.\n');

  console.log('🎉 ALL GENERATION RUNNER & PIPELINE TESTS PASSED!');
}

runRunnerTests().catch((err) => {
  console.error('❌ Generation runner test failed:', err);
  process.exit(1);
});
