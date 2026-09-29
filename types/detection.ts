// ==========================================
// VISUAL GARMENT & VARIANT DETECTION DOMAIN MODEL (PHASE B)
// ==========================================

export interface BoundingBox {
  /** Normalized X coordinate of top-left corner (0.0 to 1.0) */
  x: number;
  /** Normalized Y coordinate of top-left corner (0.0 to 1.0) */
  y: number;
  /** Normalized width (0.0 to 1.0) */
  width: number;
  /** Normalized height (0.0 to 1.0) */
  height: number;
}

export type SceneType =
  | 'SINGLE_GARMENT'
  | 'MULTIPLE_VARIANTS'
  | 'MULTIPLE_PRODUCTS'
  | 'GARMENT_ON_MODEL'
  | 'GARMENT_ON_MANNEQUIN'
  | 'DETAIL'
  | 'UNKNOWN';

export type ImageVisualRole =
  | 'FRONT'
  | 'BACK'
  | 'SIDE'
  | 'DETAIL'
  | 'SWATCH'
  | 'MULTI_VIEW'
  | 'UNKNOWN';

export interface GarmentVisualSignature {
  category: string;
  silhouette: string;
  neckline: string;
  sleeveType: string;
  length: string;
  hasPockets: boolean;
  patternType: string;
  closureType?: string;
  distinctiveDetails: string[];
}

export interface GarmentInstance {
  id: string;
  sourceImageId: string;
  boundingBox: BoundingBox;
  cropId?: string;
  cropUrl?: string;
  confidence: number;
  dominantColor?: {
    name: string;
    hex: string;
    confidence: number;
  };
  orientation?: 'FRONT' | 'BACK' | 'SIDE' | 'UNKNOWN';
  visualSignature?: GarmentVisualSignature;
  probableCategory?: string;
  sameProductGroup?: string;
}

export interface SanityCheckConflict {
  code: 'VARIANT_RECONCILIATION_CONFLICT' | 'UNMATCHED_CROPS' | 'ZERO_DETECTIONS' | 'UNRESOLVED_GROUP';
  message: string;
  details?: Record<string, unknown>;
}

export interface SanityCheckResult {
  passed: boolean;
  instanceCount: number;
  cropCount: number;
  productGroupCount: number;
  variantCount: number;
  conflicts: SanityCheckConflict[];
}


export interface DetectedGarment {
  aiSuggestedColor?: {name:string;hex:string;confidence:number};
  sourceImageId?: string;
  analysisRunId?: string;
  detectionId: string;
  boundingBox: BoundingBox;
  confidence: number;
  probableCategory: string;
  dominantColor: {
    name: string;
    hex: string;
    confidence: number;
  };
  orientation: 'FRONT' | 'BACK' | 'SIDE' | 'UNKNOWN';
  visualSignature?: GarmentVisualSignature;
  sameProductGroup?: string;
}

export interface GarmentSceneAnalysis {
  sourceImageId: string;
  sceneType: SceneType;
  imageRole: ImageVisualRole;
  garments: DetectedGarment[];
  instances?: GarmentInstance[];
  confidence: number;
}

export interface GarmentCrop {
  analysisRunId?: string;
  id: string;
  sourceImageId: string;
  detectionId: string;
  storageKey: string;
  url: string;
  width: number;
  height: number;
  sha256: string;
  boundingBox: BoundingBox;
}

export interface GarmentVariant {
  analysisRunId?: string;
  id: string;
  productGroupId: string;
  color: {
    canonicalName: string;
    observedName: string;
    hex: string;
    rgb?: { r: number; g: number; b: number };
    lab?: [number, number, number];
    confidence: number;
  };
  cropIds?: string[];
  referenceCrops: string[];
  sourceImageIds: string[];
  observedVariantIds?: string[];
}

export interface ObservedVariant {
  visionColorHex?: string;
  id?: string;
  category?: string;
  analysisRunId?: string;
  detectionId: string;
  cropId: string;
  cropUrl: string;
  sourceImageId: string;
  observedColor: {
    rawHex: string;
    rgb: { r: number; g: number; b: number };
    lab: [number, number, number];
    semanticName: string;
  };
  rawColorHex?: string;
  colorLab?: [number, number, number];
  semanticColorName?: string;
  productGroupCandidateId: string;
  confidence: number;
  orientation?: ImageVisualRole;
}

export const ANALYSIS_SCHEMA_VERSION = '1.0.0';

export interface AnalysisRun {
  analysisRunId: string;
  createdAt: string;
  mode: 'REAL' | 'MOCK';
  model?: string;
  sourceImageIds?: string[];
  provider: string;
  analysisSchemaVersion?: string;
  fallbackUsed: boolean;
  status: 'RUNNING' | 'COMPLETED' | 'ANALYSIS_UNAVAILABLE' | 'FAILED';
  wizardSelection?: unknown;
  generationJobs?: import('./index').GenerationJob[];
  expectedJobs?: number;
  actualJobs?: number;
  sourceImages: import('./index').SourceImage[];
  analyses: GarmentSceneAnalysis[];
  detections: DetectedGarment[];
  crops: GarmentCrop[];
  observedVariants: ObservedVariant[];
  productGroups: ProductGroup[];
  instances?: GarmentInstance[];
  sanityCheck?: SanityCheckResult;
  adapterOutput?: any;
  errorMessage?: string;
  executionMetrics: {
    totalDurationMs: number;
    detectionCount: number;
    cropsCount: number;
    observedVariantsCount: number;
    finalVariantsCount: number;
    productGroupsCount: number;
  };
}

export interface GarmentReference {
  id: string;
  productGroupId: string;
  variantId?: string;
  role: 'FRONT' | 'BACK' | 'SIDE' | 'DETAIL' | 'SWATCH' | 'UNKNOWN';
  sourceImageId: string;
  cropId?: string;
  confidence: number;
}

export interface ProductGroup {
  analysisRunId?: string;
  id: string;
  name: string;
  category: string;
  variants: GarmentVariant[];
  references: GarmentReference[];
  visualSignature: GarmentVisualSignature;
  confidence: number;
  garmentDNA?: import('./dna').GarmentDNA;
}

export interface SceneAnalysisObservability {
  sceneAnalysisLatencyMs: number;
  detectedGarmentsCount: number;
  detectedVariantsCount: number;
  bboxAverageConfidence: number;
  groupingAverageConfidence: number;
  roleAverageConfidence: number;
  colorAverageConfidence: number;
  cropsCreatedCount: number;
  segmentationFallbacksCount: number;
}

export interface SceneAnalysisPipelineResult {
  analyses: GarmentSceneAnalysis[];
  crops: GarmentCrop[];
  productGroups: ProductGroup[];
  observedVariants?: ObservedVariant[];
  instances?: GarmentInstance[];
  sanityCheck?: SanityCheckResult;
  observability: SceneAnalysisObservability;
  analysisRun?: AnalysisRun;
  analysisRunId?: string;
}

