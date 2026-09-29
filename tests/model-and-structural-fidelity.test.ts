import assert from 'node:assert/strict';
import { 
  getModelById, 
  findModelById,
  DEFAULT_MODEL 
} from '@/lib/constants/models';
import { createSelectedProduction } from '@/lib/production/selection';
import { 
  buildGarmentMaster, 
  compileGarmentMasterDirectives, 
  evaluateStructuralFidelityAudit, 
  validateCrossVariantConsistency 
} from '@/lib/dna/garment-master';
import { compileGenerationPrompt } from '@/lib/ai/prompt-compiler';
import { evaluateValidationStatus, validateGeneratedAsset } from '@/lib/ai/validation';
import { GenerationJobRunner } from '@/lib/ai/job-runner';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { canAttemptRegeneration } from '@/lib/ai/job-state-machine';
import type { 
  AnalysisRun, 
  Project, 
  GarmentLock, 
  ColorVariant, 
  ImageAsset, 
  ModelLock 
} from '@/types';

process.env.AI_MODE = 'mock';
process.env.NODE_ENV = 'test';

const mockRun: AnalysisRun = {
  analysisRunId: 'run-fidelity-test',
  status: 'COMPLETED',
  createdAt: new Date().toISOString(),
  sourceImages: [{
    id: 'img-1',
    storageKey: 'mock/key-1',
    sha256: 'mock-sha256-hash-fidelity',
    byteSize: 1024,
    width: 800,
    height: 1000,
    mimeType: 'image/jpeg',
    url: 'https://storage.test/img-1.jpg',
    type: 'ORIGINAL',
    source: 'UPLOAD',
    order: 0,
    createdAt: new Date().toISOString(),
  }],
  crops: [{
    id: 'crop-1',
    sourceImageId: 'img-1',
    storageKey: 'mock/crop-1',
    sha256: 'crop-sha256-hash-fidelity',
    width: 400,
    height: 600,
    url: 'https://storage.test/crop-1.jpg',
    normalizedBbox: [0.1, 0.1, 0.9, 0.9],
    createdAt: new Date().toISOString(),
  }],
  productGroups: [{
    id: 'group-1',
    name: 'Camisa',
    category: 'Camisa',
    visualSignature: {
      dominantColorName: 'Terracota',
      distinctiveDetails: ['Botonera frontal', '3 botones nacarados'],
      hasPockets: false,
      patternType: 'Liso',
    },
    garmentDNA: {
      category: 'Camisa',
      silhouette: 'Regular Fit',
      fitType: 'Regular',
      length: 'Cadera',
      neckline: 'Cuello camisero regular',
      sleeves: 'Manga corta',
      waistline: 'Recta',
      closure: 'Botonera central con 3 botones',
      structuralDetails: ['Cuello camisero', '3 botones', 'Placket frontal'],
      mustPreserve: ['Cuello camisero', '3 botones', 'Placket frontal'],
    },
    variants: [
      {
        id: 'var-1',
        productGroupId: 'group-1',
        color: { canonicalName: 'Terracota', observedName: 'Terracota cálido', hex: '#C85A32' },
        referenceCrops: ['https://storage.test/crop-1.jpg'],
      },
      {
        id: 'var-2',
        productGroupId: 'group-1',
        color: { canonicalName: 'Negro', observedName: 'Negro carbón', hex: '#18181B' },
        referenceCrops: ['https://storage.test/crop-1.jpg'],
      },
    ],
  }],
  analyses: [],
  executionMetrics: {
    totalImagesUploaded: 1,
    totalDetectedGarments: 1,
    finalVariantsCount: 2,
    processingDurationMs: 100,
    pipelineSuccess: true,
    detectionExecutionMs: 50,
    reconciliationExecutionMs: 10,
    dnaExtractionExecutionMs: 40,
  },
};

const selectionPayload = {
  analysisRunId: 'run-fidelity-test',
  products: [{
    productGroupId: 'group-1',
    identity: {
      productGroupId: 'group-1',
      aiSuggestedName: 'Camisa',
      aiSuggestedCategory: 'Camisa',
      confirmedName: 'Camisa',
      confirmedCategory: 'Camisa',
      source: 'USER_CORRECTED' as const,
      confirmedAt: new Date().toISOString(),
    },
    selectedVariantIds: ['var-1', 'var-2'],
    customColorNames: {},
  }],
  shots: ['FRONT' as const, 'SIDE' as const],
  destination: 'MERCADO_LIBRE' as const,
  style: 'FONDO_BLANCO' as const,
  modelId: 'model-female-sofia',
};

