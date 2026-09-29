import { LocalJsonStore } from './local-json';
import { AnalysisRun } from '@/types';

export interface IAnalysisRunRepository {
  save(run: AnalysisRun): Promise<AnalysisRun>;
  getById(id: string): Promise<AnalysisRun | null>;
  getLatest(): Promise<AnalysisRun | null>;
  getAll(limit?: number): Promise<AnalysisRun[]>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryAnalysisRunRepository implements IAnalysisRunRepository {
  private runs: Map<string, AnalysisRun> = new Map();
  private order: string[] = [];

  async save(run: AnalysisRun): Promise<AnalysisRun> {
    const clone: AnalysisRun = JSON.parse(JSON.stringify(run));
    this.runs.set(clone.analysisRunId, clone);
    if (!this.order.includes(clone.analysisRunId)) {
      this.order.unshift(clone.analysisRunId);
    }
    return clone;
  }

  async getById(id: string): Promise<AnalysisRun | null> {
    const found = this.runs.get(id);
    if (!found) return null;
    return JSON.parse(JSON.stringify(found));
  }

  async getLatest(): Promise<AnalysisRun | null> {
    if (this.order.length === 0) return null;
    const latestId = this.order[0];
    return this.getById(latestId);
  }

  async getAll(limit: number = 20): Promise<AnalysisRun[]> {
    const ids = this.order.slice(0, limit);
    return ids
      .map((id) => this.runs.get(id))
      .filter((r): r is AnalysisRun => Boolean(r))
      .map((r) => JSON.parse(JSON.stringify(r)));
  }

  async delete(id: string): Promise<boolean> {
    this.order = this.order.filter((o) => o !== id);
    return this.runs.delete(id);
  }
}

export class LocalAnalysisRunRepository implements IAnalysisRunRepository {
  private store = new LocalJsonStore<AnalysisRun>('analysis-runs');
  save(run:AnalysisRun) { return this.store.save(run.analysisRunId,run); }
  getById(id:string) { return this.store.get(id); }
  async getAll(limit=20) { return (await this.store.all()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit); }
  async getLatest() { return (await this.getAll(1))[0] || null; }
  delete(id:string) { return this.store.delete(id); }
}
const repositoryInstance: IAnalysisRunRepository = process.env.NODE_ENV === 'test' ? new InMemoryAnalysisRunRepository() : new LocalAnalysisRunRepository();
export function getAnalysisRunRepository() { return repositoryInstance; }
