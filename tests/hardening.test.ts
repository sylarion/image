import assert from 'node:assert';
import { compileGenerationPrompt } from '../lib/ai/prompt-compiler/index';
import { validateGeneratedAsset, evaluateValidationStatus, DEFAULT_VALIDATION_POLICY } from '../lib/ai/validation/index';
import { computeReferenceCoverage, getShotReferenceStatus } from '../lib/ai/reference-coverage';
import { getShotContract } from '../lib/ai/shot-contracts';
import { GenerationRequest, ColorVariant, ImageAsset } from '../types/index';
import { GenerationRequestSchema } from '../lib/schemas/project';
import { MONO_FLOREAL_VARIANTS } from '../lib/constants/mock-projects';

console.log('🧪 Starting Enterprise Domain Hardening Test Suite for Catalog AI...\n');

const testColorVariant: ColorVariant = MONO_FLOREAL_VARIANTS[0]; // Negro

const frontOnlyRef: ImageAsset[] = [
  {
    id: 'ref-front-1',
    type: 'REFERENCE',
    source: 'UPLOAD',
    url: 'https://example.com/front.jpg',
    name: 'mono-frontal.jpg',
    createdAt: new Date().toISOString(),
  }
];

const frontAndBackRef: ImageAsset[] = [
  {
    id: 'ref-front-1',
    type: 'REFERENCE',
    source: 'UPLOAD',
    url: 'https://example.com/front.jpg',
    name: 'mono-frontal.jpg',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ref-back-1',
    type: 'REFERENCE',
    source: 'UPLOAD',
    url: 'https://example.com/back.jpg',
    name: 'mono-espalda-rear.jpg',
    createdAt: new Date().toISOString(),
  }
];

const testRequest: GenerationRequest = {
  garmentLock: {
    id: 'glock-test-1',
    name: 'Mono Floreal Test',
    category: 'Mono',
    material: 'Lino orgánico',
    pattern: 'Floral en relieve',
    details: ['Escote halter', 'Bolsillos laterales'],
    pockets: true,
    sizes: ['M'],
    mustPreserve: [
      'bordado dorado frontal',
      'escote halter',
      'bolsillos laterales',
      'largo botamanga',
      'estampado floral sin recolorear flores',
    ],
    colorVariants: MONO_FLOREAL_VARIANTS,
    coverage: computeReferenceCoverage(frontOnlyRef),
    referenceImages: frontOnlyRef,
  },
  colorVariant: testColorVariant,
  modelLock: {
    modelId: 'mod-sofia',
    name: 'Sofía',
    gender: 'Femenino',
    apparentAge: '25 años',
    bodyType: 'Editorial Standard',
    skinTone: 'Oliva claro',
    hairColor: 'Castaño oscuro',
    hairLength: 'Largo con ondas',
    hairStyle: 'Raya al medio',
    previewUrl: 'https://example.com/model.jpg',
  },
  productionStyle: 'STUDIO_WHITE',
  shotView: 'BACK',
  shotContract: getShotContract('BACK'),
  poseHistory: [
    {
      shotView: 'FRONT',
      bodyOrientation: 'FRONT',
      headOrientation: 'DIRECT_CAMERA',
      leftArm: 'at side',
      rightArm: 'relaxed',
      leftHand: 'natural',
      rightHand: 'natural',
      legsPosition: 'straight',
      weightDistribution: 'centered',
      torsoAngle: '0 deg',
      movement: 'STILL',
      expression: 'calm smile',
    }
  ],
  productionPoseHistory: {
    projectId: 'proj-test',
    poses: [
      {
        shotView: 'BACK',
        colorVariantId: 'col-bordo',
        productionStyle: 'STUDIO_WHITE',
        bodyOrientation: 'BACK',
        headOrientation: 'TURNED_OVER_SHOULDER_TO_CAMERA',
        leftArm: 'hip',
        rightArm: 'drop',
        leftHand: 'rested',
        rightHand: 'relaxed',
        legsPosition: 'straight',
        weightDistribution: 'left',
        torsoAngle: '180 deg',
        movement: 'STILL',
        expression: 'neutral elegance',
      }
    ]
  },
  referenceImages: frontOnlyRef,
};

