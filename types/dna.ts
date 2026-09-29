import { z } from 'zod';

// ==========================================
// GARMENT DNA DOMAIN MODEL & ZOD SCHEMAS (PHASE C)
// ==========================================

export const ConfidenceScoreSchema = z.number().min(0).max(1);

export const SilhouetteTypeSchema = z.enum([
  'FITTED',
  'STRAIGHT',
  'A_LINE',
  'OVERSIZED',
  'BODYCON',
  'FLARED',
  'RELAXED',
  'UNKNOWN',
]);

export const NecklineDepthSchema = z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);

export const SleeveLengthSchema = z.enum([
  'SLEEVELESS',
  'SHORT',
  'ELBOW',
  'THREE_QUARTER',
  'LONG',
  'UNKNOWN',
]);

export const VisualEvidenceRoleSchema = z.enum([
  'FRONT',
  'BACK',
  'SIDE',
  'DETAIL',
  'SWATCH',
]);

export const VerificationStatusSchema = z.enum([
  'VERIFIED',
  'INFERRED',
  'UNKNOWN',
  'CONFLICT',
]);

export const InvariantSeveritySchema = z.enum(['HARD', 'SOFT']);

export const SurfaceDecorationKindSchema = z.enum(['PRINT', 'EMBROIDERY', 'APPLIQUE']);

// Feature representation preserving supporting visual evidence
export const GarmentFeatureSchema = z.object({
  type: z.string().min(1),
  count: z.number().int().nonnegative().nullable().optional(),
  placement: z.array(z.string()).default([]),
  description: z.string().optional(),
  confidence: ConfidenceScoreSchema,
  evidenceReferenceIds: z.array(z.string()).default([]),
});

export const GarmentDNAEvidenceSchema = z.object({
  referenceId: z.string().min(1),
  role: VisualEvidenceRoleSchema,
  supports: z.array(z.string()).min(1),
  confidence: ConfidenceScoreSchema,
});

export const GarmentInvariantSchema = z.object({
  id: z.string().min(1),
  property: z.string().min(1),
  expectedValue: z.unknown(),
  tolerance: z.number().optional(),
  severity: InvariantSeveritySchema,
  confidence: ConfidenceScoreSchema,
  reason: z.string().optional(),
});

export const GarmentGeometrySchema = z.object({
  necklineDepthRatio: z.number().min(0).max(1).optional(),
  garmentLengthRatio: z.number().min(0).max(2).optional(),
  waistPositionRatio: z.number().min(0).max(1).optional(),
  sleeveLengthRatio: z.number().min(0).max(1.5).optional(),
  buttonSpacingRatios: z.array(z.number().min(0).max(1)).optional(),
  pocketVerticalPositions: z.array(z.number().min(0).max(1)).optional(),
});

export const SurfaceDecorationSchema = z.object({
  kind: SurfaceDecorationKindSchema,
  placement: z.array(z.string()).default([]),
  symmetric: z.boolean().nullable().default(null),
  coverage: z.number().min(0).max(1).nullable().default(null),
  dominantColors: z.array(z.string()).default([]),
  repeatPattern: z.string().nullable().default(null),
  confidence: ConfidenceScoreSchema,
  evidenceReferenceIds: z.array(z.string()).default([]),
});

export const DNAConflictSchema = z.object({
  property: z.string().min(1),
  observations: z.array(
    z.object({
      referenceId: z.string(),
      role: VisualEvidenceRoleSchema,
      observedValue: z.unknown(),
      confidence: ConfidenceScoreSchema,
    })
  ),
  severity: InvariantSeveritySchema,
  resolutionRequired: z.boolean().default(true),
  notes: z.string().optional(),
});

export const DNAChangeLogSchema = z.object({
  id: z.string().min(1),
  garmentDNAId: z.string().min(1),
  property: z.string().min(1),
  previousValue: z.unknown(),
  newValue: z.unknown(),
  source: z.enum(['AI', 'USER', 'SYSTEM']),
  reason: z.string().optional(),
  createdAt: z.string(),
});

