import { z } from 'zod';

// ==========================================
// SECURITY LIMITS
// ==========================================
export const MAX_REFERENCE_IMAGES = 6;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const GarmentCategorySchema = z.enum([
  'Vestido',
  'Mono',
  'Remera',
  'Camisa',
  'Pantalón',
  'Short',
  'Pollera',
  'Campera',
  'Sweater',
  'Conjunto',
  'Otro',
]);

export const MandatoryShotViewSchema = z.enum([
  'FRONT',
  'SIDE',
  'BACK',
  'ACTION',
]);

export const ProductionStyleSchema = z.enum([
  'STUDIO_WHITE',
  'EDITORIAL_CATALOG',
  'PREMIUM_STUDIO',
  'LIFESTYLE',
]);

export const ImageAssetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['REFERENCE', 'GENERATED']),
  source: z.enum(['UPLOAD', 'AI', 'MOCK']),
  url: z.string().min(1).refine((url) => !url.startsWith('blob:'), {
    message: 'Las URLs "blob:" no están permitidas en ImageAsset.',
  }),
  name: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  mimeType: z.string().optional(),
  order: z.number().int().nonnegative().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
  sourceImageId: z.string().optional(),
  sha256: z.string().optional(),
  storageKey: z.string().optional(),
  byteSize: z.number().int().nonnegative().optional(),
});

export const CoverageStatusSchema = z.enum([
  'VERIFIED',
  'PARTIAL',
  'INFERRED',
  'UNKNOWN',
]);

export const ReferenceCoverageSchema = z.object({
  front: CoverageStatusSchema,
  side: CoverageStatusSchema,
  back: CoverageStatusSchema,
  details: CoverageStatusSchema,
  colors: CoverageStatusSchema,
  pattern: CoverageStatusSchema,
  construction: CoverageStatusSchema,
});

export const ColorVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'El nombre del color es obligatorio'),
  detectedColor: z.string().min(1),
  colorDescription: z.string().min(1),
  patternDescription: z.string().optional(),
  approximateHex: z.string().min(1),
  patternDistribution: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  referenceAssets: z.array(ImageAssetSchema).optional(),
  referenceCrop: z.string().optional(),
  selected: z.boolean().default(true),
  order: z.number().int().nonnegative().default(0),
});

export const GarmentLockSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'El nombre de la prenda es obligatorio'),
  category: GarmentCategorySchema,
  material: z.string().min(1, 'El material es obligatorio'),
  pattern: z.string().default('Liso'),
  details: z.array(z.string()).default([]),
  pockets: z.boolean().default(false),
  sizes: z.array(z.string()).min(1, 'Debe seleccionar al menos un talle'),
  mustPreserve: z.array(z.string()).min(1, 'Debe especificar atributos a preservar'),
  colorVariants: z.array(ColorVariantSchema).min(1, 'Debe haber al menos una variante de color'),
  referenceImages: z.array(ImageAssetSchema)
    .min(1, 'Se requiere al menos una imagen de referencia')
    .max(MAX_REFERENCE_IMAGES, `No se pueden cargar más de ${MAX_REFERENCE_IMAGES} imágenes de referencia`),
  coverage: ReferenceCoverageSchema.optional(),
});

export const ModelLockSchema = z.object({
  modelId: z.string().min(1),
  name: z.string().min(1),
  gender: z.enum(['Femenino', 'Masculino', 'Unisex']),
  apparentAge: z.string(),
  bodyType: z.string(),
  skinTone: z.string(),
  hairColor: z.string(),
  hairLength: z.string(),
  hairStyle: z.string(),
  previewUrl: z.string(),
});

export const ProductionPackageSelectionSchema = z.object({
  studioWhite: z.boolean(),
  editorialCatalog: z.boolean(),
}).refine(data => data.studioWhite || data.editorialCatalog, {
  message: 'Debe seleccionar al menos un set de producción (Mercado Libre / Fondo Blanco o Catálogo Premium)',
});

export const ProjectImageInputSchema = z.union([
  z.object({
    sourceImageId: z.string().min(1, 'sourceImageId es requerido'),
    order: z.number().int().nonnegative().optional(),
  }),
  ImageAssetSchema,
]);

export const CreateProjectSchema = z.object({
  name: z.string().min(2, 'El nombre de la producción debe tener al menos 2 caracteres'),
  category: GarmentCategorySchema,
  sizes: z.array(z.string()).min(1, 'Debe especificar al menos un talle'),
  images: z.array(ProjectImageInputSchema)
    .min(1, 'Debe cargar al menos una fotografía')
    .max(MAX_REFERENCE_IMAGES, `Límite máximo de ${MAX_REFERENCE_IMAGES} fotos alcanzado`),
});

export const PoseDescriptorSchema = z.object({
  shotView: MandatoryShotViewSchema,
  bodyOrientation: z.enum(['FRONT', 'SIDE_LEFT', 'SIDE_RIGHT', 'BACK']),
  headOrientation: z.enum(['DIRECT_CAMERA', 'TURNED_OVER_SHOULDER_TO_CAMERA']),
  leftArm: z.string(),
  rightArm: z.string(),
  leftHand: z.string(),
  rightHand: z.string(),
  legsPosition: z.string(),
  weightDistribution: z.string(),
  torsoAngle: z.string(),
  movement: z.enum(['STILL', 'FLUID_MOTION', 'WALKING']),
  expression: z.string(),
});

export const GenerationRequestSchema = z.object({
  garmentLock: GarmentLockSchema,
  colorVariant: ColorVariantSchema,
  modelLock: ModelLockSchema,
  productionStyle: ProductionStyleSchema,
  shotView: MandatoryShotViewSchema,
  poseHistory: z.array(PoseDescriptorSchema).optional(),
  constraints: z.array(z.string()).optional(),
  referenceImages: z.array(ImageAssetSchema).min(1),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type GarmentLockInput = z.infer<typeof GarmentLockSchema>;
export type ColorVariantInput = z.infer<typeof ColorVariantSchema>;
