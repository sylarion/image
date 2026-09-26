import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';

export async function GET(
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

    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await request.json();

    const repository = getProjectRepository();
    const updated = await repository.update(id, body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ success: false, error: 'Error al actualizar proyecto' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const repository = getProjectRepository();
    const deleted = await repository.delete(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ success: false, error: 'Error al eliminar proyecto' }, { status: 500 });
  }
}
