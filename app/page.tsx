import { projectRepository } from '@/lib/storage/project.repository';
import { DashboardView } from '@/features/projects/components/DashboardView';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [projects, metrics] = await Promise.all([
    projectRepository.getAll(),
    projectRepository.getMetrics(),
  ]);

  return <DashboardView initialProjects={projects} metrics={metrics} />;
}