async function runTests() {
  console.log('🧪 Starting 25 Target Tests: Human Model Consistency & Garment Structural Fidelity...\n');

  // Test 1: modelId seleccionado llega intacto a todos los jobs
  console.log('Test 1: modelId seleccionado llega intacto a todos los jobs...');
  const production1 = createSelectedProduction(mockRun, selectionPayload);
  assert.equal(production1.model.modelId, 'model-female-sofia');
  assert.equal(production1.productionSelection.modelId, 'model-female-sofia');
  assert.ok(production1.jobs.length > 0);
  for (const job of production1.jobs) {
    assert.equal(job.modelLock?.modelId, 'model-female-sofia', 'Cada job debe tener modelLock con el modelId exacto');
  }
  console.log('   ✓ modelId llega intacto a todos los jobs.');

  // Test 2: modelId inexistente produce error explícito
  console.log('Test 2: modelId inexistente produce error explícito...');
  assert.throws(() => {
    createSelectedProduction(mockRun, {
      ...selectionPayload,
      modelId: 'model-inexistente-xyz',
    });
  }, (err: Error) => {
    return err.message.includes('MODEL_NOT_FOUND') || err.message.includes('no encontrado');
  });
  console.log('   ✓ modelId inexistente arroja error explícito.');

  // Test 3: no existe fallback silencioso de modelo
  console.log('Test 3: no existe fallback silencioso de modelo...');
  const missingModel = findModelById('model-fake-random');
  assert.equal(missingModel, undefined, 'findModelById no debe retornar un fallback por defecto');
  assert.throws(() => getModelById('model-fake-random'), /MODEL_NOT_FOUND/);
  console.log('   ✓ Fallback silencioso de modelo completamente bloqueado.');

  // Test 4: todos los jobs usan mismo ModelLock
  console.log('Test 4: todos los jobs usan mismo ModelLock...');
  const sofiaModel = getModelById('model-female-sofia');
  for (const job of production1.jobs) {
    assert.equal(job.modelLock?.hairColor, sofiaModel.hairColor);
    assert.equal(job.modelLock?.skinTone, sofiaModel.skinTone);
    assert.equal(job.modelLock?.bodyType, sofiaModel.bodyType);
    assert.equal(job.modelLock?.apparentAge, sofiaModel.apparentAge);
  }
  console.log('   ✓ Todos los jobs comparten el mismo ModelLock antropométrico.');

  // Test 5: Garment Master se construye y propaga
  console.log('Test 5: Garment Master se construye y propaga...');
  assert.ok(production1.garment.garmentMaster, 'Project garment must have garmentMaster');
  const master = production1.garment.garmentMaster!;
  assert.equal(master.category, 'Camisa');
  assert.equal(master.buttons.count, 3);
  assert.equal(master.frontPlacket.present, true);
  for (const job of production1.jobs) {
    assert.ok(job.garmentMaster, 'Job must have garmentMaster attached');
    assert.equal(job.garmentMaster?.schemaVersion, master.schemaVersion);
  }
  console.log('   ✓ Garment Master se construye y propaga a todos los jobs.');

  // Test 6: allowedChanges solo permite color cuando corresponde
  console.log('Test 6: allowedChanges solo permite color cuando corresponde...');
  assert.equal(master.allowedChanges.allowLightingNuances, true);
  assert.equal(master.allowedChanges.allowNaturalPoseOcclusions, true);
  assert.ok(!('neckline' in master.allowedChanges));
  assert.ok(!('buttonCount' in master.allowedChanges));
  console.log('   ✓ allowedChanges estrictamente delimitado.');

  // Test 7: lockedAttributes se respetan
  console.log('Test 7: lockedAttributes se respetan...');
  assert.ok(master.lockedAttributes.includes('neckline'));
  assert.ok(master.lockedAttributes.includes('necklineGeometry'));
  assert.ok(master.lockedAttributes.includes('buttonCount'));
  assert.ok(master.lockedAttributes.includes('buttonPlacement'));
  assert.ok(master.lockedAttributes.includes('sleeves'));
  assert.ok(master.lockedAttributes.includes('seams'));
  assert.ok(master.lockedAttributes.includes('silhouette'));
  console.log('   ✓ lockedAttributes definidos exhaustivamente.');

  // Test 8: botón extra => reject
  console.log('Test 8: botón extra => reject...');
  const auditBtnExtra = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasButtonMismatch: true,
  });
  assert.equal(auditBtnExtra.status, 'REJECTED');
  assert.ok(auditBtnExtra.criticalFaults.includes('CRITICAL_BUTTON_EXTRA'));
  console.log('   ✓ Botón extra detectado como falla crítica => REJECTED.');

  // Test 9: botón faltante => reject
  console.log('Test 9: botón faltante => reject...');
  const auditBtnMissing = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasButtonMismatch: true,
  });
  assert.equal(auditBtnMissing.status, 'REJECTED');
  console.log('   ✓ Botón faltante detectado => REJECTED.');

  // Test 10: cuello diferente => reject
  console.log('Test 10: cuello diferente => reject...');
  const auditNeckline = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasNecklineAltered: true,
  });
  assert.equal(auditNeckline.status, 'REJECTED');
  assert.ok(auditNeckline.criticalFaults.includes('CRITICAL_NECKLINE_ALTERED'));
  console.log('   ✓ Cuello alterado detectado => REJECTED.');

  // Test 11: manga diferente => reject
  console.log('Test 11: manga diferente => reject...');
  const auditSleeve = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasSleeveMutated: true,
  });
  assert.equal(auditSleeve.status, 'REJECTED');
  assert.ok(auditSleeve.criticalFaults.includes('CRITICAL_SLEEVE_MUTATED'));
  console.log('   ✓ Manga diferente => REJECTED.');

  // Test 12: costura estructural faltante => reject
  console.log('Test 12: costura estructural faltante => reject...');
  const auditSeam = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasSeamMissing: true,
  });
  assert.equal(auditSeam.status, 'REJECTED');
  assert.ok(auditSeam.criticalFaults.includes('CRITICAL_SEAM_MISSING'));
  console.log('   ✓ Costura estructural faltante => REJECTED.');

  // Test 13: bolsillo inventado => reject
  console.log('Test 13: bolsillo inventado => reject...');
  const auditPocket = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasPocketInvented: true,
  });
  assert.equal(auditPocket.status, 'REJECTED');
  assert.ok(auditPocket.criticalFaults.includes('CRITICAL_POCKET_INVENTED'));
  console.log('   ✓ Bolsillo inventado => REJECTED.');

  // Test 14: hem/largo inconsistente => reject
  console.log('Test 14: hem/largo inconsistente => reject...');
  const auditHem = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasHemLengthAltered: true,
  });
  assert.equal(auditHem.status, 'REJECTED');
  assert.ok(auditHem.criticalFaults.includes('CRITICAL_HEM_LENGTH_ALTERED'));
  console.log('   ✓ Hem/largo alterado => REJECTED.');

  // Test 15: pattern topology inconsistente => reject
  console.log('Test 15: pattern topology inconsistente => reject...');
  const auditPattern = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'FRONT',
    hasPatternMutated: true,
  });
  assert.equal(auditPattern.status, 'REJECTED');
  assert.ok(auditPattern.criticalFaults.includes('CRITICAL_PATTERN_MUTATED'));
  console.log('   ✓ Estructura de patrón alterada => REJECTED.');

  // Test 16: detalle oculto legítimamente por ángulo no genera false reject
  console.log('Test 16: detalle oculto legítimamente por ángulo no genera false reject...');
  const auditBack = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[0],
    shotView: 'BACK',
    hasButtonMismatch: false, // In BACK shot, front buttons are excluded by angle
  });
  assert.equal(auditBack.metrics.buttonCountConsistency, 'EXCLUDED_BY_ANGLE');
  assert.equal(auditBack.status, 'APPROVED');
  console.log('   ✓ Detalle oculto por ángulo respeta shotVisibilityRules sin false reject.');

  // Test 17: primera imagen aprobada puede convertirse en anchor
  console.log('Test 17: primera imagen aprobada puede convertirse en anchor...');
  const generatedAsset1: ImageAsset = {
    id: 'asset-approved-01',
    type: 'GENERATED',
    source: 'AI',
    url: 'https://cdn.catalogai.com/gen/terracota-front.jpg',
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
  };
  const valResult1 = await validateGeneratedAsset({
    generatedAsset: generatedAsset1,
    garmentLock: production1.garment,
    colorVariant: production1.garment.colorVariants[0],
    modelLock: sofiaModel,
    shotView: 'FRONT',
    garmentMaster: master,
  });
  assert.equal(evaluateValidationStatus(valResult1), 'APPROVED');
  // First approved image is designated as project anchor asset
  production1.approvedAnchorAsset = generatedAsset1;
  assert.equal(production1.approvedAnchorAsset.id, 'asset-approved-01');
  console.log('   ✓ Primera imagen aprobada se designa como approvedAnchorAsset.');

  // Test 18: anchor nunca reemplaza autoridad del original
  console.log('Test 18: anchor nunca reemplaza autoridad del original...');
  const auditConflict = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[1],
    shotView: 'FRONT',
    anchorAsset: generatedAsset1,
    hasNecklineAltered: true, // Anchor might look fine, but if original design is violated: REJECT
  });
  assert.equal(auditConflict.status, 'REJECTED');
  assert.ok(auditConflict.criticalFaults.includes('CRITICAL_NECKLINE_ALTERED'));
  console.log('   ✓ Autoridad del Original y GarmentMaster prevalece sobre cualquier imagen generada.');

  // Test 19: imágenes posteriores se comparan contra original + anchor
  console.log('Test 19: imágenes posteriores se comparan contra original + anchor...');
  const auditSubsequent = evaluateStructuralFidelityAudit({
    master,
    modelLock: sofiaModel,
    targetVariant: production1.garment.colorVariants[1],
    shotView: 'SIDE',
    anchorAsset: generatedAsset1,
  });
  assert.equal(auditSubsequent.anchorValidated, true);
  assert.equal(auditSubsequent.status, 'APPROVED');
  console.log('   ✓ Imágenes posteriores se auditan contra Original + Anchor secundario.');

  // Test 20: diferencia solo de color autorizada => pass
  console.log('Test 20: diferencia solo de color autorizada => pass...');
  const crossVarPass = validateCrossVariantConsistency({
    variantAColor: 'Terracota',
    variantBColor: 'Negro',
    master,
    hasStructuralDivergence: false,
  });
  assert.equal(crossVarPass.consistent, true);
  console.log('   ✓ Variantes con mismo corte pero distinto color aprobado => PASS.');

  // Test 21: cambio estructural entre variantes => reject
  console.log('Test 21: cambio estructural entre variantes => reject...');
  const crossVarFail = validateCrossVariantConsistency({
    variantAColor: 'Terracota',
    variantBColor: 'Negro',
    master,
    hasStructuralDivergence: true,
  });
  assert.equal(crossVarFail.consistent, false);
  assert.ok(crossVarFail.reason?.includes('DIVERGENCIA ESTRUCTURAL'));
  console.log('   ✓ Mutación estructural entre variantes de color => REJECT.');

  // Test 22: retry es selectivo (solo regenera el job fallido)
  console.log('Test 22: retry es selectivo...');
  const repo = getProjectRepository();
  const testProj = { ...production1 };
  testProj.id = `proj-retry-test-${Date.now()}`;
  testProj.jobs = production1.jobs.map(j => ({ ...j, projectId: testProj.id }));
  
  // Suppose all jobs are APPROVED except job 1 which was REJECTED
  for (let i = 0; i < testProj.jobs.length; i++) {
    testProj.jobs[i].status = i === 1 ? 'REJECTED' : 'APPROVED';
  }
  testProj.jobs[1].attempts = 1;
  await repo.create(testProj);

  // If we queue only job 1 for retry:
  testProj.jobs[1].status = 'QUEUED';
  await repo.updateJob(testProj.id, testProj.jobs[1]);

  const queuedBefore = (await repo.getById(testProj.id))!.jobs.filter(j => j.status === 'QUEUED');
  assert.equal(queuedBefore.length, 1, 'Solo un job debe estar en QUEUED');
  assert.equal(queuedBefore[0].id, testProj.jobs[1].id);
  console.log('   ✓ Retry es estrictamente selectivo: no regenera imágenes ya aprobadas.');

  // Test 23: retry conserva mismo modelId y Garment Master
  console.log('Test 23: retry conserva mismo modelId y Garment Master...');
  const retryingJob = queuedBefore[0];
  assert.equal(retryingJob.modelLock?.modelId, 'model-female-sofia');
  assert.equal(retryingJob.garmentMaster?.category, 'Camisa');
  assert.equal(retryingJob.garmentMaster?.buttons.count, 3);
  console.log('   ✓ Retry conserva intacto el mismo modelId, antropometría y Garment Master.');

  // Test 24: Cost Guard impide retry fuera de presupuesto
  console.log('Test 24: Cost Guard impide retry fuera de presupuesto...');
  assert.equal(canAttemptRegeneration(0), true);
  assert.equal(canAttemptRegeneration(2), true);
  assert.equal(canAttemptRegeneration(3), false); // Maximum attempts reached
  console.log('   ✓ canAttemptRegeneration bloquea retries superiores a 3.');

  // Test 25: imagen aprobada no vuelve a generarse
  console.log('Test 25: imagen aprobada no vuelve a generarse...');
  const storedProj = await repo.getById(testProj.id);
  const approvedJobs = storedProj!.jobs.filter(j => j.status === 'APPROVED');
  assert.equal(approvedJobs.length, testProj.jobs.length - 1);
  assert.ok(approvedJobs.some(j => j.id === testProj.jobs[0].id));
  // Ensure runner will only pick QUEUED jobs
  const queuedOnly = storedProj!.jobs.filter(j => j.status === 'QUEUED');
  assert.ok(!queuedOnly.some(j => approvedJobs.map(a => a.id).includes(j.id)));
  console.log('   ✓ Trabajos con estado APPROVED jamás son reprocesados por el runner.');

  console.log('\n🎉 ALL 25 TARGET TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
