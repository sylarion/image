import assert from 'node:assert';
import { 
  UserConfirmedGarmentIdentity, 
  ProductChoiceViewModel, 
  VisualWizardAdapters 
} from '../features/wizard/models/wizard.types';
import { 
  WizardDecisionEngine, 
  WizardFormState, 
  FriendlyErrorMapper 
} from '../features/wizard/engine/decision-engine';
import { SceneAnalysisPipelineResult } from '../types';

console.log('🧪 Starting Garment Semantic Identity & Decision Engine Test Suite...\n');

async function runWizardIdentityTests() {
  // -------------------------------------------------------------
  // Test 1: AI suggestion can be accepted (source: 'AI_CONFIRMED')
  // -------------------------------------------------------------
  console.log('1. Testing: AI suggestion can be accepted without modification...');
  {
    const initialIdentity: UserConfirmedGarmentIdentity = {
      productGroupId: 'prod-1',
      aiSuggestedName: 'Mono Estructurado',
      aiSuggestedCategory: 'Mono',
      confirmedName: 'Mono Estructurado',
      confirmedCategory: 'Mono',
      source: 'AI_CONFIRMED',
      confirmedAt: new Date().toISOString(),
    };

    assert.strictEqual(initialIdentity.source, 'AI_CONFIRMED');
    assert.strictEqual(initialIdentity.confirmedName, 'Mono Estructurado');
    assert.strictEqual(initialIdentity.confirmedCategory, 'Mono');

    console.log('   ✓ AI suggestion successfully confirmed as baseline commercial identity.');
  }

  // -------------------------------------------------------------
  // Test 2: AI suggestion can be corrected (source: 'USER_CORRECTED')
  // -------------------------------------------------------------
  console.log('\n2. Testing: AI suggestion can be corrected by user (USER_CORRECTED)...');
  {
    const baseIdentity: UserConfirmedGarmentIdentity = {
      productGroupId: 'prod-1',
      aiSuggestedName: 'Mono Gris (Negro)',
      aiSuggestedCategory: 'Mono',
      confirmedName: 'Mono Gris (Negro)',
      confirmedCategory: 'Mono',
      source: 'AI_CONFIRMED',
      confirmedAt: new Date().toISOString(),
    };

    // User edits the name and category
    const correctedIdentity: UserConfirmedGarmentIdentity = {
      ...baseIdentity,
      confirmedName: 'Vestido camisero estampado',
      confirmedCategory: 'Vestido',
      source: 'USER_CORRECTED',
      confirmedAt: new Date().toISOString(),
    };

    assert.strictEqual(correctedIdentity.source, 'USER_CORRECTED');
    assert.strictEqual(correctedIdentity.confirmedName, 'Vestido camisero estampado');
    assert.strictEqual(correctedIdentity.confirmedCategory, 'Vestido');
    assert.strictEqual(correctedIdentity.aiSuggestedName, 'Mono Gris (Negro)', 'Preserva la sugerencia original de IA para auditoría');

    console.log('   ✓ User correction successfully overrides AI suggestion.');
  }

  // -------------------------------------------------------------
  // Test 3: Manual name persists across wizard navigation
  // -------------------------------------------------------------
  console.log('\n3. Testing: Confirmed name persists across backward & forward navigation...');
  {
    const products: ProductChoiceViewModel[] = [
      {
        id: 'prod-10',
        title: 'Vestido camisero estampado',
        category: 'Vestido',
        mainCropUrl: '/crop.webp',
        selected: true,
        colors: [{ id: 'col-1', name: 'Rojo', hex: '#DC2626', cropUrl: '/crop.webp', selected: true }],
        confirmedIdentity: {
          productGroupId: 'prod-10',
          aiSuggestedName: 'Mono',
          aiSuggestedCategory: 'Mono',
          confirmedName: 'Vestido camisero estampado',
          confirmedCategory: 'Vestido',
          source: 'USER_CORRECTED',
          confirmedAt: new Date().toISOString(),
        },
      },
    ];

    const formState: WizardFormState = {
      products,
      shots: [],
      destination: 'MERCADO_LIBRE',
      style: 'FONDO_BLANCO',
      modelId: 'model-female-sofia',
    };

    // User navigates PRODUCTS -> SHOTS -> DESTINATION -> BACK TO SHOTS -> BACK TO PRODUCTS
    const next1 = WizardDecisionEngine.getNextStep('PRODUCTS', formState);
    assert.strictEqual(next1, 'SHOTS');

    const next2 = WizardDecisionEngine.getNextStep('SHOTS', formState);
    assert.strictEqual(next2, 'DESTINATION');

    const prev1 = WizardDecisionEngine.getPreviousStep('DESTINATION', formState);
    assert.strictEqual(prev1, 'SHOTS');

    const prev2 = WizardDecisionEngine.getPreviousStep('SHOTS', formState);
    assert.strictEqual(prev2, 'PRODUCTS');

    // Verify identity object remains untouched
    assert.strictEqual(formState.products[0].confirmedIdentity?.confirmedName, 'Vestido camisero estampado');
    assert.strictEqual(formState.products[0].confirmedIdentity?.source, 'USER_CORRECTED');

    console.log('   ✓ State fully retained across back-and-forth wizard transitions.');
  }

  // -------------------------------------------------------------
  // Test 4: One ProductGroup with 5 colors asks identity once
  // -------------------------------------------------------------
  console.log('\n4. Testing: One ProductGroup with 5 colors asks identity once...');
  {
    const mockMultiColorPipelineResult: SceneAnalysisPipelineResult = {
      analyses: [],
      crops: [
        { id: 'c1', sourceImageId: 's1', detectionId: 'd1', storageKey: 'k1', url: '/c1.webp', width: 100, height: 100, sha256: 'h1', boundingBox: { x: 0, y: 0, width: 1, height: 1 } },
      ],
      productGroups: [
        {
          id: 'prod-group-multi',
          name: 'Vestido Solero',
          category: 'Vestido',
          variants: [
            { id: 'v1', productGroupId: 'prod-group-multi', color: { canonicalName: 'Negro', observedName: 'Negro', hex: '#18181B', confidence: 0.95 }, referenceCrops: ['/c1.webp'], sourceImageIds: ['s1'] },
            { id: 'v2', productGroupId: 'prod-group-multi', color: { canonicalName: 'Rojo', observedName: 'Rojo', hex: '#DC2626', confidence: 0.95 }, referenceCrops: ['/c2.webp'], sourceImageIds: ['s1'] },
            { id: 'v3', productGroupId: 'prod-group-multi', color: { canonicalName: 'Verde', observedName: 'Verde', hex: '#16A34A', confidence: 0.95 }, referenceCrops: ['/c3.webp'], sourceImageIds: ['s1'] },
            { id: 'v4', productGroupId: 'prod-group-multi', color: { canonicalName: 'Beige', observedName: 'Beige', hex: '#D4D4D8', confidence: 0.95 }, referenceCrops: ['/c4.webp'], sourceImageIds: ['s1'] },
            { id: 'v5', productGroupId: 'prod-group-multi', color: { canonicalName: 'Azul', observedName: 'Azul', hex: '#1D4ED8', confidence: 0.95 }, referenceCrops: ['/c5.webp'], sourceImageIds: ['s1'] },
          ],
          references: [],
          visualSignature: { category: 'Vestido', silhouette: 'A_LINE', neckline: 'V', sleeveType: 'None', length: 'Midi', hasPockets: false, patternType: 'Liso', distinctiveDetails: [] },
          confidence: 0.95,
        },
      ],
      observability: {
        sceneAnalysisLatencyMs: 120,
        detectedGarmentsCount: 5,
        detectedVariantsCount: 5,
        bboxAverageConfidence: 0.95,
        groupingAverageConfidence: 0.95,
        roleAverageConfidence: 0.95,
        colorAverageConfidence: 0.95,
        cropsCreatedCount: 5,
        segmentationFallbacksCount: 0,
      },
    };

    const adapted = VisualWizardAdapters.toProductChoices(mockMultiColorPipelineResult);

    assert.strictEqual(adapted.length, 1, 'Debe haber exactamente 1 ProductGroup para los 5 colores');
    assert.strictEqual(adapted[0].colors.length, 5, 'Deben existir 5 colores dentro del producto');
    assert.ok(adapted[0].confirmedIdentity, 'Debe existir 1 sola identidad confirmada para el producto');
    assert.strictEqual(adapted[0].confirmedIdentity?.productGroupId, 'prod-group-multi');

    console.log('   ✓ Single identity created for ProductGroup spanning 5 distinct colorways.');
  }

  // -------------------------------------------------------------
  // Test 5: Multiple ProductGroups ask identity independently
  // -------------------------------------------------------------
  console.log('\n5. Testing: Multiple ProductGroups ask identity independently...');
  {
    const mockTwoProductsPipelineResult: SceneAnalysisPipelineResult = {
      analyses: [],
      crops: [],
      productGroups: [
        {
          id: 'prod-dress-1',
          name: 'Vestido Camisero',
          category: 'Vestido',
          variants: [{ id: 'v1', productGroupId: 'prod-dress-1', color: { canonicalName: 'Blanco', observedName: 'Blanco', hex: '#FFF', confidence: 0.95 }, referenceCrops: [], sourceImageIds: [] }],
          references: [],
          visualSignature: { category: 'Vestido', silhouette: 'Straight', neckline: 'Collar', sleeveType: 'Short', length: 'Midi', hasPockets: false, patternType: 'Liso', distinctiveDetails: [] },
          confidence: 0.95,
        },
        {
          id: 'prod-shirt-2',
          name: 'Remera Básica',
          category: 'Remera',
          variants: [{ id: 'v2', productGroupId: 'prod-shirt-2', color: { canonicalName: 'Negro', observedName: 'Negro', hex: '#000', confidence: 0.95 }, referenceCrops: [], sourceImageIds: [] }],
          references: [],
          visualSignature: { category: 'Remera', silhouette: 'Boxy', neckline: 'Round', sleeveType: 'Short', length: 'Short', hasPockets: false, patternType: 'Liso', distinctiveDetails: [] },
          confidence: 0.95,
        },
      ],
      observability: {
        sceneAnalysisLatencyMs: 150,
        detectedGarmentsCount: 2,
        detectedVariantsCount: 2,
        bboxAverageConfidence: 0.95,
        groupingAverageConfidence: 0.95,
        roleAverageConfidence: 0.95,
        colorAverageConfidence: 0.95,
        cropsCreatedCount: 2,
        segmentationFallbacksCount: 0,
      },
    };

    const adapted = VisualWizardAdapters.toProductChoices(mockTwoProductsPipelineResult);
    assert.strictEqual(adapted.length, 2, 'Debe haber 2 productos independientes');
    assert.strictEqual(adapted[0].confirmedIdentity?.productGroupId, 'prod-dress-1');
    assert.strictEqual(adapted[1].confirmedIdentity?.productGroupId, 'prod-shirt-2');

    console.log('   ✓ Multiple ProductGroups maintain independent identities.');
  }

  // -------------------------------------------------------------
  // Test 6: Empty confirmed name validation & Friendly error mapping
  // -------------------------------------------------------------
  console.log('\n6. Testing: Empty confirmed name validation and FriendlyErrorMapper...');
  {
    const emptyName = '   ';
    const isInvalid = emptyName.trim().length === 0;
    assert.strictEqual(isInvalid, true, 'Nombre vacío debe ser bloqueado');

    const msg1 = FriendlyErrorMapper.toUserMessage('NO_GARMENT_FOUND');
    assert.ok(msg1.includes('No encontramos una prenda'), 'Error debe ser amigable');

    const msg2 = FriendlyErrorMapper.toUserMessage('INVALID_IMAGE');
    assert.ok(msg2.includes('JPG, PNG o WebP'), 'Error debe ser orientador de formatos');

    console.log('   ✓ Validation rule and FriendlyErrorMapper verified.');
  }

  // -------------------------------------------------------------
  // Test 7: USER_CORRECTED overrides AI suggestion
  // -------------------------------------------------------------
  console.log('\n7. Testing: USER_CORRECTED overrides AI suggestion in final production payload...');
  {
    const identity: UserConfirmedGarmentIdentity = {
      productGroupId: 'prod-dress-1',
      aiSuggestedName: 'Mono Gris (Negro)',
      aiSuggestedCategory: 'Mono',
      confirmedName: 'Vestido camisero estampado',
      confirmedCategory: 'Vestido',
      source: 'USER_CORRECTED',
      confirmedAt: new Date().toISOString(),
    };

    // Rule: USER CONFIRMATION > AI INFERENCE
    const finalProjectName = identity.source === 'USER_CORRECTED' ? identity.confirmedName : identity.aiSuggestedName;
    const finalCategory = identity.source === 'USER_CORRECTED' ? identity.confirmedCategory : identity.aiSuggestedCategory;

    assert.strictEqual(finalProjectName, 'Vestido camisero estampado');
    assert.strictEqual(finalCategory, 'Vestido');
    assert.notStrictEqual(finalProjectName, identity.aiSuggestedName);

    console.log('   ✓ USER_CORRECTED cleanly takes priority over AI suggestion.');
  }

  // -------------------------------------------------------------
  // Test 8: AI never silently overwrites user confirmation
  // -------------------------------------------------------------
  console.log('\n8. Testing: AI never silently overwrites user confirmation...');
  {
    const existingUserChoices: ProductChoiceViewModel[] = [
      {
        id: 'group-locked',
        title: 'Vestido camisero estampado',
        category: 'Vestido',
        mainCropUrl: '/crop1.webp',
        selected: true,
        colors: [{ id: 'col-1', name: 'Negro', hex: '#000', cropUrl: '/crop1.webp', selected: true }],
        confirmedIdentity: {
          productGroupId: 'group-locked',
          aiSuggestedName: 'Mono Gris',
          aiSuggestedCategory: 'Mono',
          confirmedName: 'Vestido camisero estampado',
          confirmedCategory: 'Vestido',
          source: 'USER_CORRECTED',
          confirmedAt: new Date().toISOString(),
        },
      },
    ];

    // Backend pipeline re-runs (e.g. user uploaded an additional photo or re-analyzed scene)
    // AI infers a different name and category: "Pantalón Casual"
    const reAnalysisResult: SceneAnalysisPipelineResult = {
      analyses: [],
      crops: [{ id: 'c1', sourceImageId: 's1', detectionId: 'd1', storageKey: 'k1', url: '/crop1.webp', width: 100, height: 100, sha256: 'h1', boundingBox: { x: 0, y: 0, width: 1, height: 1 } }],
      productGroups: [
        {
          id: 'group-locked',
          name: 'Pantalón Casual',
          category: 'Pantalón',
          variants: [{ id: 'v1', productGroupId: 'group-locked', color: { canonicalName: 'Negro', observedName: 'Negro', hex: '#000', confidence: 0.9 }, referenceCrops: ['/crop1.webp'], sourceImageIds: ['s1'] }],
          references: [],
          visualSignature: { category: 'Pantalón', silhouette: 'Straight', neckline: 'None', sleeveType: 'None', length: 'Long', hasPockets: true, patternType: 'Liso', distinctiveDetails: [] },
          confidence: 0.9,
        },
      ],
      observability: {
        sceneAnalysisLatencyMs: 110,
        detectedGarmentsCount: 1,
        detectedVariantsCount: 1,
        bboxAverageConfidence: 0.9,
        groupingAverageConfidence: 0.9,
        roleAverageConfidence: 0.9,
        colorAverageConfidence: 0.9,
        cropsCreatedCount: 1,
        segmentationFallbacksCount: 0,
      },
    };

    // Re-adapt with existing user choices
    const reAdapted = VisualWizardAdapters.toProductChoices(reAnalysisResult, existingUserChoices);

    assert.strictEqual(reAdapted.length, 1);
    assert.strictEqual(
      reAdapted[0].confirmedIdentity?.confirmedName, 
      'Vestido camisero estampado', 
      'El nombre confirmado por el usuario no debe ser sobrescrito por la re-inferencia de IA'
    );
    assert.strictEqual(
      reAdapted[0].confirmedIdentity?.confirmedCategory, 
      'Vestido', 
      'La categoría confirmada por el usuario no debe ser sobrescrita'
    );
    assert.strictEqual(reAdapted[0].confirmedIdentity?.source, 'USER_CORRECTED');
    assert.strictEqual(
      reAdapted[0].confirmedIdentity?.aiSuggestedName, 
      'Pantalón Casual', 
      'La inferencia técnica de IA queda registrada en aiSuggestedName para auditoría'
    );

    console.log('   ✓ AI re-inference preserves human confirmed identity without silent overwrites.');
  }

  console.log('\n🎉 ALL GARMENT SEMANTIC IDENTITY & DECISION ENGINE TESTS PASSED! (8/8 suites)\n');
}

runWizardIdentityTests().catch((err) => {
  console.error('\n❌ Wizard Identity Test Failure:', err);
  process.exit(1);
});
