// ==========================================
// 1. IMAGE ASSET DOMAIN MODEL
// ==========================================

export type ImageAssetType = 'REFERENCE' | 'GENERATED';
export type ImageAssetSource = 'UPLOAD' | 'AI' | 'MOCK';

export interface ImageAsset {
  id: string;
  type: ImageAssetType;
  source: ImageAssetSource;
  url: string;
  name?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  order?: number;
  createdAt: string;
}

// ==========================================
// 2. STATUS & CATEGORY DEFINITIONS
// ==========================================

export type ProductionStatus = 
  | 'DRAFT'
  | 'ANALYZING'
  | 'READY'
  | 'GENERATING'
  | 'VALIDATING'
  | 'COMPLETED'
  | 'FAILED';

export type GarmentCategory = 
  | 'Vestido'
  | 'Mono'
  | 'Remera'
  | 'Camisa'
  | 'Pantalón'
  | 'Short'
  | 'Pollera'
  | 'Campera'
  | 'Sweater'
  | 'Conjunto'
  | 'Otro';

// ==========================================
// 2.5 REFERENCE COVERAGE & FIDELITY
// ==========================================

export type CoverageStatus = 'VERIFIED' | 'PARTIAL' | 'INFERRED' | 'UNKNOWN';

export interface ReferenceCoverage {
  front: CoverageStatus;
  side: CoverageStatus;
  back: CoverageStatus;
  details: CoverageStatus;
  colors: CoverageStatus;
  pattern: CoverageStatus;
  construction: CoverageStatus;
}

// ==========================================
// 3. COLOR VARIANT LOCK (MULTICOLOR DOMAIN)
// ==========================================

export interface ColorVariant {
  id: string;
  name: string; // e.g. "Negro", "Bordó", "Verde Oliva", "Azul Noche", "Beige", "Terracota"
  detectedColor: string; // visual color label from reference
  colorDescription: string; // nuanced description, e.g. "Bordó oscuro con flores beige y blancas"
  patternDescription?: string; // detailed print description
  approximateHex: string; // approximate hex for UI badges, e.g. "#1A1A1A"
  patternDistribution?: string; // how floral/pattern prints are distributed across this variant
  confidence?: number; // detection confidence score (0-100)
  referenceAssets?: ImageAsset[]; // visual crops / evidence for this exact colorway
  referenceCrop?: string; // direct cropped image data/url
  selected: boolean;
  order: number;
}

// ==========================================
// 4. GARMENT LOCK & MODEL LOCK
// ==========================================

export interface GarmentLock {
  id: string;
  name: string;
  category: GarmentCategory;
  material: string;
  pattern: string;
  details: string[];
  pockets: boolean;
  sizes: string[];
  mustPreserve: string[];
  colorVariants: ColorVariant[];
  referenceImages: ImageAsset[];
  coverage?: ReferenceCoverage;
}

export interface ModelLock {
  modelId: string;
  gender: 'Femenino' | 'Masculino' | 'Unisex';
  apparentAge: string;
  bodyType: string;
  skinTone: string;
  hairColor: string;
  hairLength: string;
  hairStyle: string;
  previewUrl: string;
  name: string;
}

// ==========================================
// 5. PRODUCTION PROFILES, SHOT TYPES & CONTRACTS
// ==========================================

export type ProductionStyle = 'STUDIO_WHITE' | 'EDITORIAL_CATALOG';
export type ProductionPackageType = 'ECOMMERCE' | 'CATALOG';

// The 4 canonical poses per color variant per production set
export type MandatoryShotView = 'FRONT' | 'SIDE' | 'BACK' | 'ACTION';

export type ShotType = MandatoryShotView;

export type JobView = 'frente' | 'costado' | 'espalda' | 'accion';

export interface ShotContract {
  view: MandatoryShotView;
  bodyOrientation: 'FRONT' | 'SIDE' | 'BACK';
  headOrientation: 'DIRECT_CAMERA' | 'OVER_SHOULDER_TO_CAMERA';
  gaze: 'CAMERA';
  movement: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  focusAspects: string[];
  requiresReference: 'FRONT' | 'SIDE' | 'BACK' | 'ANY';
}

export interface ProductionProfile {
  style: ProductionStyle;
  name: string;
  background: string;
  lighting: string;
  composition: string;
  framing: string;
  garmentPriority: 'MAXIMUM';
  cameraLookRule: 'LOOK_DIRECTLY_AT_CAMERA';
}

// ==========================================
// 6. POSE DESCRIPTOR & GLOBAL POSE HISTORY
// ==========================================

export interface PoseDescriptor {
  shotView: MandatoryShotView;
  colorVariantId?: string;
  bodyOrientation: 'FRONT' | 'SIDE_LEFT' | 'SIDE_RIGHT' | 'BACK';
  headOrientation: 'DIRECT_CAMERA' | 'TURNED_OVER_SHOULDER_TO_CAMERA';
  leftArm: string;
  rightArm: string;
  leftHand: string;
  rightHand: string;
  legsPosition: string;
  weightDistribution: string;
  torsoAngle: string;
  movement: 'STILL' | 'FLUID_MOTION' | 'WALKING';
  expression: string;
}

