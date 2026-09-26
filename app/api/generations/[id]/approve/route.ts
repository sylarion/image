import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { transitionJobState } from '@/lib/ai/job-state-machine';

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

    targetJob.status = transitionJobState(targetJob.status, 'APPROVED');
    await repository.updateJob(targetProject.id, targetJob);

    return NextResponse.json({ success: true, data: targetJob });
  } catch (error: unknown) {
    console.error('Error in approve endpoint:', error);
    const msg = error instanceof Error ? error.message : 'Error al aprobar generación';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
