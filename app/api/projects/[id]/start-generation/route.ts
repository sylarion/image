import { NextResponse } from 'next/server';
import { GenerationJobRunner } from '@/lib/ai/job-runner';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { canAttemptRegeneration, transitionJobState } from '@/lib/ai/job-state-machine';
import { getRealRuntimeConfigurationIssue } from '@/lib/ai/config';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const runtimeIssue = getRealRuntimeConfigurationIssue();
    if (runtimeIssue) return NextResponse.json({ success: false, code: 'AI_CONFIGURATION_REQUIRED', error: runtimeIssue }, { status: 422 });
    const { id } = await props.params;
    const project = await getProjectRepository().getById(id);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    let concurrency = 2;
    let targetJobId: string | undefined = undefined;
    try {
      const body = await request.json();
      if (body && typeof body.concurrency === 'number' && body.concurrency > 0) {
        concurrency = Math.min(body.concurrency, 4);
      }
      if (body && typeof body.jobId === 'string' && body.jobId.trim().length > 0) {
        targetJobId = body.jobId.trim();
      }
    } catch {
      // Body is optional
    }

    const quote = project.pricingSnapshot;
    const totalAttempts = project.jobs.reduce((sum, j) => sum + (j.attempts || 0), 0);

    // Physical Cost Guard enforcement
    if (quote?.maxAttempts && totalAttempts >= quote.maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'COST_GUARD: El proyecto alcanzó el límite máximo de intentos autorizados.', code: 'COST_GUARD' },
        { status: 422 }
      );
    }
    if (quote?.maxEstimatedCostUsd && quote.maxEstimatedCostUsd > 0) {
      const costPerAttempt = (quote.estimatedCostPerImageUsd ?? 0) + (quote.estimatedValidationCostUsd && quote.imageCount ? quote.estimatedValidationCostUsd / quote.imageCount : 0);
      if (costPerAttempt > 0 && Number(((totalAttempts + 1) * costPerAttempt).toFixed(4)) > quote.maxEstimatedCostUsd + 0.0001) {
        return NextResponse.json(
          { success: false, error: 'COST_GUARD: El costo superaría el presupuesto máximo autorizado.', code: 'COST_GUARD' },
          { status: 422 }
        );
      }
    }

    for (const job of project.jobs) {
      if (targetJobId && job.id !== targetJobId) continue;
      const retryable = job.status === 'FAILED' || job.status === 'REJECTED';
      if (!retryable || !canAttemptRegeneration(job.attempts)) continue;

      job.status = transitionJobState(job.status, 'QUEUED');
      job.progress = 0;
      job.errorCode = undefined;
      job.errorMessage = undefined;
      job.userFriendlyMessage = undefined;
      job.error = undefined;
      job.updatedAt = new Date().toISOString();
      job.completedAt = undefined;
      await getProjectRepository().updateJob(id, job);
    }

    // Trigger runner asynchronously
    GenerationJobRunner.triggerRun(id, concurrency);

    return NextResponse.json({
      success: true,
      message: 'Runner de generación iniciado exitosamente',
      projectId: id,
      concurrency,
    });
  } catch (error) {
    console.error('Error starting generation runner:', error);
    return NextResponse.json(
      { success: false, error: 'Error al iniciar el runner de generación' },
      { status: 500 }
    );
  }
}
