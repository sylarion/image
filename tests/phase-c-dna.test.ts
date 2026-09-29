import assert from 'node:assert';
import { 
  GarmentDNASchema, 
  GarmentDNA, 
  DNAConflict, 
  GarmentInvariant,
  ProductGroup,
  GarmentCrop
} from '../types';
import { 
  deriveImmutableRules, 
  compileGarmentConstraints, 
  buildValidationContract 
} from '../lib/dna/rules';
import { DNAVersioningService } from '../lib/dna/versioning';
import { StructuralConsensusService } from '../lib/dna/consensus';
import { GarmentDNAAnalyzer } from '../lib/dna/analyzer';

console.log('🧪 Starting Phase C: Garment DNA & Structural Product Lock Test Suite...\n');

async function runPhaseCTests() {
  const analyzer = new GarmentDNAAnalyzer();

  // -------------------------------------------------------------
  // Caso 1: Vestido con 5 botones visibles -> buttons.count = 5 VERIFIED/HIGH
  // -------------------------------------------------------------
  console.log('1. Testing Caso 1: Garment with 5 visible buttons -> buttons.count = 5 (VERIFIED)...');
  {
    const mockProductGroup: ProductGroup = {
      id: 'prod-buttons-5',
      name: 'Vestido Camisero 5-button',
      category: 'Vestido',
      variants: [],
      references: [
        {
          id: 'ref-btn-front',
          productGroupId: 'prod-buttons-5',
          role: 'FRONT',
          sourceImageId: 'src-btn-1',
          cropId: 'crop-btn-1',
          confidence: 0.96,
        },
      ],
      visualSignature: {
        category: 'Vestido',
        silhouette: 'Línea A',
        neckline: 'Camisero',
        sleeveType: 'Manga corta',
        length: 'Midi',
        hasPockets: false,
        patternType: 'Liso',
        distinctiveDetails: ['Cartera frontal con 5 botones de pasta al tono'],
      },
      confidence: 0.95,
    };

    const mockCrops: GarmentCrop[] = [
      {
        id: 'crop-btn-1',
        sourceImageId: 'src-btn-1',
        detectionId: 'det-1',
        storageKey: 'uploads/crop-btn.webp',
        url: '/uploads/crop-btn.webp',
        width: 800,
        height: 1200,
        sha256: 'abc123btn',
        boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      },
    ];

    const { dna } = await analyzer.extractDNA({
      productGroup: mockProductGroup,
      crops: mockCrops,
    });

    assert.strictEqual(dna.buttons.count, 5, 'Debe detectar exactamente 5 botones');
    assert.strictEqual(dna.buttons.visible, true, 'Los botones deben estar marcados como visibles');
    assert.strictEqual(dna.buttons.status, 'VERIFIED', 'El estado debe ser VERIFIED');
    assert.ok(dna.buttons.confidence >= 0.9, 'La confianza debe ser >= 0.9');

    // Comprobar que se generó la regla inmutable HARD
    const buttonRule = dna.immutableRules.find((r) => r.property === 'buttons.count');
    assert.ok(buttonRule, 'Debe existir una regla inmutable para buttons.count');
    assert.strictEqual(buttonRule.expectedValue, 5);
    assert.strictEqual(buttonRule.severity, 'HARD');

    console.log('   ✓ Caso 1 passed: buttons.count = 5 correctly verified as HARD rule.');
  }

  // -------------------------------------------------------------
  // Caso 2: Misma prenda en 3 colores -> 1 GarmentDNA, 3 GarmentVariants
  // -------------------------------------------------------------
  console.log('\n2. Testing Caso 2: Same product across 3 colorways -> exactly 1 GarmentDNA...');
  {
    const mockGroupMultiColor: ProductGroup = {
      id: 'prod-multicolor-dress',
      name: 'Vestido Solero Clásico',
      category: 'Vestido',
      variants: [
        {
          id: 'var-red',
          productGroupId: 'prod-multicolor-dress',
          color: { canonicalName: 'Rojo', observedName: 'Rojo Carmín', hex: '#DC2626', confidence: 0.95 },
          referenceCrops: ['/uploads/crop-red.webp'],
          sourceImageIds: ['src-1'],
        },
        {
          id: 'var-black',
          productGroupId: 'prod-multicolor-dress',
          color: { canonicalName: 'Negro', observedName: 'Negro Noche', hex: '#18181B', confidence: 0.96 },
          referenceCrops: ['/uploads/crop-black.webp'],
          sourceImageIds: ['src-1'],
        },
        {
          id: 'var-beige',
          productGroupId: 'prod-multicolor-dress',
          color: { canonicalName: 'Beige', observedName: 'Beige Arena', hex: '#D4D4D8', confidence: 0.94 },
          referenceCrops: ['/uploads/crop-beige.webp'],
          sourceImageIds: ['src-1'],
        },
      ],
      references: [
        { id: 'ref-1', productGroupId: 'prod-multicolor-dress', role: 'FRONT', sourceImageId: 'src-1', confidence: 0.95 },
      ],
      visualSignature: {
        category: 'Vestido',
        silhouette: 'Línea A',
        neckline: 'Escote V',
        sleeveType: 'Sin mangas',
        length: 'Midi',
        hasPockets: true,
        patternType: 'Liso',
        distinctiveDetails: [],
      },
      confidence: 0.95,
    };

    const mockCrops: GarmentCrop[] = [
      {
        id: 'crop-multi-1',
        sourceImageId: 'src-1',
        detectionId: 'det-1',
        storageKey: 'uploads/crop-multi.webp',
        url: '/uploads/crop-multi.webp',
        width: 1000,
        height: 1200,
        sha256: 'multihash123',
        boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      },
    ];

    const { dna } = await analyzer.extractDNA({
      productGroup: mockGroupMultiColor,
      crops: mockCrops,
    });

    assert.strictEqual(mockGroupMultiColor.variants.length, 3, 'Deben existir 3 variantes');
    assert.strictEqual(dna.productGroupId, 'prod-multicolor-dress', 'El DNA debe pertenecer al ProductGroup común');
    assert.strictEqual(dna.version, 1, 'Debe generarse un único GarmentDNA compartido');

    console.log('   ✓ Caso 2 passed: 3 variants share 1 unique GarmentDNA.');
  }

  // -------------------------------------------------------------
  // Caso 3: FRONT + BACK -> DNA fusiona ambas referencias
  // -------------------------------------------------------------
  console.log('\n3. Testing Caso 3: FRONT + BACK references -> fused evidence in single DNA...');
  {
    const mockGroupFrontBack: ProductGroup = {
      id: 'prod-fb',
      name: 'Mono Estructurado',
      category: 'Mono',
      variants: [],
      references: [
        { id: 'ref-f', productGroupId: 'prod-fb', role: 'FRONT', sourceImageId: 'src-f', cropId: 'crop-f', confidence: 0.95 },
        { id: 'ref-b', productGroupId: 'prod-fb', role: 'BACK', sourceImageId: 'src-b', cropId: 'crop-b', confidence: 0.94 },
      ],
      visualSignature: {
        category: 'Mono',
        silhouette: 'Estructurado',
        neckline: 'Halter',
        sleeveType: 'Sin mangas',
        length: 'Largo tobillero',
        hasPockets: true,
        patternType: 'Liso',
        distinctiveDetails: [],
      },
      confidence: 0.95,
    };

    const mockCrops: GarmentCrop[] = [
      {
        id: 'crop-f',
        sourceImageId: 'src-f',
        detectionId: 'det-f',
        storageKey: 'uploads/crop-f.webp',
        url: '/uploads/crop-f.webp',
        width: 800,
        height: 1200,
        sha256: 'hashf',
        boundingBox: { x: 0, y: 0, width: 1, height: 1 },
      },
      {
        id: 'crop-b',
        sourceImageId: 'src-b',
        detectionId: 'det-b',
        storageKey: 'uploads/crop-b.webp',
        url: '/uploads/crop-b.webp',
        width: 800,
        height: 1200,
        sha256: 'hashb',
        boundingBox: { x: 0, y: 0, width: 1, height: 1 },
      },
    ];

    const { dna } = await analyzer.extractDNA({
      productGroup: mockGroupFrontBack,
      crops: mockCrops,
    });

    const frontEv = dna.evidence.find((e) => e.role === 'FRONT');
    const backEv = dna.evidence.find((e) => e.role === 'BACK');

    assert.ok(frontEv, 'Debe existir evidencia FRONT');
    assert.ok(backEv, 'Debe existir evidencia BACK');
    assert.strictEqual(dna.closures.status, 'VERIFIED', 'Con referencia BACK, closures debe ser VERIFIED');
    assert.notStrictEqual(dna.closures.types[0], 'UNKNOWN', 'Closures no debe ser UNKNOWN cuando hay foto trasera');

    console.log('   ✓ Caso 3 passed: FRONT + BACK successfully fused; back closures verified.');
  }

  // -------------------------------------------------------------
  // Caso 4: Sólo FRONT -> Campos traseros = UNKNOWN
  // -------------------------------------------------------------
  console.log('\n4. Testing Caso 4: FRONT only -> rear fields strictly marked as UNKNOWN...');
  {
    const mockGroupFrontOnly: ProductGroup = {
      id: 'prod-front-only',
      name: 'Vestido Frente',
      category: 'Vestido',
      variants: [],
      references: [
        { id: 'ref-f1', productGroupId: 'prod-front-only', role: 'FRONT', sourceImageId: 'src-f1', cropId: 'crop-f1', confidence: 0.95 },
      ],
      visualSignature: {
        category: 'Vestido',
        silhouette: 'Línea A',
        neckline: 'Escote V',
        sleeveType: 'Sin mangas',
        length: 'Corto',
        hasPockets: false,
        patternType: 'Liso',
        distinctiveDetails: [],
      },
      confidence: 0.95,
    };

    const { dna } = await analyzer.extractDNA({
      productGroup: mockGroupFrontOnly,
      crops: [
        {
          id: 'crop-f1',
          sourceImageId: 'src-f1',
          detectionId: 'det-1',
          storageKey: 'uploads/crop.webp',
          url: '/uploads/crop.webp',
          width: 800,
          height: 1000,
          sha256: 'hashfront',
          boundingBox: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    });

    assert.strictEqual(dna.closures.status, 'UNKNOWN', 'Sin referencia trasera, closures debe ser UNKNOWN');
    assert.strictEqual(dna.closures.types[0], 'UNKNOWN', 'No debe inventar cierres traseros sin evidencia');

    console.log('   ✓ Caso 4 passed: Rear features marked UNKNOWN without hallucinations.');
  }

  // -------------------------------------------------------------
  // Caso 5: Referencias contradictorias -> DNAConflict
  // -------------------------------------------------------------
  console.log('\n5. Testing Caso 5: Contradictory observations -> DNAConflict detected...');
  {
    const observations = [
      { referenceId: 'crop-front-1', role: 'FRONT', value: 5, confidence: 0.95 },
      { referenceId: 'crop-detail-1', role: 'DETAIL', value: 5, confidence: 0.94 },
      { referenceId: 'crop-alt-1', role: 'FRONT', value: 4, confidence: 0.88 },
    ];

    const result = StructuralConsensusService.resolveCategoricalProperty('buttons.count', observations);

    assert.strictEqual(result.consensus.status, 'CONFLICT', 'Debe marcar status CONFLICT ante discrepancias');
    assert.ok(result.conflict, 'Debe generar el objeto DNAConflict explícito');
    assert.strictEqual(result.conflict.severity, 'HARD');
    assert.strictEqual(result.conflict.observations.length, 3);

    console.log('   ✓ Caso 5 passed: Contradiction properly flagged as HARD DNAConflict.');
  }

  // -------------------------------------------------------------
  // Caso 6: Bordado localizado -> SurfaceDecoration con placement y evidencia
  // -------------------------------------------------------------
  console.log('\n6. Testing Caso 6: Localized embroidery -> SurfaceDecoration with placement & evidence...');
  {
    const mockGroupEmbroidery: ProductGroup = {
      id: 'prod-emb',
      name: 'Camisa Bordada',
      category: 'Camisa',
      variants: [],
      references: [
        { id: 'ref-e', productGroupId: 'prod-emb', role: 'DETAIL', sourceImageId: 'src-e', cropId: 'crop-e', confidence: 0.95 },
      ],
      visualSignature: {
        category: 'Camisa',
        silhouette: 'Recta',
        neckline: 'Camisero',
        sleeveType: 'Manga larga',
        length: 'Estándar',
        hasPockets: false,
        patternType: 'Bordado floral en pechera',
        distinctiveDetails: ['Bordado artesanal en pechera y cuello'],
      },
      confidence: 0.95,
    };

    const { dna } = await analyzer.extractDNA({
      productGroup: mockGroupEmbroidery,
      crops: [
        {
          id: 'crop-e',
          sourceImageId: 'src-e',
          detectionId: 'det-e',
          storageKey: 'uploads/crop-e.webp',
          url: '/uploads/crop-e.webp',
          width: 600,
          height: 600,
          sha256: 'hashemb',
          boundingBox: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    });

    assert.ok(dna.embroidery.length > 0, 'Debe registrarse el elemento de bordado');
    const item = dna.embroidery[0];
    assert.strictEqual(item.kind, 'EMBROIDERY');
    assert.ok(item.placement.includes('pechera'), 'Debe incluir placement pechera');
    assert.ok(item.evidenceReferenceIds.includes('crop-e'), 'Debe preservar el cropId como evidencia');

    console.log('   ✓ Caso 6 passed: Embroidery placement and evidence preserved.');
  }

  // -------------------------------------------------------------
  // Caso 7: Bolsillos laterales x2 -> pockets.count = 2
  // -------------------------------------------------------------
  console.log('\n7. Testing Caso 7: Lateral pockets x2 -> pockets.count = 2...');
  {
    const mockGroupPockets: ProductGroup = {
      id: 'prod-pockets',
      name: 'Pantalón Cargo',
      category: 'Pantalón',
      variants: [],
      references: [
        { id: 'ref-p', productGroupId: 'prod-pockets', role: 'FRONT', sourceImageId: 'src-p', cropId: 'crop-p', confidence: 0.95 },
      ],
      visualSignature: {
        category: 'Pantalón',
        silhouette: 'Holgado',
        neckline: 'N/A',
        sleeveType: 'N/A',
        length: 'Largo',
        hasPockets: true,
        patternType: 'Liso',
        distinctiveDetails: ['2 bolsillos laterales en costura'],
      },
      confidence: 0.95,
    };

    const { dna } = await analyzer.extractDNA({
      productGroup: mockGroupPockets,
      crops: [
        {
          id: 'crop-p',
          sourceImageId: 'src-p',
          detectionId: 'det-p',
          storageKey: 'uploads/crop-p.webp',
          url: '/uploads/crop-p.webp',
          width: 800,
          height: 1200,
          sha256: 'hashpoc',
          boundingBox: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
    });

    assert.strictEqual(dna.pockets.count, 2, 'Debe contar 2 bolsillos');
    assert.strictEqual(dna.pockets.status, 'VERIFIED');

    console.log('   ✓ Caso 7 passed: 2 lateral pockets detected and verified.');
  }

  // -------------------------------------------------------------
  // Caso 8: Usuario corrige button_count -> DNAChangeLog registrado
  // -------------------------------------------------------------
  console.log('\n8. Testing Caso 8: Manual user edit -> DNAChangeLog audit entry created...');
  {
    const initialDNA: GarmentDNA = GarmentDNASchema.parse({
      id: 'dna-prod-test-v1',
      productGroupId: 'prod-test',
      version: 1,
      category: 'Vestido',
      silhouette: { type: 'A_LINE', confidence: 0.95, status: 'VERIFIED' },
      neckline: { type: 'V_NECK', depth: 'MEDIUM', confidence: 0.95, status: 'VERIFIED' },
      sleeves: { present: false, length: 'SLEEVELESS', confidence: 0.95, status: 'VERIFIED' },
      buttons: { count: 4, placement: ['frente'], visible: true, confidence: 0.85, status: 'VERIFIED' },
      pockets: { count: 0, placement: [], type: [], confidence: 0.9, status: 'VERIFIED' },
      closures: { types: ['cierre'], placements: ['espalda'], confidence: 0.9, status: 'VERIFIED' },
      length: { class: 'Midi', confidence: 0.9, status: 'VERIFIED' },
      waist: { type: 'Entallada', confidence: 0.9, status: 'VERIFIED' },
      hem: { shape: 'Recto', asymmetry: false, confidence: 0.9, status: 'VERIFIED' },
      materialAppearance: { texture: ['lino'], drape: 'Fluido', opacity: 'Opaco', sheen: 'Mate', confidence: 0.9, status: 'VERIFIED' },
      geometry: {},
      immutableRules: [],
      evidence: [],
      conflicts: [],
      auditTrail: [],
      confidence: 0.92,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const { updatedDNA, changeLog } = DNAVersioningService.applyUpdate(initialDNA, {
      property: 'buttons.count',
      newValue: 5,
      source: 'USER',
      reason: 'El usuario contó 5 botones físicamente en el detalle ampliado',
    });

    assert.strictEqual(updatedDNA.version, 2, 'La versión debe incrementarse a 2');
    assert.strictEqual(updatedDNA.previousVersionId, 'dna-prod-test-v1', 'Debe enlazar a la versión anterior');
    assert.strictEqual(updatedDNA.buttons.count, 5, 'El valor nuevo debe ser 5');
    assert.strictEqual(changeLog.previousValue, 4);
    assert.strictEqual(changeLog.newValue, 5);
    assert.strictEqual(changeLog.source, 'USER');
    assert.strictEqual(updatedDNA.auditTrail.length, 1);

    // Comprobar que initialDNA no fue mutado in-place
    assert.strictEqual(initialDNA.version, 1);
    assert.strictEqual(initialDNA.buttons.count, 4);

    console.log('   ✓ Caso 8 passed: Manual edit created immutable v2 with DNAChangeLog.');
  }

  // -------------------------------------------------------------
  // Caso 9: Nueva referencia agregada -> version incrementada y previo preservado
  // -------------------------------------------------------------
  console.log('\n9. Testing Caso 9: New reference image added -> version increment, previous preserved...');
  {
    const v1: GarmentDNA = GarmentDNASchema.parse({
      id: 'dna-prod-v1',
      productGroupId: 'prod-test',
      version: 1,
      category: 'Mono',
      silhouette: { type: 'STRAIGHT', confidence: 0.9, status: 'VERIFIED' },
      neckline: { type: 'Halter', depth: 'MEDIUM', confidence: 0.9, status: 'VERIFIED' },
      sleeves: { present: false, length: 'SLEEVELESS', confidence: 0.9, status: 'VERIFIED' },
      buttons: { count: null, placement: [], visible: false, confidence: 0.9, status: 'UNKNOWN' },
      pockets: { count: 0, placement: [], type: [], confidence: 0.9, status: 'VERIFIED' },
      closures: { types: ['UNKNOWN'], placements: ['UNKNOWN'], confidence: 0.5, status: 'UNKNOWN' },
      length: { class: 'Largo', confidence: 0.9, status: 'VERIFIED' },
      waist: { type: 'Natural', confidence: 0.9, status: 'VERIFIED' },
      hem: { shape: 'Recto', asymmetry: false, confidence: 0.9, status: 'VERIFIED' },
      materialAppearance: { texture: ['seda'], drape: 'Fluido', opacity: 'Opaco', sheen: 'Brillante', confidence: 0.85, status: 'VERIFIED' },
      geometry: {},
      immutableRules: [],
      evidence: [{ referenceId: 'crop-front', role: 'FRONT', supports: ['neckline'], confidence: 0.95 }],
      conflicts: [],
      auditTrail: [],
      confidence: 0.9,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const v2 = DNAVersioningService.createNewVersionWithEvidence(
      v1,
      {
        closures: { types: ['cierre invisible posterior'], placements: ['espalda'], confidence: 0.95, status: 'VERIFIED' },
        evidence: [
          ...v1.evidence,
          { referenceId: 'crop-back', role: 'BACK', supports: ['closures'], confidence: 0.96 },
        ],
      },
      'Foto de espalda incorporada a la producción'
    );

    assert.strictEqual(v2.version, 2);
    assert.strictEqual(v2.previousVersionId, 'dna-prod-v1');
    assert.strictEqual(v2.closures.status, 'VERIFIED');
    assert.strictEqual(v2.evidence.length, 2);
    assert.strictEqual(v1.version, 1, 'v1 debe permanecer inmutable');

    console.log('   ✓ Caso 9 passed: DNA version incremented smoothly with previous state preserved.');
  }

  // -------------------------------------------------------------
  // Test de Invariantes & Compiladores (C18, C19, C21)
  // -------------------------------------------------------------
  console.log('\n10. Testing Invariants, Compilers & Validation Contracts...');
  {
    const sampleDNA: GarmentDNA = GarmentDNASchema.parse({
      id: 'dna-full-v1',
      productGroupId: 'prod-full',
      version: 1,
      category: 'Vestido',
      silhouette: { type: 'A_LINE', confidence: 0.95, status: 'VERIFIED' },
      neckline: { type: 'Escote V', depth: 'MEDIUM', confidence: 0.95, status: 'VERIFIED' },
      sleeves: { present: false, length: 'SLEEVELESS', confidence: 0.95, status: 'VERIFIED' },
      buttons: { count: 5, placement: ['pechera'], visible: true, confidence: 0.95, status: 'VERIFIED' },
      pockets: { count: 2, placement: ['laterales'], type: ['invisibles'], confidence: 0.9, status: 'VERIFIED' },
      closures: { types: ['cierre invisible'], placements: ['espalda'], confidence: 0.9, status: 'VERIFIED' },
      length: { class: 'Midi', confidence: 0.95, status: 'VERIFIED' },
      waist: { type: 'Entallada', confidence: 0.9, status: 'VERIFIED' },
      hem: { shape: 'Recto', asymmetry: false, confidence: 0.95, status: 'VERIFIED' },
      materialAppearance: { texture: ['lino'], drape: 'Fluido', opacity: 'Opaco', sheen: 'Mate', confidence: 0.85, status: 'VERIFIED' },
      geometry: { necklineDepthRatio: 0.2, garmentLengthRatio: 0.8 },
      immutableRules: [],
      evidence: [{ referenceId: 'crop-1', role: 'FRONT', supports: ['neckline'], confidence: 0.95 }],
      conflicts: [],
      auditTrail: [],
      confidence: 0.95,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    sampleDNA.immutableRules = deriveImmutableRules(sampleDNA);

    // Reglas inmutables
    const hardRules = sampleDNA.immutableRules.filter((r) => r.severity === 'HARD');
    assert.ok(hardRules.length >= 4, 'Deben existir al menos 4 reglas HARD (buttons, neckline, sleeves, pockets)');

    // Compilación de constraints (Fase D prep)
    const promptConstraints = compileGarmentConstraints(sampleDNA);
    assert.ok(promptConstraints.some((c) => c.includes('5 buttons')), 'Debe compilar constraint de 5 botones');
    assert.ok(promptConstraints.some((c) => c.includes('Sleeveless')), 'Debe compilar constraint sleeveless');

    // Contrato de validación (Validador prep)
    const validationContract = buildValidationContract(sampleDNA);
    assert.strictEqual(validationContract.productGroupId, 'prod-full');
    assert.ok(validationContract.hardInvariants.length > 0);
    assert.ok(validationContract.softInvariants.length > 0);

    console.log('   ✓ Invariants verified: rules, prompt constraints and validation contracts compiled successfully.');
  }

  console.log('\n🎉 ALL PHASE C GARMENT DNA & STRUCTURAL LOCK TESTS PASSED! (10/10 suites)\n');
}

runPhaseCTests().catch((err) => {
  console.error('\n❌ Phase C Test Suite Failure:', err);
  process.exit(1);
});
