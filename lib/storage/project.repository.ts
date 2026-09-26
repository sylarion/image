import { Project, DashboardMetrics, GenerationJob, StorageMode } from '@/types';
import { IProjectRepository } from './repository.interface';
import { INITIAL_MOCK_PROJECTS } from '../constants/mock-projects';
import { DatabaseProjectRepository } from './database.repository';

/**
 * In-memory repository with global singleton pattern.
 * Explicitly designed for local development and visual demo executions.
 * NOTE: Serverless runtimes (e.g. Vercel) lose memory state between cold starts and instances.
 * Use DatabaseProjectRepository with STORAGE_MODE=database for production persistence.
 */
class InMemoryProjectRepository implements IProjectRepository {
  private projects: Map<string, Project> = new Map();

  constructor() {
    this.seed();
  }

  private seed() {
    for (const proj of INITIAL_MOCK_PROJECTS) {
      this.projects.set(proj.id, JSON.parse(JSON.stringify(proj)));
    }
  }

  async getAll(): Promise<Project[]> {
    const list = Array.from(this.projects.values());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getById(id: string): Promise<Project | null> {
    const proj = this.projects.get(id);
    if (!proj) return null;
    return JSON.parse(JSON.stringify(proj));
  }

  async create(project: Project): Promise<Project> {
    this.projects.set(project.id, JSON.parse(JSON.stringify(project)));
    return project;
  }

  async update(id: string, updates: Partial<Project>): Promise<Project> {
    const current = this.projects.get(id);
    if (!current) {
      throw new Error(`Project with ID ${id} not found`);
    }
    const updated: Project = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.projects.set(id, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  async delete(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async getMetrics(): Promise<DashboardMetrics> {
    const all = Array.from(this.projects.values());
    let totalGeneratedImages = 0;
    let approvedImages = 0;
    let pendingJobs = 0;

    for (const p of all) {
      for (const job of p.jobs) {
        if (job.outputUrl || job.outputAsset?.url) {
          totalGeneratedImages++;
        }
        if (job.status === 'APPROVED') {
          approvedImages++;
        }
        if (job.status === 'QUEUED' || job.status === 'GENERATING' || job.status === 'VALIDATING') {
          pendingJobs++;
        }
      }
    }

    return {
      totalGarments: all.length,
      totalGeneratedImages,
      approvedImages,
      pendingJobs,
    };
  }

  async updateJob(projectId: string, updatedJob: GenerationJob): Promise<Project> {
    const current = this.projects.get(projectId);
    if (!current) {
      throw new Error(`Project ${projectId} not found`);
    }
    const jobIndex = current.jobs.findIndex((j) => j.id === updatedJob.id);
    if (jobIndex >= 0) {
      current.jobs[jobIndex] = updatedJob;
    } else {
      current.jobs.push(updatedJob);
    }
    current.updatedAt = new Date().toISOString();

    const allFinished = current.jobs.length > 0 && current.jobs.every(
      (j) => j.status === 'APPROVED' || j.status === 'REVIEW_REQUIRED' || j.status === 'REJECTED' || j.status === 'FAILED'
    );
    if (allFinished) {
      current.status = 'COMPLETED';
    }

    this.projects.set(projectId, current);
    return JSON.parse(JSON.stringify(current));
  }
}

// Storage Factory resolving repository according to STORAGE_MODE environment variable
class StorageFactory {
  private activeRepo: IProjectRepository;
  private mode: StorageMode;

  constructor() {
    this.mode = (process.env.STORAGE_MODE as StorageMode) || 'mock';
    if (this.mode === 'database') {
      this.activeRepo = new DatabaseProjectRepository();
    } else {
      this.activeRepo = new InMemoryProjectRepository();
    }
  }

  getRepository(): IProjectRepository {
    return this.activeRepo;
  }

  getStorageMode(): StorageMode {
    return this.mode;
  }

  setRepository(repo: IProjectRepository) {
    this.activeRepo = repo;
  }
}

// Global declaration to survive Next.js HMR development reloads
const globalForStorage = global as unknown as { storageFactory: StorageFactory | undefined };

const storageFactory = globalForStorage.storageFactory ?? new StorageFactory();

if (process.env.NODE_ENV !== 'production') {
  globalForStorage.storageFactory = storageFactory;
}

export function getProjectRepository(): IProjectRepository {
  return storageFactory.getRepository();
}

// Legacy export compatibility
export const projectRepository = storageFactory.getRepository();
