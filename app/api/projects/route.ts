import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { CreateProjectSchema } from '@/lib/schemas/project';
import { getImageGenerationProvider } from '@/lib/ai';
import { DEFAULT_MODEL } from '@/lib/constants/models';
import { Project } from '@/types';

export async function GET() {
  try {
    const repository = getProjectRepository();
    const projects = await repository.getAll();
    const metrics = await repository.getMetrics();
    return NextResponse.json({ success: true, data: { projects, metrics } });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener proyectos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: parsed.error.issues 
      }, { status: 400 });
    }

    const { name, category, sizes, images } = parsed.data;
    const provider = getImageGenerationProvider();

    // Call provider's analyzeGarment to generate Garment Lock with detected ColorVariants
    const garmentLock = await provider.analyzeGarment({
      name,
      category,
      sizes,
      referenceImages: images,
    });

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      garment: garmentLock,
      model: DEFAULT_MODEL,
      selectedPackages: {
        studioWhite: true,
        editorialCatalog: true,
      },
      jobs: []
    };

    const repository = getProjectRepository();
    const saved = await repository.create(newProject);
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ success: false, error: 'Error al crear la producción' }, { status: 500 });
  }
}
