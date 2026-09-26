import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const repository = getProjectRepository();
    const projects = await repository.getAll();

    for (const p of projects) {
      const job = p.jobs.find((j) => j.id === id);
      if (job) {
        return NextResponse.json({ success: true, data: job });
      }
    }

    return NextResponse.json({ success: false, error: 'Generación no encontrada' }, { status: 404 });
  } catch (error) {
    console.error('Error in GET /api/generations/[id]:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
