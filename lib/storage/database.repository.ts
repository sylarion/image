import { Project, DashboardMetrics } from '@/types';
import { IDatabaseProjectRepository } from './repository.interface';

/**
 * Adapter boundary for future persistent database storage (PostgreSQL / Supabase / Neon / Prisma).
 * This class establishes the contract boundary without coupling the rest of the application
 * or requiring active database credentials in the current phase.
 */
export class DatabaseProjectRepository implements IDatabaseProjectRepository {
  private connectionString: string | undefined;

  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.DATABASE_URL;
  }

  async checkConnection(): Promise<boolean> {
    if (!this.connectionString) {
      return false;
    }
    return true;
  }

  async getAll(): Promise<Project[]> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }

  async getById(): Promise<Project | null> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }

  async create(): Promise<Project> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }

  async update(): Promise<Project> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }

  async delete(): Promise<boolean> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }

  async getMetrics(): Promise<DashboardMetrics> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }

  async updateJob(): Promise<Project> {
    throw new Error('DatabaseProjectRepository: Conexión a base de datos real no configurada todavía. Use STORAGE_MODE=mock para la demo.');
  }
}
