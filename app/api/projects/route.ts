import { createSelectedProduction } from '@/lib/production/selection';
import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { NextResponse } from 'next/server';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { CreateProjectSchema } from '@/lib/schemas/project';
import { getImageGenerationProvider } from '@/lib/ai';
import { DEFAULT_MODEL } from '@/lib/constants/models';
import { Project } from '@/types';
import { getRealRuntimeConfigurationIssue } from '@/lib/ai/config';

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
    const runtimeIssue = getRealRuntimeConfigurationIssue();
    if (runtimeIssue) return NextResponse.json({ success: false, code: 'AI_CONFIGURATION_REQUIRED', error: runtimeIssue }, { status: 422 });
    const body = await request.json();
    if (body.analysisRunId) {
      const runRepo = getAnalysisRunRepository();
      const run = await runRepo.getById(body.analysisRunId);
      if (!run) return NextResponse.json({success:false,error:'Volvé a analizar las fotos antes de crear la producción.'},{status:400});
      const project = createSelectedProduction(run, body);
      const saved = await getProjectRepository().create(project);
      run.wizardSelection = project.productionSelection;
      run.generationJobs = project.jobs;
      run.expectedJobs = project.productionSelection!.expectedJobs;
      run.actualJobs = project.jobs.length;
      await runRepo.save(run);

      // Trigger asynchronous GenerationJobRunner immediately
      const { GenerationJobRunner } = await import('@/lib/ai/job-runner');
      GenerationJobRunner.triggerRun(saved.id, 2);

      return NextResponse.json({success:true,data:saved},{status:201});
    }
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Datos inválidos', 
        details: parsed.error.issues 
      }, { status: 400 });
    }

    const { name, category, sizes, images } = parsed.data;
    const sourceRepo = (await import('@/lib/storage/source-image.repository')).getSourceImageRepository();
    const resolvedImages: import('@/types').ImageAsset[] = [];

    for (let idx = 0; idx < images.length; idx++) {
      const item = images[idx];
      if ('sourceImageId' in item && item.sourceImageId) {
        const sourceImage = await sourceRepo.getById(item.sourceImageId);
        if (!sourceImage) {
          return NextResponse.json({
            success: false,
            error: `SourceImage no encontrada para el ID: "${item.sourceImageId}".`,
          }, { status: 400 });
        }
        resolvedImages.push({
          id: `ref-${sourceImage.id}`,
          type: 'REFERENCE',
          source: 'UPLOAD',
          url: sourceImage.url,
          name: sourceImage.originalFilename,
          width: sourceImage.width,
          height: sourceImage.height,
          mimeType: sourceImage.mimeType,
          order: item.order ?? idx,
          sourceImageId: sourceImage.id,
          sha256: sourceImage.sha256,
          storageKey: sourceImage.storageKey,
          byteSize: sourceImage.byteSize,
          createdAt: sourceImage.createdAt,
        });
      } else if ('url' in item && item.url) {
        if (item.url.startsWith('blob:')) {
          return NextResponse.json({
            success: false,
            error: 'Las URLs "blob:" no están permitidas en el backend. Use /api/uploads para subir la imagen previamente.',
          }, { status: 400 });
        }
        resolvedImages.push(item as import('@/types').ImageAsset);
      }
    }

    const provider = getImageGenerationProvider();

    // Call provider's analyzeGarment to generate Garment Lock with detected ColorVariants
    const garmentLock = await provider.analyzeGarment({
      name,
      category,
      sizes,
      referenceImages: resolvedImages,
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
    return NextResponse.json({ success: false, error: 'Error al crear la producción', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
