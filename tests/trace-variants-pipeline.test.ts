import assert from 'node:assert';
import { SourceImage, DetectedGarment, GarmentSceneAnalysis } from '../types';
import { GarmentSceneAnalyzer } from '../lib/vision/scene-analyzer';
import { ProductGroupingService } from '../lib/vision/grouping';
import { VisualWizardAdapters } from '../features/wizard/models/wizard.types';

console.log('🔬 [ETAPA 1] Tracing Variants Pipeline Trace Execution...\n');

// 1. Mock a multi-garment source image (e.g. catalog photo with 4 shirts)
const mockMultiGarmentSourceImage: SourceImage = {
  id: 'src-multi-tshirts',
  storageKey: 'uploads/catalog-4-tshirts.webp',
  originalFilename: 'remeras-pack-colores.webp',
  mimeType: 'image/webp',
  byteSize: 420000,
  sha256: 'a1b2c3d4e5f6',
  width: 1600,
  height: 1200,
  url: '/uploads/catalog-4-tshirts.webp',
  role: 'UNKNOWN',
  source: 'USER_UPLOAD',
  createdAt: new Date().toISOString(),
};

async function runTrace() {
  console.log('--- ETAPA 1.1: SourceImage Ingestion ---');
  console.log(`SourceImage: id=${mockMultiGarmentSourceImage.id}, file=${mockMultiGarmentSourceImage.originalFilename}, dims=${mockMultiGarmentSourceImage.width}x${mockMultiGarmentSourceImage.height}`);

  // Test with scene analyzer
  const analyzer = new GarmentSceneAnalyzer();
  const sceneAnalysis: GarmentSceneAnalysis = analyzer.mockSceneAnalysis(mockMultiGarmentSourceImage);

  console.log('\n--- ETAPA 1.2: Scene Analysis & DetectedGarments ---');
  console.log(`Detected garments count: ${sceneAnalysis.garments.length}`);
  sceneAnalysis.garments.forEach((g, i) => {
    console.log(`  [Garment ${i+1}] id=${g.detectionId}, cat=${g.probableCategory}, color=${g.dominantColor.name} (${g.dominantColor.hex}), bbox=[${g.boundingBox.x}, ${g.boundingBox.y}, ${g.boundingBox.width}, ${g.boundingBox.height}], group=${g.sameProductGroup}`);
  });

  // What if the filename was just 'IMG_4921.jpg'?
  const regularSourceImage: SourceImage = {
    ...mockMultiGarmentSourceImage,
    id: 'src-regular-name',
    originalFilename: 'IMG_4921.jpg',
  };
  const regularAnalysis = analyzer.mockSceneAnalysis(regularSourceImage);
  console.log(`\n⚠️ Notice: When filename is 'IMG_4921.jpg' without keywords in mock/offline mode:`);
  console.log(`  garments count = ${regularAnalysis.garments.length} (Category: ${regularAnalysis.garments[0]?.probableCategory}, Color: ${regularAnalysis.garments[0]?.dominantColor.name})`);
  console.log(`  -> Root cause 1: Fallback mock defaults to 1 single 'Mono Negro' for non-keyword filenames when Gemini is offline!`);

  // Let's now trace 4 detected t-shirts through grouping
  console.log('\n--- ETAPA 1.3: Physical Crops & Grouping Simulation ---');
  const fourGarments: DetectedGarment[] = [
    {
      detectionId: 'det-shirt-1',
      boundingBox: { x: 0.05, y: 0.1, width: 0.2, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Remera',
      dominantColor: { name: 'Negro', hex: '#18181B', confidence: 0.95 },
      orientation: 'FRONT',
      sameProductGroup: 'group-tshirt',
    },
    {
      detectionId: 'det-shirt-2',
      boundingBox: { x: 0.28, y: 0.1, width: 0.2, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Remera',
      dominantColor: { name: 'Verde Seco', hex: '#4D7C0F', confidence: 0.95 },
      orientation: 'FRONT',
      sameProductGroup: 'group-tshirt',
    },
    {
      detectionId: 'det-shirt-3',
      boundingBox: { x: 0.51, y: 0.1, width: 0.2, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Remera',
      dominantColor: { name: 'Beige', hex: '#D4D4D8', confidence: 0.95 },
      orientation: 'FRONT',
      sameProductGroup: 'group-tshirt',
    },
    {
      detectionId: 'det-shirt-4',
      boundingBox: { x: 0.74, y: 0.1, width: 0.2, height: 0.8 },
      confidence: 0.95,
      probableCategory: 'Remera',
      dominantColor: { name: 'Celeste', hex: '#38BDF8', confidence: 0.95 },
      orientation: 'FRONT',
      sameProductGroup: 'group-tshirt',
    },
  ];

  const crops = fourGarments.map((g, i) => ({
    id: `crop-${i+1}`,
    sourceImageId: mockMultiGarmentSourceImage.id,
    detectionId: g.detectionId,
    storageKey: `crops/crop-${i+1}.webp`,
    url: `/crops/crop-${i+1}.webp`,
    width: 320,
    height: 960,
    sha256: `hash-${i+1}`,
    boundingBox: g.boundingBox,
  }));

  const groupedItems = fourGarments.map((g, i) => ({
    detection: g,
    crop: crops[i],
    sourceImageId: mockMultiGarmentSourceImage.id,
  }));

  const groupingService = new ProductGroupingService();
  const productGroups = groupingService.groupDetections(groupedItems);

  console.log(`\n--- ETAPA 1.4: ProductGroups & GarmentVariants ---`);
  console.log(`ProductGroups count: ${productGroups.length}`);
  productGroups.forEach((pg, i) => {
    console.log(`  [Group ${i+1}] id=${pg.id}, name="${pg.name}", category="${pg.category}", variantsCount=${pg.variants.length}`);
    pg.variants.forEach((v, vi) => {
      console.log(`    (Variant ${vi+1}) id=${v.id}, color="${v.color.canonicalName}" (${v.color.hex}), crops=${v.referenceCrops.length}, sourceImages=${v.sourceImageIds.join(',')}`);
    });
  });

  // What if two shirts in the same image have similar detected colors? (e.g. Gris and Gris Oscuro)
  console.log('\n--- ETAPA 1.5: Test Grouping with 2 garments of same canonical color in SAME photo ---');
  const twoGreensSamePhoto = [
    {
      detection: {
        detectionId: 'det-g1',
        boundingBox: { x: 0.1, y: 0.1, width: 0.35, height: 0.8 },
        confidence: 0.95,
        probableCategory: 'Remera',
        dominantColor: { name: 'Verde', hex: '#16A34A', confidence: 0.95 },
        orientation: 'FRONT' as const,
        sameProductGroup: 'group-tshirt',
      },
      crop: crops[0],
      sourceImageId: 'photo-1',
    },
    {
      detection: {
        detectionId: 'det-g2',
        boundingBox: { x: 0.55, y: 0.1, width: 0.35, height: 0.8 },
        confidence: 0.95,
        probableCategory: 'Remera',
        dominantColor: { name: 'Verde', hex: '#15803D', confidence: 0.95 }, // Both map to 'Verde'
        orientation: 'FRONT' as const,
        sameProductGroup: 'group-tshirt',
      },
      crop: crops[1],
      sourceImageId: 'photo-1',
    },
  ];

  const groupedCollapsing = groupingService.groupDetections(twoGreensSamePhoto);
  console.log(`  Input: 2 distinct garments in same photo with same canonical color "Verde"`);
  console.log(`  Output variants count: ${groupedCollapsing[0].variants.length}`);
  if (groupedCollapsing[0].variants.length === 1) {
    console.log(`  -> Root cause 2: Grouping merges separate detections from the SAME image if their canonical color name matches, collapsing 2 garments into 1 variant!`);
  }

  // ETAPA 1.6: Wizard Adapter
  console.log('\n--- ETAPA 1.6: Wizard Adapter Transformation ---');
  const mockPipelineResult = {
    analyses: [],
    crops,
    productGroups,
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

  const productChoices = VisualWizardAdapters.toProductChoices(mockPipelineResult);
  console.log(`ProductChoices count: ${productChoices.length}`);
  productChoices.forEach((pc, i) => {
    console.log(`  [ProductChoice ${i+1}] id=${pc.id}, title="${pc.title}", colorsCount=${pc.colors.length}`);
    pc.colors.forEach((c, ci) => {
      console.log(`    Color ${ci+1}: name="${c.name}", hex="${c.hex}", cropUrl="${c.cropUrl}", selected=${c.selected}`);
    });
  });

  console.log('\n🎯 Trace complete! Root causes identified.');
}

runTrace().catch(console.error);
