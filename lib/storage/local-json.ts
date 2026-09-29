import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
// Local runtime persistence. Use shared durable storage for multi-host deployments.
export class LocalJsonStore<T> {
  private static writeQueues = new Map<string, Promise<void>>();

  constructor(private collection:string) {}
  private directory() { return path.join(process.cwd(), '.catalog-data', this.collection); }
  private file(id: string) {
    if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      const entity = this.collection.toUpperCase().replace(/S$/, '').replace(/-/g, '_');
      throw new Error(`INVALID_${entity}_ID`);
    }
    return path.join(this.directory(), `${id}.json`);
  }
  async save(id:string,value:T) {
    const file = this.file(id);
    const previous = LocalJsonStore.writeQueues.get(file) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    LocalJsonStore.writeQueues.set(file, queued);

    await previous;
    try {
      await fs.mkdir(this.directory(),{recursive:true});
      const temp=`${file}.${randomUUID()}.tmp`;
      await fs.writeFile(temp,JSON.stringify(value),'utf8');
      await fs.rename(temp,file);
      return value;
    } finally {
      release();
      if (LocalJsonStore.writeQueues.get(file) === queued) {
        LocalJsonStore.writeQueues.delete(file);
      }
    }
  }
  async get(id:string):Promise<T|null> {
    try { return JSON.parse(await fs.readFile(this.file(id),'utf8')); }
    catch(e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return null; throw e; }
  }
  async all():Promise<T[]> {
    let files:string[];
    try { files=await fs.readdir(this.directory()); } catch(e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return []; throw e; }
    return (await Promise.all(files.filter(f=>f.endsWith('.json')).map(f=>this.get(f.slice(0,-5))))).filter((v):v is Awaited<T>=>v!==null);
  }
  async delete(id:string) { try { await fs.unlink(this.file(id)); return true; } catch(e) { if ((e as NodeJS.ErrnoException).code==='ENOENT') return false; throw e; } }
}