export interface PoseHistory {
  colorVariantId: string;
  productionStyle: ProductionStyle;
  poses: PoseDescriptor[];
}

export interface ProductionPoseHistory {
  projectId: string;
  poses: (PoseDescriptor & {
    colorVariantId: string;
    productionStyle: ProductionStyle;
  })[];
}

// ==========================================
// 7. GENERATION JOB & STATE MACHINE
// ==========================================

export type JobStatus = 
  | 'QUEUED'
  | 'GENERATING'
  | 'VALIDATING'
  | 'APPROVED'
  | 'REVIEW_REQUIRED'
  | 'REJECTED'
  | 'FAILED';

export type MetricVerifiability = 'PASS' | 'FAIL' | 'REVIEW' | 'NOT_VERIFIABLE';

export interface ValidationMetricDetail {
  metric: string;
  score?: number;
  status: MetricVerifiability;
  evidence?: string;
  reason?: string;
}

export interface ValidationPolicy {
  minGarmentIdentityScore: number; // default: 90
  minColorAccuracyScore: number;   // default: 90
  minShotAccuracyScore: number;    // default: 90
  minModelIdentityScore: number;   // default: 88
  minPatternScoreIfVerified: number; // default: 88
  minDetailScoreIfVerified: number;  // default: 85
}

export interface GarmentValidationResult {
  overallScore: number;
  garmentIdentityScore: number;
  colorAccuracyScore: number;
  shapeScore: number;
  patternScore: number;
  detailScore: number;
  modelIdentityScore: number;
  shotAccuracyScore: number;
  poseDiversityScore: number;
  metrics?: ValidationMetricDetail[];
  policyPassed?: boolean;
  failedGates?: string[];
  referenceStatus?: 'REFERENCE_VERIFIED' | 'AI_INFERRED';
  issues: string[];
}

export interface GenerationJob {
  id: string;
  projectId: string;
  colorVariantId: string;
  colorName: string;
  productionStyle: ProductionStyle;
  shotView: MandatoryShotView;
  label: string;
  status: JobStatus;
  progress: number;
  attempts: number;
  poseDescriptor?: PoseDescriptor;
  outputAsset?: ImageAsset;
  outputUrl?: string;
  validationScore?: GarmentValidationResult;
  referenceStatus?: 'REFERENCE_VERIFIED' | 'AI_INFERRED';
  rawBenchmark?: RawBenchmarkResult;
  createdAt: string;
  error?: string;
}

export interface RawBenchmarkResult {
  experimentId: string;
  provider: 'fal' | 'mock';
  model: string;
  shot: MandatoryShotView;
  promptVersion: string;
  seed: number;
  generation: {
    durationMs: number;
    providerCost: number;
  };
  validation: {
    garmentIdentity: number;
    colorAccuracy: number;
    shape: number;
    pattern: number;
    detail: number;
    modelIdentity: number;
    shotAccuracy: number;
    poseDiversity: number;
  };
  hardGateResult: 'PASS' | 'FAIL' | 'REVIEW';
  issues: string[];
}

// ==========================================
// 8. GENERATION REQUEST & CONTRACTS
// ==========================================

export interface GenerationRequest {
  garmentLock: GarmentLock;
  colorVariant: ColorVariant;
  modelLock: ModelLock;
  productionStyle: ProductionStyle;
  shotView: MandatoryShotView;
  shotContract?: ShotContract;
  poseHistory?: PoseDescriptor[];
  productionPoseHistory?: ProductionPoseHistory;
  constraints?: string[];
  referenceImages: ImageAsset[];
}

export interface RegenerationRequest {
  jobId: string;
  previousGeneration: GenerationJob;
  validationResult: GarmentValidationResult;
  issues: string[];
  attempt: number;
}

// ==========================================
// 9. PRODUCTION PACKAGE SELECTION & MATRIX
// ==========================================

export interface ProductionPackageSelection {
  studioWhite: boolean; // Mercado Libre / E-commerce (Fondo blanco)
  editorialCatalog: boolean; // Catálogo Premium (Ambientación editorial)
}

export interface ProductionMatrixStats {
  selectedColorsCount: number;
  shotsPerSetPerColor: number; // exactly 4: FRONT, SIDE, BACK, ACTION
  selectedSetsCount: number; // 1 or 2 (Studio White + Editorial Catalog)
  totalPhotos: number; // e.g. 6 × 4 × 2 = 48
}

export interface Project {
  id: string;
  name: string;
  status: ProductionStatus;
  createdAt: string;
  updatedAt: string;
  garment: GarmentLock;
  model: ModelLock;
  selectedPackages: ProductionPackageSelection;
  jobs: GenerationJob[];
}

export interface DashboardMetrics {
  totalGarments: number;
  totalGeneratedImages: number;
  approvedImages: number;
  pendingJobs: number;
}

export type StorageMode = 'mock' | 'database';
