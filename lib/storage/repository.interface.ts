import { Project, DashboardMetrics, GenerationJob } from '@/types';

export interface IProjectRepository {
  getAll(): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  create(project: Project): Promise<Project>;
  update(id: string, updates: Partial<Project>): Promise<Project>;
  delete(id: string): Promise<boolean>;
  getMetrics(): Promise<DashboardMetrics>;
  updateJob(projectId: string, job: GenerationJob): Promise<Project>;
}

/**
 * Boundary contract specifically for persistent database engines
 * (e.g. Prisma / Supabase / Neon / PostgreSQL).
 * Extends IProjectRepository with health checks and transaction hooks.
 */
export interface IDatabaseProjectRepository extends IProjectRepository {
  /**
   * Verifies persistent connection to the external SQL/NoSQL cluster.
   */
  checkConnection(): Promise<boolean>;
}
