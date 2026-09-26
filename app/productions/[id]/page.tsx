import { notFound } from 'next/navigation';
import { projectRepository } from '@/lib/storage/project.repository';
import { ProductionDetailView } from '@/features/projects/components/ProductionDetailView';

export const dynamic = 'force-dynamic';

interface ProductionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductionDetailPage({ params }: ProductionDetailPageProps) {
  const { id } = await params;
  const project = await projectRepository.getById(id);

  if (!project) {
    notFound();
  }

  return <ProductionDetailView initialProject={project} />;
}
