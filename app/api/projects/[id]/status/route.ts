import { NextResponse } from 'next/server';
import { GenerationJobRunner } from '@/lib/ai/job-runner';

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const status = await GenerationJobRunner.getProjectStatus(id);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error fetching project status:', error);
    return NextResponse.json(
      { success: false, error: 'Error al consultar estado de producción' },
      { status: 500 }
    );
  }
}
