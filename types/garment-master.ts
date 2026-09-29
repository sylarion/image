import { MandatoryShotView, ImageAsset } from './index';
import { GarmentDNA } from './dna';

export const GARMENT_MASTER_SCHEMA_VERSION = '1.0.0';

export type MasterVerificationStatus = 'VERIFIED' | 'INFERRED' | 'UNKNOWN' | 'NOT_VERIFIABLE';

export interface NecklineGeometry {
  type: string;
  depth: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  shape: string;
  depthRatio?: number;
  status: MasterVerificationStatus;
}

export interface FrontPlacket {
  present: boolean;
  type?: string;
  status: MasterVerificationStatus;
}

export interface ButtonStructure {
  presence: boolean;
  count: number | null;
  positions: string[];
  layout: string;
  size?: string;
  status: MasterVerificationStatus;
}

export interface SeamStructure {
  visibility: boolean;
  positions: string[];
  details: string[];
  status: MasterVerificationStatus;
}

export interface PocketStructure {
  presence: boolean;
  count: number | null;
  positions: string[];
  type?: string[];
  status: MasterVerificationStatus;
}

export interface HemStructure {
  line: string;
  shape: string;
  asymmetry: boolean;
  status: MasterVerificationStatus;
}

export interface PatternTopology {
  type: string;
  repeatPattern?: string | null;
  placement: string[];
  coverage?: number | null;
  status: MasterVerificationStatus;
}

export interface FabricAppearance {
  texture: string[];
  drape: string;
  opacity: string;
  sheen: string;
  status: MasterVerificationStatus;
}

export interface GarmentProportions {
  lengthRatio?: number;
  waistPosition?: string;
  symmetry: boolean;
}

export interface ShotVisibilityRule {
  requiredVisible: string[];
  allowedHidden: string[];
}

export interface AllowedGarmentChanges {
  authorizedColorVariant?: string;
  allowLightingNuances: true;
  allowNaturalPoseOcclusions: true;
}

/**
 * GarmentMaster represents the immutable canonical truth of a garment,
 * derived exclusively from original photographic references.
 * Original photo is the SOLE HIGHEST AUTHORITY.
 */
export interface GarmentMaster {
  masterId: string;
  schemaVersion: string;
  sourceImageSha256: string;
  authorityPriority: 'ORIGINAL_IMAGE_PRIMARY';

  // Core Classification
  garmentType: string;
  category: string;

  // Geometry & Structural Invariants
  neckline: string;
  necklineGeometry: NecklineGeometry;
  sleeveType: string;
  sleeveLength: string;
  sleeveShape: string;
  frontPlacket: FrontPlacket;
  buttons: ButtonStructure;
  seams: SeamStructure;
  pockets: PocketStructure;
  hemline: HemStructure;
  silhouette: string;
  garmentLength: string;
  fit: string;
  pattern: string;
  print: string;
  patternTopology: PatternTopology;
  texture: string;
  fabricAppearance: FabricAppearance;
  decorativeDetails: string[];
  visibleDecorativeDetails: string[];
  requiredVisibleDetails: string[];
  structuralDetails: string[];
  garmentProportions: GarmentProportions;

  // Color domain
  baseColor: string;
  colorVariants: string[];

  // Strict boundaries
  allowedChanges: AllowedGarmentChanges;
  lockedAttributes: string[];
  shotVisibilityRules: Record<MandatoryShotView, ShotVisibilityRule>;

  // Underlying DNA if present
  underlyingDNA?: GarmentDNA;
  createdAt: string;
}

/**
 * Detailed Structural Quality Gates for Post-Generation Verification.
 * Eliminates soft-averaging loopholes: critical tailored features (buttons, pockets,
 * necklines, seams) cause immediate rejection if mutated.
 */
export interface StructuralFidelityMetrics {
  garmentSimilarity: number;               // Min: 90
  structuralFidelity: number;              // Min: 95
  necklineConsistency: number;             // Min: 95
  sleeveConsistency: number;               // Min: 93
  buttonCountConsistency: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'EXCLUDED_BY_ANGLE';
  buttonPlacementConsistency: number;      // Min: 95
  seamConsistency: number;                 // Min: 90
  pocketConsistency: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'EXCLUDED_BY_ANGLE';
  hemConsistency: number;                  // Min: 92
  silhouetteConsistency: number;           // Min: 93
  garmentProportionConsistency: number;    // Min: 90
  patternConsistency: number;              // Min: 90
  textureConsistency: number;              // Min: 88
  decorativeDetailConsistency: number;     // Min: 90
  colorVariantConsistency: number;         // Min: 90
  modelIdentityConsistency: number;        // Min: 90
  shotCompliance: number;                  // Min: 90
}

export type CriticalStructuralFault =
  | 'CRITICAL_BUTTON_EXTRA'
  | 'CRITICAL_BUTTON_MISSING'
  | 'CRITICAL_NECKLINE_ALTERED'
  | 'CRITICAL_SLEEVE_MUTATED'
  | 'CRITICAL_SEAM_MISSING'
  | 'CRITICAL_POCKET_INVENTED'
  | 'CRITICAL_POCKET_MISSING'
  | 'CRITICAL_SILHOUETTE_ALTERED'
  | 'CRITICAL_HEM_LENGTH_ALTERED'
  | 'CRITICAL_PATTERN_MUTATED'
  | 'CRITICAL_MODEL_IDENTITY_MISMATCH'
  | 'CRITICAL_UNAUTHORIZED_GARMENT_MUTATION';

export interface ComprehensiveValidationAudit {
  status: 'APPROVED' | 'REVIEW_REQUIRED' | 'REJECTED';
  overallScore: number;
  modelIdentityPassed: boolean;
  garmentIdentityPassed: boolean;
  metrics: StructuralFidelityMetrics;
  criticalFaults: CriticalStructuralFault[];
  issues: string[];
  anchorValidated?: boolean;
  crossVariantValidated?: boolean;
}
