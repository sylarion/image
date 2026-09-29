import assert from 'node:assert/strict';
import { 
  MODEL_CATALOG, 
  PRESET_MODELS, 
  DEFAULT_MODEL, 
  getModelById, 
  findModelById, 
  isKnownModelId 
} from '@/lib/constants/models';
import { createSelectedProduction } from '@/lib/production/selection';
import { AnalysisRun } from '@/types';

process.env.AI_MODE = 'mock';
process.env.NODE_ENV = 'test';

async function main() {
  console.log('🧪 Starting Model Catalog Unified Resolution Tests...\n');

  // 1. Resolver modelo válido por ID
  console.log('1. Testing: resolver modelo válido por ID...');
  const sofia = getModelById('model-female-sofia');
  assert.equal(sofia.id, 'model-female-sofia');
  assert.equal(sofia.modelId, 'model-female-sofia');
  assert.equal(sofia.name, 'Sofía');
  assert.equal(sofia.gender, 'Femenino');
  assert.ok(sofia.apparentAge.length > 0);
  assert.ok(sofia.bodyType.length > 0);
  assert.ok(sofia.skinTone.length > 0);
  assert.ok(sofia.hairColor.length > 0);
  assert.ok(sofia.hairLength.length > 0);
  assert.ok(sofia.hairStyle.length > 0);
  assert.ok(sofia.previewUrl.startsWith('http'));
  assert.ok(sofia.description.length > 0);
  assert.ok(Array.isArray(sofia.tags) && sofia.tags.length > 0);

  const mateo = getModelById('model-male-mateo');
  assert.equal(mateo.id, 'model-male-mateo');
  assert.equal(mateo.name, 'Mateo');
  assert.equal(mateo.gender, 'Masculino');

  // Soporta resolución por legacy ID sin romper compatibilidad histórica
  const sofiaLegacy = getModelById('mod-01-sofia');
  assert.equal(sofiaLegacy.id, 'model-female-sofia');
  assert.equal(sofiaLegacy.name, 'Sofía');

  const elena = getModelById('model-female-elena');
  assert.equal(elena.name, 'Elena');

  assert.equal(DEFAULT_MODEL.id, 'model-female-sofia');
  console.log('   ✓ Modelos válidos resueltos correctamente por ID con todos sus atributos requeridos.');

  // 2. modelId inexistente -> error controlado, nunca PRESET_MODELS[undefined]
  console.log('\n2. Testing: modelId inexistente...');
  assert.throws(
    () => getModelById('modelo-inexistente-123'),
    (err: Error) => {
      assert.ok(err.message.includes('MODEL_NOT_FOUND'));
      assert.ok(err.message.includes('modelo-inexistente-123'));
      return true;
    }
  );

  assert.throws(
    () => getModelById(''),
    (err: Error) => {
      assert.ok(err.message.includes('MODEL_NOT_FOUND'));
      return true;
    }
  );

  assert.equal(findModelById('modelo-inexistente-123'), undefined);
  assert.equal(isKnownModelId('modelo-inexistente-123'), false);
  assert.equal(isKnownModelId('model-female-sofia'), true);
  console.log('   ✓ modelId inexistente lanza error controlado (MODEL_NOT_FOUND) y nunca accede por índice undefined.');

  // 3. Clara disponible sin mapeos manuales
  console.log('\n3. Testing: Clara disponible sin mapeos manuales...');
  const clara = getModelById('model-female-clara');
  assert.ok(clara, 'Clara debe existir en el catálogo');
  assert.equal(clara.id, 'model-female-clara');
  assert.equal(clara.modelId, 'model-female-clara');
  assert.equal(clara.name, 'Clara');
  assert.equal(clara.gender, 'Femenino');
  assert.equal(clara.apparentAge, '22-26 años');
  assert.equal(clara.hairColor, 'Rubio ceniza');
  assert.ok(PRESET_MODELS.some((m) => m.id === 'model-female-clara'), 'Clara debe estar presente en PRESET_MODELS');
  assert.ok(MODEL_CATALOG.some((m) => m.id === 'model-female-clara'), 'Clara debe estar presente en MODEL_CATALOG');

  // Resolución por legacy ID
  const claraLegacy = getModelById('mod-03-clara');
  assert.equal(claraLegacy.id, 'model-female-clara');
  console.log('   ✓ Clara disponible en catálogo y resuelta directamente sin mapeos manuales.');

  // 4. Maniquí Invisible no rompe el flujo
  console.log('\n4. Testing: Maniquí Invisible no rompe el flujo...');
  const ghost = getModelById('model-no-model');
  assert.ok(ghost, 'Maniquí invisible debe existir en catálogo');
  assert.equal(ghost.id, 'model-no-model');
  assert.equal(ghost.modelId, 'model-no-model');
  assert.equal(ghost.type, 'NO_MODEL');
  assert.equal(ghost.isGhost, true);
  assert.equal(ghost.gender, 'Unisex');
  assert.ok(ghost.name.includes('Maniquí invisible'));
  assert.ok(ghost.previewUrl.includes('ghost-mannequin.svg'));

  // Test en flujo de selección (createSelectedProduction con mock minimal run)
  const mockRun: AnalysisRun = {
    analysisRunId: 'run-catalog-test',
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    sourceImages: [{
      id: 'img-1',
      storageKey: 'mock/key-1',
      sha256: 'mock-sha256-hash-test',
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
      sha256: 'crop-sha256-hash-test',
      width: 400,
      height: 600,
      url: 'https://storage.test/crop-1.jpg',
      normalizedBbox: [0.1, 0.1, 0.9, 0.9],
      createdAt: new Date().toISOString(),
    }],
    productGroups: [{
      id: 'group-1',
      name: 'Vestido Seda',
      category: 'Vestido',
      visualSignature: {
        dominantColorName: 'Negro',
        distinctiveDetails: ['Cuello V'],
        hasPockets: false,
        patternType: 'Liso',
      },
      garmentDNA: {
        category: 'Vestido',
        silhouette: 'A-Line',
        fitType: 'Regular',
        length: 'Midi',
        neckline: 'V-neck',
        sleeves: 'Sin mangas',
        waistline: 'Natural',
        closure: 'Cierre invisible',
        structuralDetails: [],
        mustPreserve: ['Manga y caída'],
      },
      variants: [{
        id: 'var-1',
        productGroupId: 'group-1',
        color: {
          canonicalName: 'Negro',
          observedName: 'Negro azabache',
          hex: '#000000',
        },
        referenceCrops: ['https://storage.test/crop-1.jpg'],
      }],
    }],
    analyses: [],
    executionMetrics: {
      totalImagesUploaded: 1,
      totalDetectedGarments: 1,
      finalVariantsCount: 1,
      processingDurationMs: 100,
      pipelineSuccess: true,
      detectionExecutionMs: 50,
      reconciliationExecutionMs: 10,
      dnaExtractionExecutionMs: 40,
    },
  };

  const selectionPayload = {
    analysisRunId: 'run-catalog-test',
    products: [{
      productGroupId: 'group-1',
      identity: {
        productGroupId: 'group-1',
        aiSuggestedName: 'Vestido Seda',
        aiSuggestedCategory: 'Vestido',
        confirmedName: 'Vestido Seda Noche',
        confirmedCategory: 'Vestido',
        source: 'USER_CORRECTED' as const,
        confirmedAt: new Date().toISOString(),
      },
      selectedVariantIds: ['var-1'],
      customColorNames: {},
    }],
    shots: ['FRONT' as const],
    destination: 'MERCADO_LIBRE' as const,
    style: 'FONDO_BLANCO' as const,
    modelId: 'model-no-model',
  };

  // Creación con Maniquí Invisible
  const ghostProject = createSelectedProduction(mockRun, selectionPayload);
  assert.equal(ghostProject.model.modelId, 'model-no-model');
  assert.equal(ghostProject.model.gender, 'Unisex');
  assert.ok(ghostProject.model.name.includes('Maniquí invisible'));
  assert.equal(ghostProject.productionSelection.modelId, 'model-no-model');

  // Creación con Clara sin mapeo manual por índice
  const claraProject = createSelectedProduction(mockRun, {
    ...selectionPayload,
    modelId: 'model-female-clara',
  });
  assert.equal(claraProject.model.modelId, 'model-female-clara');
  assert.equal(claraProject.model.name, 'Clara');
  assert.equal(claraProject.productionSelection.modelId, 'model-female-clara');

  // Rechazo de modelo inexistente en createSelectedProduction
  assert.throws(
    () => createSelectedProduction(mockRun, { ...selectionPayload, modelId: 'modelo-fantasma-inexistente' }),
    (err: Error) => {
      assert.ok(err.message.includes('MODEL_NOT_FOUND'));
      return true;
    }
  );

  console.log('   ✓ Maniquí Invisible y Clara funcionan perfectamente en el flujo de producción.');
  console.log('\n🎉 ALL MODEL CATALOG TESTS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('FAILED test:', err);
  process.exit(1);
});
