import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getImageGenerationProvider } from '@/lib/ai';
import { 
  GarmentCategorySchema, 
  ProjectImageInputSchema,
  MAX_REFERENCE_IMAGES, 
  ALLOWED_IMAGE_MIME_TYPES 
} from '@/lib/schemas/project';
import { getSourceImageRepository } from '@/lib/storage/source-image.repository';
import { ImageAsset } from '@/types';

const AnalyzeRequestSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  category: GarmentCategorySchema,
  sizes: z.array(z.string()).min(1),
  referenceImages: z.array(ProjectImageInputSchema)
    .min(1, 'Se requiere al menos una imagen de referencia')
    .max(MAX_REFERENCE_IMAGES, `Límite de ${MAX_REFERENCE_IMAGES} imágenes superado`),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = AnalyzeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Carga de datos inválida',
        details: parsed.error.issues,
      }, { status: 400 });
    }

    const { name, category, sizes, referenceImages } = parsed.data;
    const sourceRepo = getSourceImageRepository();
    const resolvedImages: ImageAsset[] = [];

    for (let idx = 0; idx < referenceImages.length; idx++) {
      const item = referenceImages[idx];
      if ('sourceImageId' in item && item.sourceImageId) {
        const sourceImage = await sourceRepo.getById(item.sourceImageId);
        if (!sourceImage) {
          return NextResponse.json({
            success: false,
            error: `SourceImage no encontrada para el ID: "${item.sourceImageId}".`,
          }, { status: 400 });
        }
        resolvedImages.push({
          id: `ref-${sourceImage.id}`,
          type: 'REFERENCE',
          source: 'UPLOAD',
          url: sourceImage.url,
          name: sourceImage.originalFilename,
          width: sourceImage.width,
          height: sourceImage.height,
          mimeType: sourceImage.mimeType,
          order: item.order ?? idx,
          sourceImageId: sourceImage.id,
          sha256: sourceImage.sha256,
          storageKey: sourceImage.storageKey,
          byteSize: sourceImage.byteSize,
          createdAt: sourceImage.createdAt,
        });
      } else if ('url' in item && item.url) {
        if (item.url.startsWith('blob:')) {
          return NextResponse.json({
            success: false,
            error: 'Las URLs "blob:" no están permitidas en el backend.',
          }, { status: 400 });
        }
        resolvedImages.push(item as ImageAsset);
      }
    }

    // Security validation of reference images
    for (const img of resolvedImages) {
      if (img.mimeType && !ALLOWED_IMAGE_MIME_TYPES.includes(img.mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
        return NextResponse.json({
          success: false,
          error: `Tipo de archivo no permitido: ${img.mimeType}. Formatos válidos: JPG, PNG, WebP.`,
        }, { status: 400 });
      }
    }

    const provider = getImageGenerationProvider();
    const garmentLock = await provider.analyzeGarment({
      name,
      category,
      sizes,
      referenceImages: resolvedImages,
    });

    return NextResponse.json({ success: true, data: garmentLock });
  } catch (error) {
    console.error('Error in /api/garments/analyze:', error);
    return NextResponse.json({ success: false, error: 'Error al analizar prenda' }, { status: 500 });
  }
}
