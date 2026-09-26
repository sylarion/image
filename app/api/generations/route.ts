import { NextResponse } from 'next/server';
import { GenerationRequestSchema } from '@/lib/schemas/project';
import { getImageGenerationProvider } from '@/lib/ai';
import { GenerationJob, GenerationRequest } from '@/types';
import { evaluateValidationStatus } from '@/lib/ai/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = GenerationRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'GenerationRequest inválido',
        details: parsed.error.issues,
      }, { status: 400 });
    }

    const genRequest = parsed.data as unknown as GenerationRequest;
    const provider = getImageGenerationProvider();

    // 1. Generate via provider
    const outputAsset = await provider.generateImage(genRequest);

    // 2. Validate via independent service
    const validationResult = await provider.validateImage(outputAsset, genRequest.garmentLock);
    const status = evaluateValidationStatus(validationResult);

    const job: GenerationJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId: genRequest.garmentLock.id,
      colorVariantId: genRequest.colorVariant?.id,
      colorName: genRequest.colorVariant?.name || 'Default',
      productionStyle: genRequest.productionStyle || 'STUDIO_WHITE',
      shotView: genRequest.shotView || 'FRONT',
      label: `${genRequest.garmentLock.name} - ${genRequest.colorVariant?.name || ''} - ${genRequest.shotView || 'FRONT'}`,
      status,
      progress: 100,
      attempts: 1,
      outputAsset,
      outputUrl: outputAsset.url,
      validationScore: validationResult,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (error) {
    console.error('Error in /api/generations:', error);
    return NextResponse.json({ success: false, error: 'Error al procesar generación' }, { status: 500 });
  }
}
