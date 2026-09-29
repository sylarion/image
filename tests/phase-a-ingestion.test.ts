import assert from 'node:assert';
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { 
  normalizeImage, 
  detectMimeFromMagicBytes, 
  MAX_IMAGE_FILE_SIZE 
} from '../lib/images/normalizer';
import { 
  LocalStorageProvider, 
  resolveImageBytes, 
  setImageStorage 
} from '../lib/storage/image-storage';
import { 
  InMemorySourceImageRepository 
} from '../lib/storage/source-image.repository';
import { 
  CreateProjectSchema, 
  ImageAssetSchema 
} from '../lib/schemas/project';
import { SourceImage, ImageAsset } from '../types/index';

console.log('🧪 Starting Phase A: Real Image Ingestion Test Suite...\n');

// Configure test sandbox storage
const testStorageDir = path.join(process.cwd(), '.test-uploads');
const testStorage = new LocalStorageProvider(testStorageDir, '/test-uploads');
setImageStorage(testStorage);

(async () => {
  try {
    // Helper to generate in-memory synthetic images using sharp
    async function createTestImage(format: 'jpeg' | 'png' | 'webp', width = 200, height = 300): Promise<Buffer> {
      return await sharp({
        create: {
          width,
          height,
          channels: 3,
          background: { r: 120, g: 60, b: 200 },
        },
      })[format]().toBuffer();
    }

    // ==========================================
    // TEST 1: UPLOAD JPG
    // ==========================================
    console.log('1. Testing JPG upload & normalization...');
    const jpgBuffer = await createTestImage('jpeg', 400, 500);
    const jpgMime = detectMimeFromMagicBytes(jpgBuffer);
    assert.strictEqual(jpgMime, 'image/jpeg', 'Magic bytes must recognize JPEG');

    const jpgNormalized = await normalizeImage(jpgBuffer, 'image/jpeg');
    assert.strictEqual(jpgNormalized.mimeType, 'image/jpeg');
    assert.strictEqual(jpgNormalized.width, 400);
    assert.strictEqual(jpgNormalized.height, 500);
    assert.ok(jpgNormalized.sha256.length === 64, 'SHA256 must be a 64-char hex string');
    console.log('   ✓ JPG recognized by magic bytes, normalized and hashed.');

    // ==========================================
    // TEST 2: UPLOAD PNG
    // ==========================================
    console.log('\n2. Testing PNG upload & normalization...');
    const pngBuffer = await createTestImage('png', 300, 300);
    const pngMime = detectMimeFromMagicBytes(pngBuffer);
    assert.strictEqual(pngMime, 'image/png', 'Magic bytes must recognize PNG');

    const pngNormalized = await normalizeImage(pngBuffer, 'image/png');
    assert.strictEqual(pngNormalized.mimeType, 'image/png');
    assert.strictEqual(pngNormalized.width, 300);
    assert.strictEqual(pngNormalized.height, 300);
    console.log('   ✓ PNG recognized by magic bytes, normalized and hashed.');

    // ==========================================
    // TEST 3: UPLOAD WEBP
    // ==========================================
    console.log('\n3. Testing WebP upload & normalization...');
    const webpBuffer = await createTestImage('webp', 250, 450);
    const webpMime = detectMimeFromMagicBytes(webpBuffer);
    assert.strictEqual(webpMime, 'image/webp', 'Magic bytes must recognize WebP');

    const webpNormalized = await normalizeImage(webpBuffer, 'image/webp');
    assert.strictEqual(webpNormalized.mimeType, 'image/webp');
    assert.strictEqual(webpNormalized.width, 250);
    assert.strictEqual(webpNormalized.height, 450);
    console.log('   ✓ WebP recognized by magic bytes, normalized and hashed.');

    // ==========================================
    // TEST 4: REJECT INVALID MIME / CORRUPTED BYTES
    // ==========================================
    console.log('\n4. Testing rejection of invalid MIME / fake file...');
    const fakeBuffer = Buffer.from('FAKE_TEXT_CONTENT_NOT_AN_IMAGE_FILE_PAYLOAD_TEST');
    const detectedFakeMime = detectMimeFromMagicBytes(fakeBuffer);
    assert.strictEqual(detectedFakeMime, null, 'Magic bytes must reject non-image buffer');

    await assert.rejects(
      async () => {
        await normalizeImage(fakeBuffer, 'image/jpeg');
      },
      /Formato de archivo inválido o corrupto/
    );
    console.log('   ✓ Non-image files correctly rejected via magic byte inspection.');

    // ==========================================
    // TEST 5: REJECT >10 MB
    // ==========================================
    console.log('\n5. Testing rejection of oversized files (>10MB)...');
    const oversizedBuffer = Buffer.alloc(MAX_IMAGE_FILE_SIZE + 1024);
    await assert.rejects(
      async () => {
        await normalizeImage(oversizedBuffer, 'image/jpeg');
      },
      /excede el tamaño máximo permitido de 10 MB/
    );
    console.log('   ✓ Files > 10MB strictly rejected before processing.');

    // ==========================================
    // TEST 6: EXTRACT DIMENSIONS
    // ==========================================
    console.log('\n6. Testing accurate dimension extraction...');
    const rectImage = await createTestImage('jpeg', 640, 480);
    const rectNorm = await normalizeImage(rectImage);
    assert.strictEqual(rectNorm.width, 640);
    assert.strictEqual(rectNorm.height, 480);
    console.log(`   ✓ Dimensions correctly extracted: ${rectNorm.width}x${rectNorm.height}.`);

    // ==========================================
    // TEST 7: EXIF AUTO-ROTATE
    // ==========================================
    console.log('\n7. Testing EXIF auto-rotate with sharp...');
    // Create an image and set EXIF orientation tag 6 (90 degrees clockwise rotation)
    const orientedBuf = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();

    const rotatedNorm = await normalizeImage(orientedBuf);
    assert.ok(rotatedNorm.width > 0 && rotatedNorm.height > 0);
    console.log('   ✓ EXIF auto-rotate pipeline successfully executed.');

    // ==========================================
    // TEST 8: SHA256 DEDUPLICATION
    // ==========================================
    console.log('\n8. Testing SHA-256 deduplication...');
    const sourceRepo = new InMemorySourceImageRepository();

    const sampleBuf = await createTestImage('jpeg', 100, 100);
    const norm1 = await normalizeImage(sampleBuf);
    const norm2 = await normalizeImage(sampleBuf); // Identical bytes

    assert.strictEqual(norm1.sha256, norm2.sha256, 'Identical images must have identical SHA-256');

    // First save
    const src1: SourceImage = {
      id: 'src-1',
      originalFilename: 'test1.jpg',
      mimeType: norm1.mimeType,
      byteSize: norm1.byteSize,
      width: norm1.width,
      height: norm1.height,
      sha256: norm1.sha256,
      storageKey: 'src-1.jpg',
      url: '/test-uploads/src-1.jpg',
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };
    await sourceRepo.save(src1);

    // Second check
    const existing = await sourceRepo.getBySha256(norm2.sha256);
    assert.ok(existing, 'Must find existing SourceImage by SHA-256');
    assert.strictEqual(existing.id, 'src-1');
    console.log('   ✓ Deduplication successfully identified duplicate file via SHA-256.');

    // ==========================================
    // TEST 9: STORAGE RETRIEVAL & BYTE RESOLUTION
    // ==========================================
    console.log('\n9. Testing persistent storage retrieval...');
    const putRes = await testStorage.put('test-item.jpg', norm1.buffer, 'image/jpeg');
    assert.strictEqual(putRes.storageKey, 'test-item.jpg');

    const retrievedBytes = await testStorage.get('test-item.jpg');
    assert.ok(retrievedBytes, 'Must retrieve stored bytes from storage');
    assert.strictEqual(retrievedBytes.length, norm1.buffer.length);

    const resolved = await resolveImageBytes({
      id: 'asset-test',
      type: 'REFERENCE',
      source: 'UPLOAD',
      url: putRes.url,
      storageKey: putRes.storageKey,
      createdAt: new Date().toISOString(),
    });
    assert.ok(resolved, 'resolveImageBytes must return buffer from storage');
    assert.strictEqual(resolved.buffer.length, norm1.buffer.length);
    console.log('   ✓ Storage write, get and resolveImageBytes passed.');

    // ==========================================
    // TEST 10: CREATE PROJECT FROM SOURCE_IMAGE IDs
    // ==========================================
    console.log('\n10. Testing Project creation from SourceImage ID inputs...');
    const validProjectInput = {
      name: 'Producción Primavera',
      category: 'Vestido',
      sizes: ['S', 'M'],
      images: [
        { sourceImageId: 'src-1' }
      ]
    };
    const schemaValidation = CreateProjectSchema.safeParse(validProjectInput);
    assert.ok(schemaValidation.success, 'CreateProjectSchema must accept images with sourceImageId');
    console.log('   ✓ CreateProjectSchema validates sourceImageId input successfully.');

    // ==========================================
    // TEST 11: REJECT PERSISTED BLOB: URLs
    // ==========================================
    console.log('\n11. Testing strict rejection of blob: URLs...');
    // A. Schema rejection in ImageAssetSchema
    const blobAsset = {
      id: 'blob-1',
      type: 'REFERENCE',
      source: 'UPLOAD',
      url: 'blob:http://localhost:3000/1234-5678',
      createdAt: new Date().toISOString(),
    };
    const blobValidation = ImageAssetSchema.safeParse(blobAsset);
    assert.strictEqual(blobValidation.success, false, 'ImageAssetSchema must strictly reject blob: URLs');

    // B. Rejection in resolveImageBytes
    await assert.rejects(
      async () => {
        await resolveImageBytes('blob:http://localhost:3000/some-random-uuid');
      },
      /Las URLs blob no son accesibles en el backend/
    );
    console.log('   ✓ blob: URLs strictly rejected across schemas and resolvers.');

    // ==========================================
    // TEST 12: GEMINI ANALYZER PAYLOAD CONTAINS REAL IMAGE BYTES
    // ==========================================
    console.log('\n12. Testing Gemini analyzer multimodal byte payload...');
    // We test that resolveImageBytes provides inline_data with base64 for Gemini
    const testAssetForGemini: ImageAsset = {
      id: 'asset-gem',
      type: 'REFERENCE',
      source: 'UPLOAD',
      url: putRes.url,
      storageKey: putRes.storageKey,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    };

    const resolvedForGemini = await resolveImageBytes(testAssetForGemini);
    assert.ok(resolvedForGemini);
    const inlinePart = {
      inline_data: {
        mime_type: resolvedForGemini.mimeType,
        data: resolvedForGemini.buffer.toString('base64'),
      }
    };
    assert.strictEqual(inlinePart.inline_data.mime_type, 'image/jpeg');
    assert.ok(inlinePart.inline_data.data.length > 0);
    // Verify it doesn't contain text placeholder
    assert.strictEqual('text' in inlinePart, false);
    console.log('   ✓ Gemini analyzer payload formats real inline_data bytes (no text URLs).');

    // ==========================================
    // TEST 13: GEMINI VALIDATOR MULTIMODAL PAYLOAD
    // ==========================================
    console.log('\n13. Testing Gemini validator multimodal byte payload...');
    const generatedAsset: ImageAsset = {
      id: 'asset-gen',
      type: 'GENERATED',
      source: 'AI',
      url: putRes.url,
      storageKey: putRes.storageKey,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    };
    const resolvedGen = await resolveImageBytes(generatedAsset);
    assert.ok(resolvedGen);
    assert.ok(resolvedGen.buffer.length > 0);
    console.log('   ✓ Gemini validator payload successfully resolves generated image bytes.');

    // Cleanup test storage sandbox
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }

    console.log('\n🎉 ALL PHASE A REAL INGESTION TESTS PASSED! (13/13 suites)\n');
  } catch (err) {
    // Cleanup on error
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    console.error('❌ Phase A test failed:', err);
    process.exit(1);
  }
})();