// ==========================================
// TEST 1: REFERENCE COVERAGE RULES
// ==========================================
console.log('1. Testing ReferenceCoverage determination rules...');

const coverageFrontOnly = computeReferenceCoverage(frontOnlyRef);
assert.strictEqual(coverageFrontOnly.front, 'VERIFIED', 'Front must be VERIFIED with frontal image');
assert.strictEqual(coverageFrontOnly.back, 'UNKNOWN', 'Back must be UNKNOWN when only frontal image is uploaded');
assert.strictEqual(getShotReferenceStatus('BACK', coverageFrontOnly), 'AI_INFERRED', 'Back shot must be flagged as AI_INFERRED when back is UNKNOWN');

const coverageDual = computeReferenceCoverage(frontAndBackRef);
assert.strictEqual(coverageDual.front, 'VERIFIED');
assert.strictEqual(coverageDual.back, 'VERIFIED', 'Back must be VERIFIED when rear reference image is uploaded');
assert.strictEqual(getShotReferenceStatus('BACK', coverageDual), 'REFERENCE_VERIFIED', 'Back shot must be flagged as REFERENCE_VERIFIED');
console.log('   ✓ Front-only correctly yields UNKNOWN for BACK; rear reference yields REFERENCE_VERIFIED.');

// ==========================================
// TEST 2: VALIDATION HARD GATES
// ==========================================
console.log('\n2. Testing Validation Hard Gates & Metric Verifiability...');

