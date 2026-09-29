import { randomUUID } from 'node:crypto';
import { VisualWizardAdapters } from '@/features/wizard/models/wizard.types';
import { 
  SourceImage, 
  SceneAnalysisPipelineResult, 
  GarmentCrop, 
  SceneAnalysisObservability,
  GarmentSceneAnalysis,
  ProductGroup,
  ObservedVariant,
  AnalysisRun,
  ANALYSIS_SCHEMA_VERSION
} from '@/types';
import { GarmentSceneAnalyzer } from './scene-analyzer';
import { PhysicalGarmentCropper } from './cropper';
import { ColorAnalyzer } from './color-analyzer';
import { ProductGroupingService } from './grouping';
import { resolveImageBytes } from '@/lib/storage/image-storage';
import { GarmentDNAAnalyzer } from '@/lib/dna/analyzer';
import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { getAiConfig } from '@/lib/ai/config';
import { SceneSanityChecker } from './sanity-checker';

export class VisualDetectionPipeline {
  private sceneAnalyzer: GarmentSceneAnalyzer;
  private cropper: PhysicalGarmentCropper;
  private colorAnalyzer: ColorAnalyzer;
  private groupingService: ProductGroupingService;
  private dnaAnalyzer: GarmentDNAAnalyzer;

  constructor() {
    this.sceneAnalyzer = new GarmentSceneAnalyzer();
    this.cropper = new PhysicalGarmentCropper();
    this.colorAnalyzer = new ColorAnalyzer();
    this.groupingService = new ProductGroupingService();
    this.dnaAnalyzer = new GarmentDNAAnalyzer();
  }

