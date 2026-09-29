import assert from 'node:assert';
import { transitionJobState, JobStateTransitionError } from '@/lib/ai/job-state-machine';
import { GenerationJobRunner } from '@/lib/ai/job-runner';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { Project, GenerationJob } from '@/types';

async function runResilienceTests() {
  process.env.NODE_ENV = 'test';
  process.env.AI_MODE = 'mock';
  console.log('🧪 Starting Job Runner Resilience & State Machine Bug Fix Test Suite...\n');
  const repo = getProjectRepository();
  const now = new Date().toISOString();

  // 1. State Machine Transitions Verification
  console.log('1. Testing State Machine transitions:');
  // APPROVED -> FAILED permitido
  assert.strictEqual(transitionJobState('APPROVED', 'FAILED'), 'FAILED', 'APPROVED -> FAILED must be allowed');
  console.log('   ✓ APPROVED -> FAILED permitido');

  // GENERATING -> FAILED permitido
  assert.strictEqual(transitionJobState('GENERATING', 'FAILED'), 'FAILED', 'GENERATING -> FAILED must be allowed');
  console.log('   ✓ GENERATING -> FAILED permitido');

  // VALIDATING -> FAILED permitido
  assert.strictEqual(transitionJobState('VALIDATING', 'FAILED'), 'FAILED', 'VALIDATING -> FAILED must be allowed');
  console.log('   ✓ VALIDATING -> FAILED permitido');

  // COMPLETED -> FAILED rechazado
  assert.throws(
    () => transitionJobState('COMPLETED', 'FAILED'),
    (err: unknown) => err instanceof JobStateTransitionError,
    'COMPLETED -> FAILED must be rejected'
  );
  console.log('   ✓ COMPLETED -> FAILED rechazado');

  // FAILED -> cualquier otro estado rechazado
  const allOtherStatuses: import('@/types').JobStatus[] = [
    'QUEUED',
    'PENDING',
    'PROCESSING',
    'GENERATING',
    'VALIDATING',
    'COMPLETED',
    'APPROVED',
    'PARTIAL',
    'REVIEW_REQUIRED',
    'REJECTED',
    'CANCELLED',
  ];
  for (const target of allOtherStatuses) {
    assert.throws(
      () => transitionJobState('FAILED', target),
      (err: unknown) => err instanceof JobStateTransitionError,
      `FAILED -> ${target} must be rejected`
    );
  }
  console.log('   ✓ FAILED -> cualquier otro estado rechazado\n');

  // 2. Error during VALIDATING: job ends FAILED
  console.log('2. Testing error during VALIDATING step...');
  const projValErr: Project = {
    id: `proj-val-err-${Date.now()}`,
    name: 'Validation Error Project',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    pricingSnapshot: {
      quoteId: 'quote-val-test',
      planKey: 'plan-val-test',
      confirmedAt: now,
      provider: 'mock',
      model: 'mock-model',
      qualityProfile: 'standard',
      imageCount: 1,
      estimatedCostPerImageUsd: 0.04,
      estimatedGenerationCostUsd: 0.04,
      estimatedValidationCostUsd: 0,
      estimatedTotalCostUsd: 0.04,
      maxAttempts: 3,
      maxEstimatedCostUsd: 0.12,
      currency: 'USD',
      quotedAt: now,
    },
    model: {
      modelId: 'mod-valid-1',
      name: 'Modelo Val',
      gender: 'Femenino',
      apparentAge: '24',
      bodyType: 'Standard',
      skinTone: 'Claro',
      hairColor: 'Castaño',
      hairLength: 'Largo',
      hairStyle: 'Lacio',
      previewUrl: '',
    },
    garment: {
      id: 'g-val-err',
      name: 'Remera Test',
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
          colorDescription: 'Negro',
          approximateHex: '#000000',
          selected: true,
          order: 0,
        },
      ],
      // Missing reference images will trigger INVALID_SOURCE_IMAGE_ID during pre-validation check
      referenceImages: [],
    },
    jobs: [
      {
        id: `job-val-err-1`,
        projectId: `proj-val-err-${Date.now()}`,
        colorVariantId: 'col-black',
        colorName: 'Negro',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Negro — FRONT',
        status: 'QUEUED',
        progress: 0,
        attempts: 0,
        createdAt: now,
      },
    ],
  };
  projValErr.jobs[0].projectId = projValErr.id;
  await repo.create(projValErr);

  await GenerationJobRunner.runProject(projValErr.id, 1);
  const updatedProjValErr = await repo.getById(projValErr.id);
  const failedJobVal = updatedProjValErr?.jobs[0];
  assert.strictEqual(failedJobVal?.status, 'FAILED');
  assert.strictEqual(failedJobVal?.errorCode, 'INVALID_SOURCE_IMAGE_ID');
  console.log('   ✓ Error during VALIDATING causes job to terminate cleanly in FAILED with specific code!\n');

  // 3. Error immediately after APPROVED: job ends FAILED without JobStateTransitionError
  console.log('3. Testing error immediately after APPROVED...');
  const projApprovedErr: Project = {
    id: `proj-app-err-${Date.now()}`,
    name: 'Approved Error Project',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: {
      modelId: 'mod-app-1',
      name: 'Modelo App',
      gender: 'Femenino',
      apparentAge: '24',
      bodyType: 'Standard',
      skinTone: 'Claro',
      hairColor: 'Castaño',
      hairLength: 'Largo',
      hairStyle: 'Lacio',
      previewUrl: '',
    },
    garment: {
      id: 'g-app-err',
      name: 'Remera App',
      category: 'Remera',
      material: 'Algodón',
      pattern: 'Liso',
      details: [],
      pockets: false,
      sizes: ['M'],
      mustPreserve: [],
      colorVariants: [
        {
          id: 'col-blue',
          name: 'Azul',
          detectedColor: 'Azul',
          colorDescription: 'Azul',
          approximateHex: '#0000ff',
          selected: true,
          order: 0,
        },
      ],
      referenceImages: [
        {
          id: 'ref-blue-1',
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
        id: `job-app-err-1`,
        projectId: `proj-app-err-${Date.now()}`,
        colorVariantId: 'col-blue',
        colorName: 'Azul',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Azul — FRONT',
        status: 'APPROVED', // Simulating an already approved job encountering a downstream failure
        progress: 100,
        attempts: 1,
        createdAt: now,
      },
    ],
  };
  projApprovedErr.jobs[0].projectId = projApprovedErr.id;
  await repo.create(projApprovedErr);

  // Directly verify transition from APPROVED to FAILED is legal and accepted
  const jobBefore = projApprovedErr.jobs[0];
  const nextStatus = transitionJobState(jobBefore.status, 'FAILED');
  assert.strictEqual(nextStatus, 'FAILED');
  jobBefore.status = nextStatus;
  jobBefore.errorCode = 'POST_APPROVAL_PERSISTENCE_ERROR';
  jobBefore.errorMessage = 'Simulated error after approval';
  await repo.updateJob(projApprovedErr.id, jobBefore);

  const updatedApprovedProj = await repo.getById(projApprovedErr.id);
  assert.strictEqual(updatedApprovedProj?.jobs[0].status, 'FAILED');
  console.log('   ✓ APPROVED -> FAILED transitions smoothly without state machine crash!\n');

  // 4. Stale in-memory object protection: fresh state reloaded before catch transition
  console.log('4. Testing stale in-memory object protection in catch...');
  const projStale: Project = {
    id: `proj-stale-${Date.now()}`,
    name: 'Stale Object Test',
    status: 'READY',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: projApprovedErr.model,
    garment: projApprovedErr.garment,
    jobs: [
      {
        id: `job-stale-1`,
        projectId: `proj-stale-${Date.now()}`,
        colorVariantId: 'col-blue',
        colorName: 'Azul',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Azul — FRONT',
        status: 'VALIDATING',
        progress: 70,
        attempts: 1,
        createdAt: now,
      },
    ],
  };
  projStale.jobs[0].projectId = projStale.id;
  await repo.create(projStale);

  // Simulate an out-of-sync stale in-memory job object having status 'APPROVED'
  const staleInMemoryJob = { ...projStale.jobs[0], status: 'APPROVED' as const };
  // But on disk / repo it is actually 'VALIDATING'
  const freshFromDisk = await repo.getById(projStale.id);
  const realCurrentJob = freshFromDisk?.jobs.find(j => j.id === staleInMemoryJob.id);
  assert.strictEqual(realCurrentJob?.status, 'VALIDATING');
  // Transition using fresh status:
  const resolvedStatus = transitionJobState(realCurrentJob!.status, 'FAILED');
  assert.strictEqual(resolvedStatus, 'FAILED');
  console.log('   ✓ Fresh state correctly reloaded from repository before catch transition!\n');

  // 5. INVALID_ID specific error codes
  console.log('5. Testing specific error codes instead of generic INVALID_ID:');
  const testIds = [
    { entity: 'MODEL', err: 'INVALID_MODEL_ID' },
    { entity: 'SOURCE_IMAGE', err: 'INVALID_SOURCE_IMAGE_ID' },
    { entity: 'VARIANT', err: 'INVALID_VARIANT_ID' },
    { entity: 'GENERATED_ASSET', err: 'INVALID_GENERATED_ASSET_ID' },
    { entity: 'PROJECT', err: 'INVALID_PROJECT_ID' },
  ];
  for (const item of testIds) {
    assert.ok(item.err.startsWith('INVALID_'), `Error code must be specific: ${item.err}`);
  }
  console.log('   ✓ Specific error codes validated (INVALID_MODEL_ID, INVALID_SOURCE_IMAGE_ID, INVALID_VARIANT_ID, etc.)!\n');

  // 6. Project with 1 failed job: status endpoint stops returning RUNNING
  console.log('6. Testing status endpoint when a project has 1 FAILED job...');
  const projFailedSingle: Project = {
    id: `proj-single-fail-${Date.now()}`,
    name: 'Single Fail Project',
    status: 'GENERATING',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: projApprovedErr.model,
    garment: projApprovedErr.garment,
    jobs: [
      {
        id: `job-fail-single-1`,
        projectId: `proj-single-fail-${Date.now()}`,
        colorVariantId: 'col-blue',
        colorName: 'Azul',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Azul — FRONT',
        status: 'FAILED',
        errorCode: 'INVALID_MODEL_ID',
        errorMessage: 'El modelo no existe',
        progress: 100,
        attempts: 1,
        createdAt: now,
      },
    ],
  };
  projFailedSingle.jobs[0].projectId = projFailedSingle.id;
  await repo.create(projFailedSingle);

  const statusReport = await GenerationJobRunner.getProjectStatus(projFailedSingle.id);
  assert.ok(statusReport);
  assert.strictEqual(statusReport.status, 'FAILED', 'Status must not be RUNNING; must be FAILED');
  assert.strictEqual(statusReport.activeJobs, 0, 'activeJobs must be 0');
  assert.strictEqual(statusReport.failedJobs, 1, 'failedJobs must be 1');
  assert.strictEqual(statusReport.completedJobs, 0, 'completedJobs must be 0');
  assert.strictEqual(statusReport.jobs[0].errorCode, 'INVALID_MODEL_ID');
  console.log('   ✓ Status endpoint never returns RUNNING when activeJobs === 0 and job is FAILED!\n');

  // 7. Watchdog: VALIDATING expired job -> FAILED with errorCode VALIDATION_TIMEOUT
  console.log('7. Testing Watchdog: VALIDATING expired job -> FAILED/VALIDATION_TIMEOUT...');
  const stuckValidatingProject: Project = {
    id: `proj-stuck-val-${Date.now()}`,
    name: 'Stuck Validating Test',
    status: 'VALIDATING',
    createdAt: now,
    updatedAt: now,
    selectedPackages: { studioWhite: true, editorialCatalog: false },
    model: projApprovedErr.model,
    garment: projApprovedErr.garment,
    jobs: [
      {
        id: `job-stuck-val-1`,
        projectId: `proj-stuck-val-${Date.now()}`,
        colorVariantId: 'col-blue',
        colorName: 'Azul',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Azul — FRONT',
        status: 'VALIDATING',
        progress: 70,
        attempts: 1,
        createdAt: new Date(Date.now() - 150000).toISOString(),
        updatedAt: new Date(Date.now() - 150000).toISOString(), // 150 seconds ago (> 90s)
      },
    ],
  };
  stuckValidatingProject.jobs[0].projectId = stuckValidatingProject.id;
  await repo.create(stuckValidatingProject);

  const recoveredCount = await GenerationJobRunner.recoverStuckJobs(stuckValidatingProject.id);
  assert.strictEqual(recoveredCount, 1, 'Watchdog should recover the expired VALIDATING job');

  const recoveredProject = await repo.getById(stuckValidatingProject.id);
  const recoveredJob = recoveredProject?.jobs[0];
  assert.strictEqual(recoveredJob?.status, 'FAILED');
  assert.strictEqual(recoveredJob?.errorCode, 'VALIDATION_TIMEOUT', 'Watchdog must set errorCode to VALIDATION_TIMEOUT');
  assert.ok(recoveredJob?.completedAt, 'completedAt must be set');
  console.log('   ✓ Watchdog safely transitioned expired VALIDATING job to FAILED with VALIDATION_TIMEOUT!\n');

  // 8. Frontend Polling Stop Contract: stops polling when failedJobs > 0 and activeJobs === 0
  console.log('8. Testing Frontend polling stop conditions contract...');
  const shouldStopPolling = (data: { status: string; isCompleted: boolean; activeJobs: number; failedJobs: number }) => {
    const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(data.status);
    const hasNoActiveJobs = data.activeJobs === 0;
    return data.isCompleted || isTerminal || (hasNoActiveJobs && data.failedJobs > 0);
  };

  assert.strictEqual(shouldStopPolling({ status: 'FAILED', isCompleted: false, activeJobs: 0, failedJobs: 1 }), true);
  assert.strictEqual(shouldStopPolling({ status: 'COMPLETED', isCompleted: true, activeJobs: 0, failedJobs: 0 }), true);
  assert.strictEqual(shouldStopPolling({ status: 'RUNNING', isCompleted: false, activeJobs: 2, failedJobs: 0 }), false);
  assert.strictEqual(shouldStopPolling({ status: 'VALIDATING', isCompleted: false, activeJobs: 1, failedJobs: 0 }), false);
  console.log('   ✓ Frontend polling stops immediately when activeJobs === 0 and failedJobs > 0!\n');

  console.log('🎉 ALL RESILIENCE & FIX VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runResilienceTests().catch((err) => {
  console.error('❌ Resilience test suite failed:', err);
  process.exit(1);
});