(async () => {
  // Scenario A: Overall score high, but ColorAccuracy fails hard gate
  const failingColorResult = await validateGeneratedAsset({
    generatedAsset: {
      id: 'asset-1',
      type: 'GENERATED',
      source: 'MOCK',
      url: 'https://example.com/mock.jpg',
      createdAt: new Date().toISOString(),
    },
    garmentLock: testRequest.garmentLock,
    colorVariant: testColorVariant,
    modelLock: testRequest.modelLock,
    shotView: 'FRONT',
    referenceAssets: frontOnlyRef,
    policy: {
      ...DEFAULT_VALIDATION_POLICY,
      minColorAccuracyScore: 99, // artificially high to trigger failure
    }
  });

  assert.strictEqual(failingColorResult.policyPassed, false, 'Policy must fail when ColorAccuracy does not meet minimum');
  assert.strictEqual(evaluateValidationStatus(failingColorResult), 'REJECTED', 'Must REJECT even if overall score is high when a hard gate fails');
  assert.ok(failingColorResult.failedGates && failingColorResult.failedGates.length > 0, 'Failed gates must be listed');

  // Scenario B: Garment Identity fails hard gate
  const failingGarmentResult = await validateGeneratedAsset({
    generatedAsset: {
      id: 'asset-2',
      type: 'GENERATED',
      source: 'MOCK',
      url: 'https://example.com/mock.jpg',
      createdAt: new Date().toISOString(),
    },
    garmentLock: testRequest.garmentLock,
    colorVariant: testColorVariant,
    modelLock: testRequest.modelLock,
    shotView: 'FRONT',
    referenceAssets: frontOnlyRef,
    policy: {
      ...DEFAULT_VALIDATION_POLICY,
      minGarmentIdentityScore: 100, // force gate fail
    }
  });

  assert.strictEqual(failingGarmentResult.policyPassed, false);
  assert.strictEqual(evaluateValidationStatus(failingGarmentResult), 'REJECTED');

  // Scenario C: Rear shot with UNKNOWN coverage must mark BackConstructionFidelity as NOT_VERIFIABLE
  const backUnknownResult = await validateGeneratedAsset({
    generatedAsset: {
      id: 'asset-back',
      type: 'GENERATED',
      source: 'MOCK',
      url: 'https://example.com/mock-back.jpg',
      createdAt: new Date().toISOString(),
    },
    garmentLock: {
      ...testRequest.garmentLock,
      coverage: coverageFrontOnly,
    },
    colorVariant: testColorVariant,
    modelLock: testRequest.modelLock,
    shotView: 'BACK',
    referenceAssets: frontOnlyRef,
  });

  const backMetric = backUnknownResult.metrics?.find(m => m.metric === 'BackConstructionFidelity');
  assert.ok(backMetric, 'BackConstructionFidelity metric must exist in audit');
  assert.strictEqual(backMetric.status, 'NOT_VERIFIABLE', 'BackConstructionFidelity must be NOT_VERIFIABLE without rear reference');
  assert.strictEqual(backUnknownResult.referenceStatus, 'AI_INFERRED', 'Reference status must be AI_INFERRED');

  console.log('   ✓ Hard gates strictly reject failures regardless of overallScore; UNKNOWN coverage correctly marks NOT_VERIFIABLE.');

  // ==========================================
  // TEST 3: PROMPT COMPILER CONTRACTS & PRODUCTION POSE HISTORY
  // ==========================================
  console.log('\n3. Testing Prompt Compiler with ShotContract & Cross-Color Anti-Cloning...');

  const compiled = compileGenerationPrompt(testRequest);

  // ShotContract verification
  assert.ok(compiled.shotDirection.includes('BACK'), 'Shot direction must enforce BACK contract');
  assert.ok(compiled.shotDirection.includes('OVER_SHOULDER_TO_CAMERA'), 'Head orientation must enforce OVER_SHOULDER_TO_CAMERA');
  assert.ok(compiled.shotDirection.includes('CAMERA'), 'Gaze must enforce CAMERA');
  assert.ok(compiled.cameraLookRule.includes('camera'), 'Mandatory camera gaze rule present');

  // Anti-cloning from ProductionPoseHistory
  assert.ok(
    compiled.previousPosesAvoidance.some(p => p.includes('CROSS-COLOR ANTI-CLONING')),
    'ProductionPoseHistory must inject cross-color anti-cloning directives'
  );

  console.log('   ✓ ShotContracts and ProductionPoseHistory directives properly compiled into prompts.');

  // ==========================================
  // TEST 4: CANONICAL 4 SHOTS HAVE FORMAL CONTRACTS
  // ==========================================
  console.log('\n4. Testing Formal ShotContracts for all canonical shots...');

  const views = ['FRONT', 'SIDE', 'BACK', 'ACTION'] as const;
  for (const v of views) {
    const contract = getShotContract(v);
    assert.strictEqual(contract.gaze, 'CAMERA', `${v} contract must enforce gaze: CAMERA`);
    assert.ok(contract.focusAspects.length > 0, `${v} contract must have focus aspects`);
  }
  assert.strictEqual(getShotContract('BACK').bodyOrientation, 'BACK');
  assert.strictEqual(getShotContract('SIDE').bodyOrientation, 'SIDE');
  assert.strictEqual(getShotContract('ACTION').movement, 'REQUIRED');
  console.log('   ✓ All 4 shots require gaze CAMERA, BACK requires true rear torso, ACTION requires movement.');

  // ==========================================
  // TEST 5: ZOD SCHEMAS & HARDENING COMPLIANCE
  // ==========================================
  console.log('\n5. Testing Zod GenerationRequest Schema with hardened types...');

  const schemaResult = GenerationRequestSchema.safeParse(testRequest);
  assert.ok(schemaResult.success, `Schema validation failed: ${JSON.stringify(schemaResult)}`);
  console.log('   ✓ Zod schema successfully validates GenerationRequest with coverage and enriched variants.');

  console.log('\n🎉 ALL DOMAIN HARDENING & ENTERPRISE CONTRACT TESTS PASSED! (5/5 suites)\n');
})();
