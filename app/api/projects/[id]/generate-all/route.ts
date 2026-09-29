import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { getImageGenerationProvider } from '@/lib/ai';
import { GenerationJob, MandatoryShotView, ProductionStyle, RawBenchmarkResult } from '@/types';
import { evaluateValidationStatus } from '@/lib/ai/validation';

const CANONICAL_SHOTS: { view: MandatoryShotView; label: string }[] = [
  { view: 'FRONT', label: 'Frente' },
  { view: 'SIDE', label: 'Costado' },
  { view: 'BACK', label: 'Espalda' },
  { view: 'ACTION', label: 'Acción' },
];

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const repository = getProjectRepository();
    const project = await repository.getById(id);

    if (!project) {
      return NextResponse.json({ success: false, error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Wizard projects already own their exact matrix. Never rebuild a fixed matrix.
    if (project.productionSelection) {
      const { getAnalysisRunRepository } = await import('@/lib/storage/analysis-run.repository');
      const { createSelectedProduction } = await import('@/lib/production/selection');
      const run = await getAnalysisRunRepository().getById(project.analysisRunId!);
      if (!run) throw new Error('INVALID_ANALYSIS');
      const verified = createSelectedProduction(run, project.productionSelection);
      const keys = (jobs:GenerationJob[]) => jobs.map(j=>`${j.productGroupId}/${j.colorVariantId}/${j.shotView}/${j.productionStyle}`).sort().join('|');
      if (verified.jobs.length !== project.jobs.length || keys(verified.jobs)!==keys(project.jobs)) throw new Error('JOB_COUNT_MISMATCH');
      const { GenerationJobRunner } = await import('@/lib/ai/job-runner');
      // Preserve the exact persisted matrix and delegate its execution to the
      // runner. This legacy endpoint must not leave verified wizard jobs QUEUED.
      GenerationJobRunner.triggerRun(id, 2);
      return NextResponse.json({success:true,data:project});
    }

    const { selectedPackages, garment, model } = project;
    const activeVariants = garment.colorVariants.filter((v) => v.selected);

    const config = (await import('@/lib/ai/config')).getAiConfig();

    if (config.aiMode === 'real') {
      // Cost Guard: In REAL AI mode, strictly limit to 1 active color variant (max 8 photos)
      if (activeVariants.length > 1) {
        return NextResponse.json({
          success: false,
          error: `[Cost Guard] Solo se permite generar 1 variante de color por sesión (máximo 8 fotografías) para proteger el presupuesto. Desactivá los demás colores temporalmente.`,
        }, { status: 400 });
      }
    }

    const stylesToProduce: { style: ProductionStyle; name: string }[] = [];
    if (selectedPackages.studioWhite) {
      stylesToProduce.push({ style: 'STUDIO_WHITE', name: 'Mercado Libre' });
    }
    if (selectedPackages.editorialCatalog) {
      stylesToProduce.push({ style: 'EDITORIAL_CATALOG', name: 'Catálogo Premium' });
    }

    if (stylesToProduce.length === 0) {
      return NextResponse.json({ success: false, error: 'Debe seleccionar al menos un set (Mercado Libre o Catálogo)' }, { status: 400 });
    }

    const totalJobsToCreate = activeVariants.length * stylesToProduce.length * 4;
    if (config.aiMode === 'real' && totalJobsToCreate > config.maxRealGenerationsPerProduction) {
      return NextResponse.json({
        success: false,
        error: `[Cost Guard] La cantidad solicitada (${totalJobsToCreate}) excede el límite máximo de seguridad (${config.maxRealGenerationsPerProduction} fotografías reales).`,
      }, { status: 400 });
    }

    const provider = getImageGenerationProvider();
    const createdJobs: GenerationJob[] = [];

    // Production Matrix: ColorVariants × Canonical Shots (4) × Styles (1 or 2)
    for (const variant of activeVariants) {
      for (const style of stylesToProduce) {
        for (const shot of CANONICAL_SHOTS) {
          const jobId = `job-${variant.id}-${style.style.toLowerCase()}-${shot.view.toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;

          const startTime = Date.now();
          const genAsset = await provider.generateImage({
            garmentLock: garment,
            colorVariant: variant,
            modelLock: model,
            productionStyle: style.style,
            shotView: shot.view,
            referenceImages: garment.referenceImages,
          });
          const durationMs = Date.now() - startTime;

          const valRes = await provider.validateImage(genAsset, garment);
          const validationStatus = evaluateValidationStatus(valRes);

          // Provider Cost estimation: FLUX Pro VTO ~$0.0475, FLUX.2 ~$0.04
          const isFluxPro = config.generationModel.includes('flux-pro');
          const estimatedCost = config.aiMode === 'real' ? (isFluxPro ? 0.0475 : 0.04) : 0;

          const hardGateResult: 'PASS' | 'FAIL' | 'REVIEW' = 
            validationStatus === 'APPROVED' ? 'PASS' : (validationStatus === 'REJECTED' ? 'FAIL' : 'REVIEW');

          const rawBenchmark: RawBenchmarkResult = {
            experimentId: 'bakeoff-v1',
            provider: 'fal',
            model: config.generationModel,
            shot: shot.view,
            promptVersion: 'v1',
            seed: 424242,
            generation: {
              durationMs,
              providerCost: estimatedCost,
            },
            validation: {
              garmentIdentity: valRes.garmentIdentityScore,
              colorAccuracy: valRes.colorAccuracyScore,
              shape: valRes.shapeScore,
              pattern: valRes.patternScore,
              detail: valRes.detailScore,
              modelIdentity: valRes.modelIdentityScore,
              shotAccuracy: valRes.shotAccuracyScore,
              poseDiversity: valRes.poseDiversityScore,
            },
            hardGateResult,
            issues: valRes.issues || [],
          };

          const job: GenerationJob = {
            id: jobId,
            projectId: id,
            colorVariantId: variant.id,
            colorName: variant.name,
            productionStyle: style.style,
            shotView: shot.view,
            label: `${variant.name} — ${shot.label} (${style.name})`,
            status: validationStatus,
            progress: 100,
            attempts: 1,
            outputAsset: genAsset,
            outputUrl: genAsset.url,
            validationScore: valRes,
            referenceStatus: valRes.referenceStatus,
            rawBenchmark,
            createdAt: new Date().toISOString(),
          };

          createdJobs.push(job);
        }
      }
    }

    project.jobs = createdJobs;
    project.status = 'COMPLETED';
    const updated = await repository.update(id, project);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in batch generate-all matrix:', error);
    return NextResponse.json({ success: false, error: 'Error en la producción' }, { status: 500 });
  }
}
