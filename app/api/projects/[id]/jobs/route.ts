import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { getImageGenerationProvider } from '@/lib/ai';
import { transitionJobState, canAttemptRegeneration } from '@/lib/ai/job-state-machine';
import { evaluateValidationStatus } from '@/lib/ai/validation';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await request.json();
    const { jobId, action } = body;

    const repository = getProjectRepository();
    const project = await repository.getById(id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const job = project.jobs.find((j) => j.id === jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Trabajo no encontrado' }, { status: 404 });
    }

    const colorVariant = project.garment.colorVariants.find((v) => v.id === job.colorVariantId) || project.garment.colorVariants[0];

    const provider = getImageGenerationProvider();

    if (action === 'APPROVE') {
      job.status = transitionJobState(job.status, 'APPROVED');
      await repository.updateJob(id, job);
      return NextResponse.json({ success: true, data: job });
    }

    if (action === 'REJECT') {
      job.status = transitionJobState(job.status, 'REJECTED');
      await repository.updateJob(id, job);
      return NextResponse.json({ success: true, data: job });
    }

    if (action === 'GENERATE' || action === 'REGENERATE') {
      if (!canAttemptRegeneration(job.attempts)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Se ha alcanzado el límite máximo de 3 intentos de generación para esta toma.' 
        }, { status: 400 });
      }

      job.status = transitionJobState(job.status, 'GENERATING');
      job.progress = 40;
      job.attempts += 1;
      await repository.updateJob(id, job);

      const generatedAsset = await provider.generateImage({
        garmentLock: project.garment,
        colorVariant,
        modelLock: project.model,
        productionStyle: job.productionStyle,
        shotView: job.shotView,
        referenceImages: project.garment.referenceImages,
      });

      job.outputAsset = generatedAsset;
      job.outputUrl = generatedAsset.url;
      job.status = transitionJobState(job.status, 'VALIDATING');
      job.progress = 85;
      await repository.updateJob(id, job);

      const validation = await provider.validateImage(generatedAsset, project.garment);
      job.validationScore = validation;
      job.progress = 100;
      
      const nextStatus = evaluateValidationStatus(validation);
      job.status = transitionJobState(job.status, nextStatus);

      await repository.updateJob(id, job);
      return NextResponse.json({ success: true, data: job });
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error executing job action:', error);
    const msg = error instanceof Error ? error.message : 'Error al procesar generación';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