export const GarmentDNASchema = z.object({
  id: z.string().min(1),
  productGroupId: z.string().min(1),
  version: z.number().int().positive().default(1),
  previousVersionId: z.string().nullable().optional(),
  changeReason: z.string().optional(),

  category: z.string().min(1),

  silhouette: z.object({
    type: SilhouetteTypeSchema,
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  neckline: z.object({
    type: z.string(),
    depth: NecklineDepthSchema,
    shape: z.string().optional(),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  sleeves: z.object({
    present: z.boolean(),
    type: z.string().optional(),
    length: SleeveLengthSchema.optional(),
    cuffType: z.string().optional(),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  buttons: z.object({
    count: z.number().int().nonnegative().nullable(),
    placement: z.array(z.string()).default([]),
    visible: z.boolean(),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  pockets: z.object({
    count: z.number().int().nonnegative().nullable(),
    placement: z.array(z.string()).default([]),
    type: z.array(z.string()).default([]),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  closures: z.object({
    types: z.array(z.string()).default([]),
    placements: z.array(z.string()).default([]),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  seams: z.array(GarmentFeatureSchema).default([]),
  embroidery: z.array(SurfaceDecorationSchema).default([]),
  print: z.array(SurfaceDecorationSchema).default([]),
  pleats: z.array(GarmentFeatureSchema).default([]),
  ruffles: z.array(GarmentFeatureSchema).default([]),
  darts: z.array(GarmentFeatureSchema).default([]),
  belts: z.array(GarmentFeatureSchema).default([]),
  straps: z.array(GarmentFeatureSchema).default([]),
  openings: z.array(GarmentFeatureSchema).default([]),

  length: z.object({
    class: z.string(),
    relativeRatio: z.number().min(0).max(2).optional(),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  waist: z.object({
    type: z.string(),
    position: z.string().optional(),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  hem: z.object({
    shape: z.string(),
    asymmetry: z.boolean().default(false),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  materialAppearance: z.object({
    texture: z.array(z.string()).default([]),
    drape: z.string().default('Medio'),
    opacity: z.string().default('Opaco'),
    sheen: z.string().default('Mate'),
    confidence: ConfidenceScoreSchema,
    status: VerificationStatusSchema.default('VERIFIED'),
  }),

  geometry: GarmentGeometrySchema.default({}),

  immutableRules: z.array(GarmentInvariantSchema).default([]),
  evidence: z.array(GarmentDNAEvidenceSchema).default([]),
  conflicts: z.array(DNAConflictSchema).default([]),
  auditTrail: z.array(DNAChangeLogSchema).default([]),

  confidence: ConfidenceScoreSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

// TypeScript interfaces inferred from schemas
export type GarmentFeature = z.infer<typeof GarmentFeatureSchema>;
export type GarmentDNAEvidence = z.infer<typeof GarmentDNAEvidenceSchema>;
export type GarmentInvariant = z.infer<typeof GarmentInvariantSchema>;
export type GarmentGeometry = z.infer<typeof GarmentGeometrySchema>;
export type SurfaceDecoration = z.infer<typeof SurfaceDecorationSchema>;
export type DNAConflict = z.infer<typeof DNAConflictSchema>;
export type DNAChangeLog = z.infer<typeof DNAChangeLogSchema>;
export type GarmentDNA = z.infer<typeof GarmentDNASchema>;
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export interface StructuralObservation {
  referenceId: string;
  role: 'FRONT' | 'BACK' | 'SIDE' | 'DETAIL' | 'SWATCH';
  property: string;
  value: unknown;
  confidence: number;
}

export interface StructuralConsensus {
  property: string;
  observations: {
    referenceId: string;
    role: string;
    value: unknown;
    confidence: number;
  }[];
  resolvedValue: unknown;
  agreement: number;
  status: 'CONFIRMED' | 'CONFLICT' | 'INSUFFICIENT_EVIDENCE';
}

export interface ValidationContract {
  productGroupId: string;
  dnaVersion: number;
  hardInvariants: {
    property: string;
    expectedValue: unknown;
    tolerance?: number;
    description: string;
  }[];
  softInvariants: {
    property: string;
    expectedValue: unknown;
    tolerance?: number;
    description: string;
  }[];
}

export interface DNAObservability {
  dnaAnalysisLatencyMs: number;
  referencesUsedCount: number;
  propertiesExtractedCount: number;
  verifiedPropertiesCount: number;
  unknownPropertiesCount: number;
  conflictsDetectedCount: number;
  manualOverridesCount: number;
  dnaVersion: number;
}
