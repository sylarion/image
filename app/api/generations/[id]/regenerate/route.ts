import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { getImageGenerationProvider } from '@/lib/ai';
import { canAttemptRegeneration, transitionJobState } from '@/lib/ai/job-state-machine';
import { evaluateValidationStatus } from '@/lib/ai/validation';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const repository = getProjectRepository();
    const projects = await repository.getAll();

    let targetProject = null;
    let targetJob = null;

    for (const p of projects) {
      const found = p.jobs.find((j) => j.id === id);
      if (found) {
        targetProject = p;
        targetJob = found;
        break;
      }
    }

    if (!targetProject || !targetJob) {
      return NextResponse.json({ success: false, error: 'Generación no encontrada' }, { status: 404 });
    }

    if (!canAttemptRegeneration(targetJob.attempts)) {
      return NextResponse.json({
        success: false,
        error: 'Límite máximo de regeneraciones alcanzado (3 intentos).',
      }, { status: 400 });
    }

    const provider = getImageGenerationProvider();

    targetJob.status = transitionJobState(targetJob.status, 'GENERATING');
    targetJob.attempts += 1;
    await repository.updateJob(targetProject.id, targetJob);

    const colorVariant = targetProject.garment.colorVariants?.find(
      (c) => c.id === targetJob.colorVariantId
    ) || targetProject.garment.colorVariants?.[0];

    const generatedAsset = await provider.generateImage({
      garmentLock: targetProject.garment,
      colorVariant,
      modelLock: targetProject.model,
      productionStyle: targetJob.productionStyle || 'STUDIO_WHITE',
      shotView: targetJob.shotView || 'FRONT',
      referenceImages: targetProject.garment.referenceImages,
    });

    targetJob.outputAsset = generatedAsset;
    targetJob.outputUrl = generatedAsset.url;
    targetJob.status = transitionJobState(targetJob.status, 'VALIDATING');
    await repository.updateJob(targetProject.id, targetJob);

    const validation = await provider.validateImage(generatedAsset, targetProject.garment);
    targetJob.validationScore = validation;
    const nextStatus = evaluateValidationStatus(validation);
    targetJob.status = transitionJobState(targetJob.status, nextStatus);

    await repository.updateJob(targetProject.id, targetJob);
    return NextResponse.json({ success: true, data: targetJob });
  } catch (error: unknown) {
    console.error('Error in regenerate endpoint:', error);
    const msg = error instanceof Error ? error.message : 'Error al regenerar';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
