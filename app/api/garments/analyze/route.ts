import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getImageGenerationProvider } from '@/lib/ai';
import { 
  GarmentCategorySchema, 
  ImageAssetSchema,
  MAX_REFERENCE_IMAGES, 
  ALLOWED_IMAGE_MIME_TYPES 
} from '@/lib/schemas/project';

const AnalyzeRequestSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  category: GarmentCategorySchema,
  sizes: z.array(z.string()).min(1),
  referenceImages: z.array(ImageAssetSchema)
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

    // Security validation of reference images
    for (const img of referenceImages) {
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
      referenceImages,
    });

    return NextResponse.json({ success: true, data: garmentLock });
  } catch (error) {
    console.error('Error in /api/garments/analyze:', error);
    return NextResponse.json({ success: false, error: 'Error al analizar prenda' }, { status: 500 });
  }
}
