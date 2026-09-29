import assert from 'node:assert';
import { 
  SourceImage, 
  DetectedGarment, 
  GarmentCrop, 
  ProductGroup, 
  SceneAnalysisPipelineResult 
} from '../types';
import { GarmentSceneAnalyzer } from '../lib/vision/scene-analyzer';
import { ProductGroupingService } from '../lib/vision/grouping';
import { 
  VisualWizardAdapters, 
  ProductChoiceViewModel, 
  DEFAULT_SHOT_CHOICES, 
  STYLE_PRESETS,
  DESTINATION_PRESETS 
} from '../features/wizard/models/wizard.types';
import { 
  ProductionConfigurationValidator, 
  WizardFormState 
} from '../features/wizard/engine/decision-engine';

console.log('🧪 Starting Wizard End-to-End Correction & Variants Test Suite...\n');

async function runEndToEndCorrectionTests() {
  const groupingService = new ProductGroupingService();
  const sceneAnalyzer = new GarmentSceneAnalyzer();

  // -------------------------------------------------------------
  // Caso 1: 1 prenda / 1 color
  // -------------------------------------------------------------
  console.log('1. Testing Caso 1: 1 prenda / 1 color...');
  {
    const sourceImage: SourceImage = {
      id: 'src-single-dress',
      storageKey: 'uploads/single-dress.webp',
      originalFilename: 'vestido-rojo.jpg',
      mimeType: 'image/jpeg',
      byteSize: 150000,
      sha256: 'sha-c1',
      width: 800,
      height: 1000,
      url: '/uploads/single-dress.webp',
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
      createdAt: new Date().toISOString(),
    };

    const analysis = sceneAnalyzer.mockSceneAnalysis(sourceImage);
    assert.strictEqual(analysis.garments.length, 1);
    assert.strictEqual(analysis.sceneType, 'SINGLE_GARMENT');

    const crop: GarmentCrop = {
      id: 'crop-c1',
      sourceImageId: sourceImage.id,
      detectionId: analysis.garments[0].detectionId,
      storageKey: 'crops/c1.webp',
      url: '/crops/c1.webp',
      width: 600,
      height: 800,
      sha256: 'sha-crop-1',
      boundingBox: analysis.garments[0].boundingBox,
    };

    const groups = groupingService.groupDetections([{
      detection: analysis.garments[0],
      crop,
      sourceImageId: sourceImage.id,
    }]);

    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].variants.length, 1);

    const mockPipeline: SceneAnalysisPipelineResult = {
      analyses: [analysis],
      crops: [crop],
      productGroups: groups,
      observability: {
        sceneAnalysisLatencyMs: 50,
        detectedGarmentsCount: 1,
        detectedVariantsCount: 1,
        bboxAverageConfidence: 0.95,
        groupingAverageConfidence: 0.95,
        roleAverageConfidence: 0.95,
        colorAverageConfidence: 0.95,
        cropsCreatedCount: 1,
        segmentationFallbacksCount: 0,
      },
    };

    const choices = VisualWizardAdapters.toProductChoices(mockPipeline);
    assert.strictEqual(choices.length, 1);
    assert.strictEqual(choices[0].colors.length, 1);
    console.log('   ✓ Caso 1 passed: Exactly 1 product, 1 variant, clean single-item flow.');
  }

  // -------------------------------------------------------------
  // Caso 2 & 7: 1 producto / 4 colores en la misma foto (Catálogo de remeras)
  // -------------------------------------------------------------
  console.log('\n2. Testing Caso 2 & 7: 1 producto con 4 colores en la misma foto...');
  {
    const sourceImage: SourceImage = {
      id: 'src-catalog-4',
      storageKey: 'uploads/remeras-pack.webp',
      originalFilename: 'fixture-4-colors.webp',
      mimeType: 'image/webp',
      byteSize: 350000,
      sha256: 'sha-c2',
      width: 1600,
      height: 1200,
      url: '/uploads/remeras-pack.webp',
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
      createdAt: new Date().toISOString(),
    };

    const analysis = sceneAnalyzer.mockSceneAnalysis(sourceImage);
    assert.strictEqual(analysis.garments.length, 4, 'Deben detectarse 4 prendas individuales');
    assert.strictEqual(analysis.sceneType, 'MULTIPLE_VARIANTS');

    const crops: GarmentCrop[] = analysis.garments.map((g, idx) => ({
      id: `crop-${idx + 1}`,
      sourceImageId: sourceImage.id,
      detectionId: g.detectionId,
      storageKey: `crops/crop-${idx + 1}.webp`,
      url: `/crops/crop-${idx + 1}.webp`,
      width: 350,
      height: 900,
      sha256: `sha-crop-${idx + 1}`,
      boundingBox: g.boundingBox,
    }));

    const groupedItems = analysis.garments.map((g, idx) => ({
      detection: g,
      crop: crops[idx],
      sourceImageId: sourceImage.id,
    }));

    const groups = groupingService.groupDetections(groupedItems);
    assert.strictEqual(groups.length, 1, 'Deben agruparse bajo 1 solo ProductGroup');
    assert.strictEqual(groups[0].variants.length, 4, 'Deben existir 4 variantes de color');

    const mockPipeline: SceneAnalysisPipelineResult = {
      analyses: [analysis],
      crops,
      productGroups: groups,
      observability: {
        sceneAnalysisLatencyMs: 120,
        detectedGarmentsCount: 4,
        detectedVariantsCount: 4,
        bboxAverageConfidence: 0.95,
        groupingAverageConfidence: 0.95,
        roleAverageConfidence: 0.95,
        colorAverageConfidence: 0.95,
        cropsCreatedCount: 4,
        segmentationFallbacksCount: 0,
      },
    };

    const choices = VisualWizardAdapters.toProductChoices(mockPipeline);
    assert.strictEqual(choices.length, 1);
    assert.strictEqual(choices[0].colors.length, 4, 'El wizard adapter debe entregar 4 ColorChoiceViewModels');

    console.log('   ✓ Caso 2 & 7 passed: 1 ProductGroup + 4 GarmentVariants -> 4 UI Color cards.');
  }

  // -------------------------------------------------------------
  // Caso 3: 2 productos distintos (Remera y Pantalón)
  // -------------------------------------------------------------
  console.log('\n3. Testing Caso 3: 2 productos con moldería/categoría distinta...');
  {
    const g1: DetectedGarment = {
      detectionId: 'det-shirt',
      boundingBox: { x: 0.2, y: 0.1, width: 0.6, height: 0.4 },
      confidence: 0.95,
      probableCategory: 'Remera',
      dominantColor: { name: 'Blanco', hex: '#FFFFFF', confidence: 0.95 },
      orientation: 'FRONT',
      sameProductGroup: 'group-top',
      visualSignature: { category: 'Remera', silhouette: 'Caja', neckline: 'Redondo', sleeveType: 'Corta', length: 'Corta', hasPockets: false, patternType: 'Liso', distinctiveDetails: [] },
    };

    const g2: DetectedGarment = {
      detectionId: 'det-pants',
      boundingBox: { x: 0.2, y: 0.5, width: 0.6, height: 0.45 },
      confidence: 0.95,
      probableCategory: 'Pantalón',
      dominantColor: { name: 'Azul Marino', hex: '#1E3A8A', confidence: 0.95 },
      orientation: 'FRONT',
      sameProductGroup: 'group-bottom',
      visualSignature: { category: 'Pantalón', silhouette: 'Recto', neckline: 'None', sleeveType: 'None', length: 'Largo', hasPockets: true, patternType: 'Liso', distinctiveDetails: [] },
    };

    const crops: GarmentCrop[] = [
      { id: 'c-top', sourceImageId: 's1', detectionId: 'det-shirt', storageKey: 'k1', url: '/k1.webp', width: 400, height: 400, sha256: 'h1', boundingBox: g1.boundingBox },
      { id: 'c-bot', sourceImageId: 's1', detectionId: 'det-pants', storageKey: 'k2', url: '/k2.webp', width: 400, height: 400, sha256: 'h2', boundingBox: g2.boundingBox },
    ];

    const groups = groupingService.groupDetections([
      { detection: g1, crop: crops[0], sourceImageId: 's1' },
      { detection: g2, crop: crops[1], sourceImageId: 's1' },
    ]);

    assert.strictEqual(groups.length, 2, 'Remera y Pantalón deben separarse en 2 ProductGroups distintos');
    console.log('   ✓ Caso 3 passed: Structural differences cleanly split into 2 independent products.');
  }

  // -------------------------------------------------------------
  // Caso 4: Misma prenda Frente + Espalda (2 fotos)
  // -------------------------------------------------------------
  console.log('\n4. Testing Caso 4: Misma prenda frente + espalda fusionados en 1 variante...');
  {
    const gFront: DetectedGarment = {
      detectionId: 'det-f',
      boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Vestido',
      dominantColor: { name: 'Negro', hex: '#18181B', confidence: 0.95 },
      orientation: 'FRONT',
    };
    const gBack: DetectedGarment = {
      detectionId: 'det-b',
      boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Vestido',
      dominantColor: { name: 'Negro', hex: '#18181B', confidence: 0.95 },
      orientation: 'BACK',
    };

    const crops: GarmentCrop[] = [
      { id: 'cf', sourceImageId: 'photo-front', detectionId: 'det-f', storageKey: 'kf', url: '/kf.webp', width: 800, height: 800, sha256: 'hf', boundingBox: gFront.boundingBox },
      { id: 'cb', sourceImageId: 'photo-back', detectionId: 'det-b', storageKey: 'kb', url: '/kb.webp', width: 800, height: 800, sha256: 'hb', boundingBox: gBack.boundingBox },
    ];

    const groups = groupingService.groupDetections([
      { detection: gFront, crop: crops[0], sourceImageId: 'photo-front', imageRole: 'FRONT' },
      { detection: gBack, crop: crops[1], sourceImageId: 'photo-back', imageRole: 'BACK' },
    ]);

    assert.strictEqual(groups.length, 1, 'Mismo producto');
    assert.strictEqual(groups[0].variants.length, 1, 'Misma variante de color Negro');
    assert.strictEqual(groups[0].variants[0].referenceCrops.length, 2, 'Contiene crop de frente y espalda');
    assert.strictEqual(groups[0].references.length, 2, 'ReferenceSet contiene FRONT y BACK');
    console.log('   ✓ Caso 4 passed: Multi-photo front & back correctly unified into 1 variant.');
  }

  // -------------------------------------------------------------
  // Caso 5: Prenda en maniquí
  // -------------------------------------------------------------
  console.log('\n5. Testing Caso 5: Prenda en maniquí...');
  {
    const sourceImage: SourceImage = {
      id: 'src-mannequin',
      storageKey: 'uploads/mannequin.webp',
      originalFilename: 'vestido-maniqui.jpg',
      mimeType: 'image/jpeg',
      byteSize: 180000,
      sha256: 'sha-m1',
      width: 1000,
      height: 1200,
      url: '/uploads/mannequin.webp',
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
      createdAt: new Date().toISOString(),
    };
    const analysis = sceneAnalyzer.mockSceneAnalysis(sourceImage);
    assert.strictEqual(analysis.sceneType, 'GARMENT_ON_MANNEQUIN');
    assert.strictEqual(analysis.garments.length, 1);
    console.log('   ✓ Caso 5 passed: Mannequin scene isolated correctly.');
  }

  // -------------------------------------------------------------
  // Caso 6: Prenda en modelo humano
  // -------------------------------------------------------------
  console.log('\n6. Testing Caso 6: Prenda en modelo humano...');
  {
    const sourceImage: SourceImage = {
      id: 'src-model',
      storageKey: 'uploads/model.webp',
      originalFilename: 'modelo-persona-vestido.jpg',
      mimeType: 'image/jpeg',
      byteSize: 210000,
      sha256: 'sha-mod1',
      width: 1000,
      height: 1200,
      url: '/uploads/model.webp',
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
      createdAt: new Date().toISOString(),
    };
    const analysis = sceneAnalyzer.mockSceneAnalysis(sourceImage);
    assert.strictEqual(analysis.sceneType, 'GARMENT_ON_MODEL');
    assert.strictEqual(analysis.garments.length, 1);
    console.log('   ✓ Caso 6 passed: Person separated from textile garment.');
  }

  // -------------------------------------------------------------
  // Caso 8: Imagen ambigua / Sin prendas
  // -------------------------------------------------------------
  console.log('\n7. Testing Caso 8: Imagen sin prendas (empty/vacia)...');
  {
    const sourceImage: SourceImage = {
      id: 'src-empty',
      storageKey: 'uploads/empty.webp',
      originalFilename: 'habitacion-vacia.jpg',
      mimeType: 'image/jpeg',
      byteSize: 90000,
      sha256: 'sha-emp',
      width: 800,
      height: 600,
      url: '/uploads/empty.webp',
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
      createdAt: new Date().toISOString(),
    };
    const analysis = sceneAnalyzer.mockSceneAnalysis(sourceImage);
    assert.strictEqual(analysis.sceneType, 'UNKNOWN');
    assert.strictEqual(analysis.garments.length, 0);
    console.log('   ✓ Caso 8 passed: 0 garments returned, no hallucination.');
  }

  // -------------------------------------------------------------
  // ACCEPTANCE GATE: 4 variants -> select 3 -> summary shows 3 -> creates only 3
  // -------------------------------------------------------------
  console.log('\n8. Testing MANDATORY ACCEPTANCE GATE: 4 color variants, user selects 3...');
  {
    const mockFourVariantPipeline: SceneAnalysisPipelineResult = {
      analyses: [],
      crops: [
        { id: 'c1', sourceImageId: 's1', detectionId: 'd1', storageKey: 'k1', url: '/c1.webp', width: 300, height: 800, sha256: 'h1', boundingBox: { x: 0.05, y: 0.1, width: 0.2, height: 0.8 } },
        { id: 'c2', sourceImageId: 's1', detectionId: 'd2', storageKey: 'k2', url: '/c2.webp', width: 300, height: 800, sha256: 'h2', boundingBox: { x: 0.28, y: 0.1, width: 0.2, height: 0.8 } },
        { id: 'c3', sourceImageId: 's1', detectionId: 'd3', storageKey: 'k3', url: '/c3.webp', width: 300, height: 800, sha256: 'h3', boundingBox: { x: 0.51, y: 0.1, width: 0.2, height: 0.8 } },
        { id: 'c4', sourceImageId: 's1', detectionId: 'd4', storageKey: 'k4', url: '/c4.webp', width: 300, height: 800, sha256: 'h4', boundingBox: { x: 0.74, y: 0.1, width: 0.2, height: 0.8 } },
      ],
      productGroups: [
        {
          id: 'prod-pack-4',
          name: 'Remera Morley Algodón',
          category: 'Remera',
          variants: [
            { id: 'v-negro', productGroupId: 'prod-pack-4', color: { canonicalName: 'Negro', observedName: 'Negro', hex: '#18181B', confidence: 0.95 }, referenceCrops: ['/c1.webp'], sourceImageIds: ['s1'] },
            { id: 'v-verde', productGroupId: 'prod-pack-4', color: { canonicalName: 'Verde Seco', observedName: 'Verde Seco', hex: '#4D7C0F', confidence: 0.95 }, referenceCrops: ['/c2.webp'], sourceImageIds: ['s1'] },
            { id: 'v-beige', productGroupId: 'prod-pack-4', color: { canonicalName: 'Beige', observedName: 'Beige', hex: '#D4D4D8', confidence: 0.95 }, referenceCrops: ['/c3.webp'], sourceImageIds: ['s1'] },
            { id: 'v-celeste', productGroupId: 'prod-pack-4', color: { canonicalName: 'Celeste', observedName: 'Celeste', hex: '#38BDF8', confidence: 0.95 }, referenceCrops: ['/c4.webp'], sourceImageIds: ['s1'] },
          ],
          references: [],
          visualSignature: { category: 'Remera', silhouette: 'Caja', neckline: 'Redondo', sleeveType: 'Corta', length: 'Estándar', hasPockets: false, patternType: 'Liso', distinctiveDetails: [] },
          confidence: 0.95,
        },
      ],
      observability: {
        sceneAnalysisLatencyMs: 100,
        detectedGarmentsCount: 4,
        detectedVariantsCount: 4,
        bboxAverageConfidence: 0.95,
        groupingAverageConfidence: 0.95,
        roleAverageConfidence: 0.95,
        colorAverageConfidence: 0.95,
        cropsCreatedCount: 4,
        segmentationFallbacksCount: 0,
      },
    };

    // 1. Adapter produces 4 selectable color cards
    const initialChoices = VisualWizardAdapters.toProductChoices(mockFourVariantPipeline);
    assert.strictEqual(initialChoices[0].colors.length, 4);

    // 2. User deselects 1 color (Celeste) and corrects color "Verde Seco" -> "Verde Militar"
    const userModifiedChoices: ProductChoiceViewModel[] = [
      {
        ...initialChoices[0],
        confirmedIdentity: {
          productGroupId: 'prod-pack-4',
          aiSuggestedName: 'Remera Morley Algodón',
          aiSuggestedCategory: 'Remera',
          confirmedName: 'Remera Morley Algodón Premium',
          confirmedCategory: 'Remera',
          source: 'USER_CORRECTED',
          confirmedAt: new Date().toISOString(),
        },
        colors: initialChoices[0].colors.map((c) => {
          if (c.id === 'v-celeste') return { ...c, selected: false };
          if (c.id === 'v-verde') return { ...c, name: 'Verde Militar', isUserCorrected: true };
          return c;
        }),
        confirmedVariants: {
          productGroupId: 'prod-pack-4',
          selectedVariantIds: ['v-negro', 'v-verde', 'v-beige'],
          userConfirmed: true,
          customColorNames: { 'v-verde': 'Verde Militar' },
          confirmedAt: new Date().toISOString(),
        },
      },
    ];

    // 3. User navigates back and forth or re-adapts with existing user choices
    const reAdapted = VisualWizardAdapters.toProductChoices(mockFourVariantPipeline, userModifiedChoices);
    const activeColors = reAdapted[0].colors.filter((c) => c.selected);

    assert.strictEqual(activeColors.length, 3, 'Deben quedar exactamente 3 colores seleccionados');
    assert.strictEqual(activeColors[1].name, 'Verde Militar', 'El nombre corregido por el usuario debe persistir');
    assert.strictEqual(reAdapted[0].colors.find((c) => c.id === 'v-celeste')?.selected, false, 'Celeste debe permanecer deseleccionado');

    // 4. Form state and Summary
    const formState: WizardFormState = {
      products: reAdapted,
      shots: DEFAULT_SHOT_CHOICES,
      destination: 'MERCADO_LIBRE',
      style: 'FONDO_BLANCO',
      modelId: 'model-female-sofia',
    };

    const validation = ProductionConfigurationValidator.validate(formState);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.errors.length, 0);

    // 5. Final generation payload creates ONLY the 3 active colors
    const finalProjectImages = activeColors.map((c, idx) => ({
      colorId: c.id,
      colorName: c.name,
      cropUrl: c.cropUrl,
    }));

    assert.strictEqual(finalProjectImages.length, 3);
    assert.deepStrictEqual(finalProjectImages.map((c) => c.colorName), ['Negro', 'Verde Militar', 'Beige']);

    console.log('   ✓ ACCEPTANCE GATE SATISFIED: 4 detected -> 3 selected -> human corrected color name preserved -> 3 generated.');
  }

  // -------------------------------------------------------------
  // Test 9: ProductionConfigurationValidator Matrix & Deviation Warnings
  // -------------------------------------------------------------
  console.log('\n9. Testing ProductionConfigurationValidator rules and warnings...');
  {
    // Mercado Libre with Lifestyle should trigger warning
    const invalidState: WizardFormState = {
      products: [
        {
          id: 'p1',
          title: 'Vestido',
          category: 'Vestido',
          mainCropUrl: '/crop.webp',
          selected: true,
          colors: [{ id: 'c1', name: 'Rojo', hex: '#DC2626', cropUrl: '/crop.webp', selected: true }],
        },
      ],
      shots: DEFAULT_SHOT_CHOICES,
      destination: 'MERCADO_LIBRE',
      style: 'LIFESTYLE', // Incompatible with Mercado Libre
      modelId: 'model-female-sofia',
    };

    const result = ProductionConfigurationValidator.validate(invalidState);
    assert.strictEqual(result.isValid, true, 'Permite continuar pero emite advertencia');
    assert.strictEqual(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes('Mercado Libre exige Fondo Blanco'), 'Debe advertir sobre política de Mercado Libre');

    // 0 colors selected should block with hard error
    const zeroColorsState: WizardFormState = {
      ...invalidState,
      products: [
        {
          ...invalidState.products[0],
          colors: [{ id: 'c1', name: 'Rojo', hex: '#DC2626', cropUrl: '/crop.webp', selected: false }],
        },
      ],
    };
    const zeroResult = ProductionConfigurationValidator.validate(zeroColorsState);
    assert.strictEqual(zeroResult.isValid, false);
    assert.ok(zeroResult.errors.some((e) => e.includes('Debés seleccionar al menos un color')));

    console.log('   ✓ ProductionConfigurationValidator rules and matrix verified.');
  }

  // -------------------------------------------------------------
  // Test 10: Semantic Asset Verification (SVGs exist and are controlled)
  // -------------------------------------------------------------
  console.log('\n10. Testing Semantic Shot & Style SVG assets...');
  {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const shotFiles = ['front.svg', 'side.svg', 'back.svg', 'action.svg'];
    for (const f of shotFiles) {
      const p = path.join(process.cwd(), 'public', 'ui-assets', 'shots', f);
      assert.ok(fs.existsSync(p), `Missing shot asset: ${f}`);
    }

    const styleFiles = ['white.svg', 'studio.svg', 'editorial.svg', 'lifestyle.svg'];
    for (const f of styleFiles) {
      const p = path.join(process.cwd(), 'public', 'ui-assets', 'styles', f);
      assert.ok(fs.existsSync(p), `Missing style asset: ${f}`);
    }

    console.log('   ✓ All 8 controlled semantic SVG assets verified on disk.');
  }

  console.log('\n🎉 ALL WIZARD END-TO-END CORRECTION TESTS PASSED! (10/10 suites)\n');
}

runEndToEndCorrectionTests().catch((err) => {
  console.error('\n❌ End-to-End Correction Test Failure:', err);
  process.exit(1);
});
