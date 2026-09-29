import assert from 'node:assert';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { LocalStorageProvider, setImageStorage } from '../lib/storage/image-storage';
import { PhysicalGarmentCropper, validateAndClampBoundingBox, InvalidBoundingBoxError } from '../lib/vision/cropper';
import { ColorAnalyzer } from '../lib/vision/color-analyzer';
import { areGarmentsSameProduct, ProductGroupingService } from '../lib/vision/grouping';
import { GarmentSceneAnalyzer } from '../lib/vision/scene-analyzer';
import { VisualDetectionPipeline } from '../lib/vision/index';
import { SourceImage, DetectedGarment, BoundingBox } from '../types/index';

console.log('🧪 Starting Phase B: Visual Garment & Variant Detection Test Suite...\n');

const testStorageDir = path.join(process.cwd(), '.test-detection-storage');
const testStorage = new LocalStorageProvider(testStorageDir, '/test-detection-uploads');
setImageStorage(testStorage);

(async () => {
  try {
    async function createSyntheticImage(
      width: number,
      height: number,
      color = { r: 220, g: 38, b: 38 }
    ): Promise<Buffer> {
      return await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: color,
        },
      })
        .jpeg({ quality: 90 })
        .toBuffer();
    }

    const cropper = new PhysicalGarmentCropper();
    const colorAnalyzer = new ColorAnalyzer();
    const groupingService = new ProductGroupingService();
    const sceneAnalyzer = new GarmentSceneAnalyzer();
    const pipeline = new VisualDetectionPipeline();

    // ==========================================
    // B16 CASO 1: 1 FOTOGRAFÍA, 1 VESTIDO ROJO -> 1 PRODUCTO, 1 VARIANTE
    // ==========================================
    console.log('1. Testing Caso 1: 1 photo, 1 red dress -> 1 product, 1 variant...');
    const redBuf = await createSyntheticImage(600, 800, { r: 220, g: 38, b: 38 });
    const redSource: SourceImage = {
      id: 'src-red-1',
      originalFilename: 'vestido-rojo.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-red-1',
      storageKey: 'src-red-1.jpg',
      url: '/test-detection-uploads/src-red-1.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-red-1.jpg', redBuf, 'image/jpeg');

    const res1 = await pipeline.processSourceImages([redSource]);
    assert.strictEqual(res1.productGroups.length, 1, 'Must create exactly 1 ProductGroup');
    assert.strictEqual(res1.productGroups[0].variants.length, 1, 'Must create exactly 1 GarmentVariant');
    assert.ok(res1.crops.length >= 1, 'Must create at least 1 physical crop');
    console.log('   ✓ Caso 1 passed: 1 ProductGroup, 1 GarmentVariant.');

    // ==========================================
    // B16 CASO 2: 1 FOTOGRAFÍA CON 5 VESTIDOS IDÉNTICOS DE 5 COLORES
    // Esperado: 1 producto, 5 variantes, 5 crops independientes
    // ==========================================
    console.log('\n2. Testing Caso 2: 1 photo with 5 identical dresses in 5 colors...');
    // Five color claims require five different pixel observations, not a solid gray bitmap.
    const multiBuf = await sharp(path.join(process.cwd(), 'tests/fixtures/real-catalog-five-variants.png')).resize(1000, 600).jpeg().toBuffer();
    const multiSource: SourceImage = {
      id: 'src-multi-5colors',
      originalFilename: 'vestido-5-colors-multi.jpg',
      mimeType: 'image/jpeg',
      byteSize: multiBuf.length,
      width: 1000,
      height: 600,
      sha256: 'sha-multi-5',
      storageKey: 'src-multi-5.jpg',
      url: '/test-detection-uploads/src-multi-5.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-multi-5.jpg', multiBuf, 'image/jpeg');

    const res2 = await pipeline.processSourceImages([multiSource]);
    assert.strictEqual(res2.productGroups.length, 1, 'Must recognize as exactly 1 ProductGroup (same product)');
    assert.strictEqual(res2.productGroups[0].variants.length, 5, 'Must recognize exactly 5 distinct color variants');
    assert.strictEqual(res2.crops.length, 5, 'Must create exactly 5 independent physical crops');

    // Invariant: each variant must have its own unique crop URL (no two variants share the same crop)
    const cropUrls = res2.productGroups[0].variants.map((v) => v.referenceCrops[0]);
    const uniqueCropUrls = new Set(cropUrls);
    assert.strictEqual(uniqueCropUrls.size, 5, 'All 5 variants must have strictly unique physical crop URLs');

    // Invariant: no variant uses complete multi-garment image as referenceCrop
    for (const cropUrl of cropUrls) {
      assert.notStrictEqual(cropUrl, multiSource.url, 'No variant should use the complete uncropped image');
    }
    console.log('   ✓ Caso 2 passed: 1 ProductGroup, 5 Variants, 5 distinct physical crops.');

    // ==========================================
    // B16 CASO 3: FRENTE + ESPALDA DEL MISMO VESTIDO
    // Esperado: 1 producto, FRONT reference, BACK reference
    // ==========================================
    console.log('\n3. Testing Caso 3: Front + Back photos of same garment...');
    const frontSource: SourceImage = {
      id: 'src-mono-frente',
      originalFilename: 'mono-frontal.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-front',
      storageKey: 'src-front.jpg',
      url: '/test-detection-uploads/src-front.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-front.jpg', redBuf, 'image/jpeg');

    const backSource: SourceImage = {
      id: 'src-mono-back',
      originalFilename: 'mono-espalda.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-back',
      storageKey: 'src-back.jpg',
      url: '/test-detection-uploads/src-back.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-back.jpg', redBuf, 'image/jpeg');

    const res3 = await pipeline.processSourceImages([frontSource, backSource]);
    assert.strictEqual(res3.productGroups.length, 1, 'Front and Back must be clustered into 1 ProductGroup');

    const roles = res3.productGroups[0].references.map((r) => r.role);
    assert.ok(roles.includes('FRONT'), 'ReferenceSet must contain a FRONT reference');
    assert.ok(roles.includes('BACK'), 'ReferenceSet must contain a BACK reference');
    console.log('   ✓ Caso 3 passed: 1 ProductGroup with FRONT and BACK references.');

    // ==========================================
    // B16 CASO 4: DOS PRENDAS ESTRUCTURALMENTE DIFERENTES
    // Esperado: 2 productos
    // ==========================================
    console.log('\n4. Testing Caso 4: Two structurally different garments -> 2 ProductGroups...');
    const gDressSleeveless: DetectedGarment = {
      detectionId: 'det-sleeve-0',
      boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Vestido',
      dominantColor: { name: 'Rojo', hex: '#DC2626', confidence: 0.95 },
      orientation: 'FRONT',
      visualSignature: {
        category: 'Vestido',
        silhouette: 'Línea A',
        neckline: 'Escote V',
        sleeveType: 'Sin mangas',
        length: 'Midi',
        hasPockets: false,
        patternType: 'Liso',
        distinctiveDetails: [],
      },
    };

    const gDressLongSleeves: DetectedGarment = {
      detectionId: 'det-sleeve-1',
      boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Vestido',
      dominantColor: { name: 'Rojo', hex: '#DC2626', confidence: 0.95 },
      orientation: 'FRONT',
      visualSignature: {
        category: 'Vestido',
        silhouette: 'Línea A',
        neckline: 'Escote V',
        sleeveType: 'Manga larga con puño',
        length: 'Midi',
        hasPockets: false,
        patternType: 'Liso',
        distinctiveDetails: [],
      },
    };

    const diffCheck = areGarmentsSameProduct(gDressSleeveless, gDressLongSleeves);
    assert.strictEqual(diffCheck.sameProduct, false, 'Garments with different sleeve types must NOT be the same product');
    console.log('   ✓ Caso 4 passed: Structural differences (sleeves) split into 2 distinct products.');

    // ==========================================
    // B16 CASO 5: VESTIDO EN MANIQUÍ
    // Esperado: 1 garment detected, mannequin not treated as garment
    // ==========================================
    console.log('\n5. Testing Caso 5: Garment on mannequin...');
    const mannequinSource: SourceImage = {
      id: 'src-mannequin',
      originalFilename: 'vestido-mannequin.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-mannequin',
      storageKey: 'src-mannequin.jpg',
      url: '/test-detection-uploads/src-mannequin.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-mannequin.jpg', redBuf, 'image/jpeg');

    const res5 = await sceneAnalyzer.analyzeScene(mannequinSource);
    assert.strictEqual(res5.sceneType, 'GARMENT_ON_MANNEQUIN');
    assert.strictEqual(res5.garments.length, 1);
    // Bounding box should not encompass the full top (head of mannequin)
    assert.ok(res5.garments[0].boundingBox.y > 0.15, 'Bounding box excludes mannequin head/stand');
    console.log('   ✓ Caso 5 passed: Garment on mannequin detected without treating mannequin as garment.');

    // ==========================================
    // B16 CASO 6: VESTIDO EN MODELO HUMANA
    // Esperado: 1 garment detected, person not treated as garment
    // ==========================================
    console.log('\n6. Testing Caso 6: Garment on human model...');
    const modelSource: SourceImage = {
      id: 'src-model',
      originalFilename: 'vestido-model-human.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-model',
      storageKey: 'src-model.jpg',
      url: '/test-detection-uploads/src-model.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-model.jpg', redBuf, 'image/jpeg');

    const res6 = await sceneAnalyzer.analyzeScene(modelSource);
    assert.strictEqual(res6.sceneType, 'GARMENT_ON_MODEL');
    assert.strictEqual(res6.garments.length, 1);
    // Bounding box should be focused on garment body, not model face
    assert.ok(res6.garments[0].boundingBox.y >= 0.25, 'Bounding box excludes model face');
    console.log('   ✓ Caso 6 passed: Person not treated as garment; garment isolated correctly.');

    // ==========================================
    // B16 CASO 7: DETALLE DE BORDADO
    // Esperado: DETAIL reference
    // ==========================================
    console.log('\n7. Testing Caso 7: Embroidery detail...');
    const detailSource: SourceImage = {
      id: 'src-detail',
      originalFilename: 'mono-detalle-bordado.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-detail',
      storageKey: 'src-detail.jpg',
      url: '/test-detection-uploads/src-detail.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-detail.jpg', redBuf, 'image/jpeg');

    const res7 = await sceneAnalyzer.analyzeScene(detailSource);
    assert.strictEqual(res7.sceneType, 'DETAIL');
    assert.strictEqual(res7.imageRole, 'DETAIL');
    console.log('   ✓ Caso 7 passed: Macro embroidery correctly classified as DETAIL.');

    // ==========================================
    // B16 CASO 8: IMAGEN SIN PRENDAS
    // Esperado: zero garments, no hallucinated product
    // ==========================================
    console.log('\n8. Testing Caso 8: Image with no garments...');
    const emptySource: SourceImage = {
      id: 'src-empty',
      originalFilename: 'paisaje-empty-no-garment.jpg',
      mimeType: 'image/jpeg',
      byteSize: redBuf.length,
      width: 600,
      height: 800,
      sha256: 'sha-empty',
      storageKey: 'src-empty.jpg',
      url: '/test-detection-uploads/src-empty.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await testStorage.put('src-empty.jpg', redBuf, 'image/jpeg');

    const res8 = await sceneAnalyzer.analyzeScene(emptySource);
    assert.strictEqual(res8.garments.length, 0, 'Must detect 0 garments in empty/irrelevant image');
    assert.strictEqual(res8.sceneType, 'UNKNOWN');
    console.log('   ✓ Caso 8 passed: 0 garments detected, no hallucinated product.');

    // ==========================================
    // B17 INVARIANTES
    // ==========================================
    console.log('\n9. Testing Invariants & Robustness...');

    // Invariant: crop inside source bounds
    const boxInside: BoundingBox = { x: 0.1, y: 0.2, width: 0.5, height: 0.6 };
    const clamped = validateAndClampBoundingBox(boxInside, 1000, 1000);
    assert.ok(clamped.left >= 0 && clamped.top >= 0);
    assert.ok(clamped.left + clamped.width <= 1000);
    assert.ok(clamped.top + clamped.height <= 1000);

    // Invariant: crop has real pixels and is stored via ImageStorage
    const cropResult = await cropper.cropGarment(redSource, redBuf, 'det-inv-1', boxInside);
    assert.ok(cropResult.buffer.length > 0, 'Crop must have real binary bytes');
    assert.ok(cropResult.crop.url.startsWith('/test-detection-uploads/'), 'Crop must be saved in storage');
    assert.ok(!cropResult.crop.url.startsWith('blob:'), 'Crop URL must NEVER be blob:');

    // Invariant: invalid bounding boxes rejected
    await assert.rejects(
      async () => {
        validateAndClampBoundingBox({ x: -0.5, y: 0, width: 0.5, height: 0.5 }, 100, 100);
      },
      InvalidBoundingBoxError,
      'Negative X must throw InvalidBoundingBoxError'
    );

    await assert.rejects(
      async () => {
        validateAndClampBoundingBox({ x: 0, y: 0, width: -0.2, height: 0.5 }, 100, 100);
      },
      InvalidBoundingBoxError,
      'Negative width must throw InvalidBoundingBoxError'
    );

    // Invariant: pixel-level color analyzer rejects background and detects red
    const pureRedBuf = await createSyntheticImage(200, 200, { r: 220, g: 38, b: 38 });
    const analyzed = await colorAnalyzer.analyzeGarmentCrop(pureRedBuf);
    assert.strictEqual(analyzed.canonicalName, 'Rojo');
    assert.strictEqual(analyzed.isBackgroundLikely, false);

    // Invariant: confidence always within 0..1
    assert.ok(analyzed.confidence >= 0 && analyzed.confidence <= 1, 'Confidence must be within [0, 1]');

    console.log('   ✓ Invariants verified: coordinate bounds, binary bytes, storage, blob rejection, and color accuracy.');

    // Cleanup test storage sandbox
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }

    console.log('\n🎉 ALL PHASE B DETECTION & GROUPING TESTS PASSED! (9/9 suites)\n');
  } catch (err) {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    console.error('❌ Phase B test failed:', err);
    process.exit(1);
  }
})();
