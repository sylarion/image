import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { VisualWizardAdapters } from '@/features/wizard/models/wizard.types';
import { FriendlyErrorMapper } from '@/features/wizard/engine/decision-engine';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSourceImageRepository } from '@/lib/storage/source-image.repository';
import { getVisualDetectionPipeline } from '@/lib/vision';
import { SourceImage } from '@/types';
import { getRealAnalysisConfigurationIssue, getAiConfig } from '@/lib/ai/config';
import { SceneAnalysisError } from '@/lib/vision/scene-analyzer';

const AnalyzeSceneRequestSchema = z.object({
  recovery: z.object({analysisRunId:z.string(),productGroupId:z.string(),colorName:z.string().trim().min(1).max(80)}).optional(),
  sourceImageIds: z.array(z.string().min(1)).min(1, 'Se requiere al menos un ID de imagen para analizar.'),
});

export async function POST(request: Request) {
  try {
    const runtimeIssue = getRealAnalysisConfigurationIssue();
    if (runtimeIssue) {
      return NextResponse.json({ success: false, code: 'AI_CONFIGURATION_REQUIRED', error: runtimeIssue }, { status: 422 });
    }
    const body = await request.json();
    const parsed = AnalyzeSceneRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { sourceImageIds } = parsed.data;
    const sourceRepo = getSourceImageRepository();
    const sourceImages: SourceImage[] = [];

    for (const id of sourceImageIds) {
      const found = await sourceRepo.getById(id);
      if (!found) {
        return NextResponse.json(
          { success: false, error: 'No encontramos la foto. Volvé a subirla.' },
          { status: 404 }
        );
      }
      sourceImages.push(found);
    }

    // Step 1: Secure instrumentation log
    const config = getAiConfig();
    console.log('[analyze-scene:start]', {
      AI_MODE: config.aiMode,
      ANALYSIS_PROVIDER: config.analysisProvider,
      ANALYSIS_MODEL: config.analysisModel,
      GEMINI_API_KEY_configured: Boolean(config.geminiApiKey && config.geminiApiKey.trim().length > 0),
      sourceImageIds,
      images: sourceImages.map(s => ({
        id: s.id,
        mimeType: s.mimeType,
        byteSize: s.byteSize,
        width: s.width,
        height: s.height
      }))
    });

    const recovery = parsed.data.recovery;
    const runRepo = getAnalysisRunRepository();
    const parent = recovery ? await runRepo.getById(recovery.analysisRunId) : null;
    const target = parent?.productGroups.find(g=>g.id===recovery?.productGroupId);
    if (recovery && (!parent || parent.status !== 'COMPLETED' || !target)) return NextResponse.json({success:false,error:'Volvé a analizar las fotos.'},{status:400});
    const pipeline = getVisualDetectionPipeline();
    const result = await pipeline.processSourceImages(sourceImages);

    if (recovery && parent && target && result.analysisRun) {
      const incoming = result.productGroups.flatMap(g=>g.variants);
      if (incoming.length !== 1) return NextResponse.json({success:false,error:'Subí una foto que muestre solamente el color que falta.'},{status:422});
      const v = incoming[0]; v.productGroupId=target.id; v.analysisRunId=parent.analysisRunId;
      target.variants.push(v);
      for (const g of result.productGroups) target.references.push(...g.references.map(r=>({...r,productGroupId:target.id})));
      parent.sourceImages.push(...sourceImages.filter(s=>!parent.sourceImages.some(p=>p.id===s.id)));
      parent.sourceImageIds=parent.sourceImages.map(s=>s.id);
      result.analyses.forEach(a=>a.garments.forEach(d=>{d.analysisRunId=parent.analysisRunId;}));
      parent.analyses.push(...result.analyses);
      parent.detections.push(...result.analyses.flatMap(a=>a.garments).map(d=>({...d,analysisRunId:parent.analysisRunId})));
      parent.crops.push(...result.crops.map(c=>({...c,analysisRunId:parent.analysisRunId})));
      parent.observedVariants.push(...(result.observedVariants || []).map(o=>({...o,analysisRunId:parent.analysisRunId})));
      parent.executionMetrics.detectionCount=parent.detections.length;
      parent.executionMetrics.cropsCount=parent.crops.length;
      parent.executionMetrics.observedVariantsCount=parent.observedVariants.length;
      parent.executionMetrics.finalVariantsCount=parent.productGroups.reduce((n,g)=>n+g.variants.length,0);
      const products=VisualWizardAdapters.toProductChoices({...result,crops:parent.crops,productGroups:parent.productGroups});
      const added=products.find(p=>p.id===target.id)!.colors.find(c=>c.id===v.id)!;
      added.name=recovery.colorName; added.isUserCorrected=true;
      parent.adapterOutput=products;
      await runRepo.save(parent);
      return NextResponse.json({success:true,data:{analysisRunId:parent.analysisRunId,products}});
    }
    return NextResponse.json({
      success: true,
      data: {
        analysisRunId: result.analysisRun?.analysisRunId,
        products: VisualWizardAdapters.toProductChoices(result),
        sanityCheck: result.sanityCheck,
      },
    });
  } catch (error: any) {
    const diagnostic = error?.diagnostic || (error instanceof SceneAnalysisError ? error.diagnostic : undefined);
    console.error('[analyze-scene:diagnostic]', {
      errorStage: diagnostic?.errorStage,
      internalErrorCode: error?.code || 'ANALYSIS_UNAVAILABLE',
      providerStatus: diagnostic?.providerStatus,
      providerStatusText: diagnostic?.providerStatusText,
      providerMessageSanitized: diagnostic?.providerMessageSanitized,
      zodError: diagnostic?.zodError,
      rootCause: diagnostic?.rootCause,
      message: error instanceof Error ? error.message : String(error)
    });

    if (error?.code === 'ANALYSIS_UNAVAILABLE' || (error instanceof Error && error.message.includes('ANALYSIS_UNAVAILABLE'))) {
      const message = error instanceof Error ? error.message : '';
      const providerMessage = message.includes('GEMINI_CREDENTIALS_REJECTED')
        ? 'Gemini rechazó las credenciales configuradas. Revisá GEMINI_API_KEY en el servidor.'
        : message.includes('GEMINI_RATE_LIMITED')
          ? 'Gemini alcanzó su límite de solicitudes. Esperá unos minutos e intentá nuevamente.'
          : message.includes('GEMINI_REQUEST_FAILED')
            ? 'Gemini no pudo procesar esta foto en este momento. Revisá la configuración del proveedor o intentá nuevamente.'
            : 'No pudimos analizar automáticamente esta foto. Probá nuevamente o subí otra imagen.';
      return NextResponse.json(
        {
          success: false,
          code: 'ANALYSIS_UNAVAILABLE',
          error: providerMessage,
          diagnostic: diagnostic || {
            errorStage: 'D_GEMINI_HTTP_REQUEST',
            internalErrorCode: 'ANALYSIS_UNAVAILABLE',
            rootCause: message
          },
        },
        { status: 422 }
      );
    }
    const msg = error instanceof Error ? error.message : 'Error al analizar escena visual';
    return NextResponse.json({ success: false, code: error?.code || 'ANALYSIS_FAILED', error: FriendlyErrorMapper.toUserMessage(msg), diagnostic }, { status: 500 });
  }
}