  /**
   * Executes full Phase B visual detection, physical cropping, color verification,
   * and product/variant grouping across an array of SourceImages.
   */
  async processSourceImages(sourceImages: SourceImage[]): Promise<SceneAnalysisPipelineResult> {
    const startTime = Date.now();
    const runId = `ar_${randomUUID()}`;
    const aiConfig = getAiConfig();
    const isReal = aiConfig.aiMode === 'real';

    const analyses: GarmentSceneAnalysis[] = [];
    const allCrops: GarmentCrop[] = [];
    const groupedItems: {
      detection: import('@/types').DetectedGarment;
      crop: GarmentCrop;
      sourceImageId: string;
      imageRole?: import('@/types').ImageVisualRole;
    }[] = [];

    let totalBboxConfidence = 0;
    let totalColorConfidence = 0;
    let totalRoleConfidence = 0;
    let totalDetectionsCount = 0;

    const initialRun: AnalysisRun = {
      analysisRunId: runId, createdAt: new Date().toISOString(), mode: isReal ? 'REAL' : 'MOCK',
      provider: isReal ? aiConfig.analysisProvider : 'mock', model: aiConfig.analysisModel,
      analysisSchemaVersion: ANALYSIS_SCHEMA_VERSION,
      sourceImageIds: sourceImages.map(s => s.id), fallbackUsed: false, status: 'RUNNING',
      sourceImages, analyses: [], detections: [], crops: [], observedVariants: [], productGroups: [],
      executionMetrics: {totalDurationMs:0,detectionCount:0,cropsCount:0,observedVariantsCount:0,finalVariantsCount:0,productGroupsCount:0},
    };
    await getAnalysisRunRepository().save(initialRun);
    try {
      for (const sourceImage of sourceImages) {
        // 1. Multimodal Scene Analysis (Reuse valid analysis from existing completed runs if SHA-256 and schema/model/provider match)
        let sceneAnalysis: GarmentSceneAnalysis | undefined;

        if (sourceImage.sha256) {
          const pastRuns = await getAnalysisRunRepository().getAll(20);
          for (const pastRun of pastRuns) {
            const isCompatible = pastRun.status === 'COMPLETED' &&
              pastRun.analysisSchemaVersion === ANALYSIS_SCHEMA_VERSION &&
              pastRun.provider === initialRun.provider &&
              pastRun.model === initialRun.model;

            if (isCompatible) {
              const matchedAnalysis = pastRun.analyses.find((a) => {
                const pastImg = pastRun.sourceImages.find((img) => img.id === a.sourceImageId);
                return pastImg && pastImg.sha256 === sourceImage.sha256 && a.garments.length > 0;
              });
              if (matchedAnalysis) {
                sceneAnalysis = {
                  ...JSON.parse(JSON.stringify(matchedAnalysis)),
                  sourceImageId: sourceImage.id,
                  garments: matchedAnalysis.garments.map((g, idx) => ({
                    ...g,
                    detectionId: `${runId}-det-${sourceImage.id}-${idx + 1}`,
                    sourceImageId: sourceImage.id,
                    analysisRunId: runId,
                  })),
                };
                break;
              }
            }
          }
        }

        if (!sceneAnalysis) {
          sceneAnalysis = await this.sceneAnalyzer.analyzeScene(sourceImage);
          sceneAnalysis.garments.forEach(g => {
            g.detectionId = `${runId}-${g.detectionId}`;
            g.sourceImageId = sourceImage.id;
            g.analysisRunId = runId;
          });
        }
        analyses.push(sceneAnalysis);
        totalRoleConfidence += sceneAnalysis.confidence;

        if (sceneAnalysis.garments.length === 0) {
          continue;
        }

        // Resolve bytes for physical cropping
        const resolved = await resolveImageBytes(sourceImage);
        if (!resolved) {
          console.warn(`Could not resolve image bytes for cropping: ${sourceImage.id}`);
          throw new Error('INVALID_IMAGE');
        }

        // 2. Physical Cropping & Color Validation for each detected garment
        for (const garment of sceneAnalysis.garments) {
          totalDetectionsCount++;
          totalBboxConfidence += garment.confidence;

          try {
            const { crop, buffer: cropBuffer } = await this.cropper.cropGarment(
              sourceImage,
              resolved.buffer,
              garment.detectionId,
              garment.boundingBox
            );
            crop.analysisRunId = runId;
            allCrops.push(crop);

            // 3. Pixel-level chromatic validation on the cropped buffer
            const analyzedColor = await this.colorAnalyzer.analyzeGarmentCrop(
              cropBuffer,
              garment.dominantColor
            );

            totalColorConfidence += analyzedColor.confidence;

            // Enrich detection with verified color info preserving detected identity
            garment.dominantColor = {
              name: garment.dominantColor?.name || analyzedColor.observedName,
              hex: garment.dominantColor?.hex || analyzedColor.hex,
              confidence: Math.max(garment.dominantColor?.confidence || 0.9, analyzedColor.confidence),
            };

            groupedItems.push({
              detection: garment,
              crop,
              sourceImageId: sourceImage.id,
              imageRole: sceneAnalysis.imageRole,
            });
          } catch (cropErr) {
            throw new Error('CROP_FAILED');
          }
        }
      }

      // 4. Product Grouping, ObservedVariant layer & Reference Set
      const { productGroups, observedVariants } = this.groupingService.groupDetectionsWithObservations(groupedItems);

      if (!groupedItems.length) throw Object.assign(new Error('NO_GARMENT_FOUND'), {code:'NO_GARMENT_FOUND'});
      observedVariants.forEach(o => { o.analysisRunId = runId; });
      productGroups.forEach(g => { g.analysisRunId = runId; g.variants.forEach(v => { v.analysisRunId = runId; }); });
      // 5. Garment DNA Synthesis for each Product Group (Phase C)
      for (const group of productGroups) {
        const groupCropUrls = new Set<string>();
        for (const v of group.variants) {
          for (const cropUrl of v.referenceCrops) {
            groupCropUrls.add(cropUrl);
          }
        }
        const groupCrops = allCrops.filter((c) => groupCropUrls.has(c.url));
        const { dna } = await this.dnaAnalyzer.extractDNA({
          productGroup: group,
          crops: groupCrops.length > 0 ? groupCrops : allCrops,
          sourceImages,
        });
        group.garmentDNA = dna;
      }

      const durationMs = Date.now() - startTime;
      const totalVariantsCount = productGroups.reduce((acc, g) => acc + g.variants.length, 0);

      const observability: SceneAnalysisObservability = {
        sceneAnalysisLatencyMs: durationMs,
        detectedGarmentsCount: totalDetectionsCount,
        detectedVariantsCount: totalVariantsCount,
        bboxAverageConfidence: totalDetectionsCount > 0 ? Number((totalBboxConfidence / totalDetectionsCount).toFixed(2)) : 0,
        groupingAverageConfidence: productGroups.length > 0 ? Number((productGroups.reduce((a, b) => a + b.confidence, 0) / productGroups.length).toFixed(2)) : 0,
        roleAverageConfidence: sourceImages.length > 0 ? Number((totalRoleConfidence / sourceImages.length).toFixed(2)) : 0,
        colorAverageConfidence: totalDetectionsCount > 0 ? Number((totalColorConfidence / totalDetectionsCount).toFixed(2)) : 0,
        cropsCreatedCount: allCrops.length,
        segmentationFallbacksCount: 0,
      };

      const allDetections: import('@/types').DetectedGarment[] = [];
      for (const an of analyses) {
        allDetections.push(...an.garments);
      }

      const allInstances: import('@/types').GarmentInstance[] = analyses.flatMap(an => an.garments.map(g => ({
        id: g.detectionId,
        cropId: allCrops.find(c=>c.detectionId===g.detectionId)?.id,
        cropUrl: allCrops.find(c=>c.detectionId===g.detectionId)?.url,
        sourceImageId: g.sourceImageId || sourceImages[0].id,
        boundingBox: g.boundingBox,
        confidence: g.confidence,
        dominantColor: g.dominantColor,
        orientation: g.orientation,
        visualSignature: g.visualSignature,
        probableCategory: g.probableCategory,
        sameProductGroup: g.sameProductGroup,
      })));

      const sanityCheck = SceneSanityChecker.evaluate({
        instances: allInstances,
        crops: allCrops,
        productGroups,
      });

      const analysisRun: AnalysisRun = {
        ...initialRun,
        analysisRunId: runId,
        createdAt: new Date().toISOString(),
        mode: isReal ? 'REAL' : 'MOCK',
        provider: isReal ? 'Gemini' : 'Mock',
        fallbackUsed: false,
        status: 'COMPLETED',
        sourceImages,
        analyses,
        detections: allDetections,
        instances: allInstances,
        crops: allCrops,
        observedVariants,
        productGroups,
        sanityCheck,
        executionMetrics: {
          totalDurationMs: durationMs,
          detectionCount: totalDetectionsCount,
          cropsCount: allCrops.length,
          observedVariantsCount: observedVariants.length,
          finalVariantsCount: totalVariantsCount,
          productGroupsCount: productGroups.length,
        },
      };

      analysisRun.adapterOutput = VisualWizardAdapters.toProductChoices({analyses, crops:allCrops, productGroups, observedVariants, observability});
      const runRepo = getAnalysisRunRepository();
      await runRepo.save(analysisRun);

      return {
        analyses,
        crops: allCrops,
        productGroups,
        observedVariants,
        instances: allInstances,
        sanityCheck,
        observability,
        analysisRun,
        analysisRunId: runId,
      };
    } catch (err: unknown) {
      const isUnavailable = Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'ANALYSIS_UNAVAILABLE');
      const durationMs = Date.now() - startTime;

      const failedRun: AnalysisRun = {
        ...initialRun,
        analysisRunId: runId,
        createdAt: new Date().toISOString(),
        mode: isReal ? 'REAL' : 'MOCK',
        provider: isReal ? 'Gemini' : 'Mock',
        fallbackUsed: false,
        status: 'FAILED',
        sourceImages,
        analyses,
        detections: analyses.flatMap(a => a.garments),
        crops: allCrops,
        observedVariants: [],
        productGroups: [],
        errorMessage: isUnavailable ? 'ANALYSIS_UNAVAILABLE' : 'ANALYSIS_FAILED',
        executionMetrics: {
          totalDurationMs: durationMs,
          detectionCount: analyses.reduce((n,a)=>n+a.garments.length,0),
          cropsCount: allCrops.length,
          observedVariantsCount: 0,
          finalVariantsCount: 0,
          productGroupsCount: 0,
        },
      };

      const runRepo = getAnalysisRunRepository();
      await runRepo.save(failedRun);

      throw err;
    }
  }
}


// Global pipeline factory
export function getVisualDetectionPipeline(): VisualDetectionPipeline {
  return new VisualDetectionPipeline();
}
