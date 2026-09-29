import { LocalJsonStore } from './local-json';
import { SourceImage } from '@/types';

export interface ISourceImageRepository {
  save(image: SourceImage): Promise<SourceImage>;
  getById(id: string): Promise<SourceImage | null>;
  getBySha256(sha256: string): Promise<SourceImage | null>;
  getAll(): Promise<SourceImage[]>;
  delete(id: string): Promise<boolean>;
}

export class InMemorySourceImageRepository implements ISourceImageRepository {
  private images: Map<string, SourceImage> = new Map();
  private shaIndex: Map<string, string> = new Map();

  async save(image: SourceImage): Promise<SourceImage> {
    const clone: SourceImage = JSON.parse(JSON.stringify(image));
    this.images.set(clone.id, clone);
    if (clone.sha256) {
      this.shaIndex.set(clone.sha256, clone.id);
    }
    return clone;
  }

  async getById(id: string): Promise<SourceImage | null> {
    const found = this.images.get(id);
    if (!found) return null;
    return JSON.parse(JSON.stringify(found));
  }

  async getBySha256(sha256: string): Promise<SourceImage | null> {
    const id = this.shaIndex.get(sha256);
    if (!id) return null;
    return this.getById(id);
  }

  async getAll(): Promise<SourceImage[]> {
    return Array.from(this.images.values()).map((img) => JSON.parse(JSON.stringify(img)));
  }

  async delete(id: string): Promise<boolean> {
    const img = this.images.get(id);
    if (img) {
      this.shaIndex.delete(img.sha256);
      return this.images.delete(id);
    }
    return false;
  }
}

class LocalSourceImageRepository implements ISourceImageRepository {
  private store = new LocalJsonStore<SourceImage>('source-images');
  save(image:SourceImage) { return this.store.save(image.id,image); }
  getById(id:string) { return this.store.get(id); }
  async getBySha256(sha:string) { return (await this.store.all()).find(i=>i.sha256===sha) || null; }
  getAll() { return this.store.all(); }
  delete(id:string) { return this.store.delete(id); }
}
const repositoryInstance: ISourceImageRepository = process.env.NODE_ENV === 'test' ? new InMemorySourceImageRepository() : new LocalSourceImageRepository();
export function getSourceImageRepository() { return repositoryInstance; }
