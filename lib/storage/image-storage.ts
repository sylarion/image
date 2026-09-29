import fs from 'node:fs';
import path from 'node:path';
import { ImageAsset, SourceImage } from '@/types';

export interface ImageStorage {
  put(key: string, buffer: Buffer, mimeType: string): Promise<{ storageKey: string; url: string }>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): string;
}

export class LocalStorageProvider implements ImageStorage {
  private baseDir: string;
  private publicUrlPrefix: string;

  constructor(baseDir?: string, publicUrlPrefix: string = '/uploads') {
    this.baseDir = baseDir || path.join(process.cwd(), 'public', 'uploads');
    this.publicUrlPrefix = publicUrlPrefix;
    this.ensureDirectory();
  }

  private ensureDirectory() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private sanitizeKey(key: string): string {
    // Prevent path traversal attacks
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const basename = path.basename(normalized);
    const dirname = path.dirname(normalized).replace(/^(\.\.(\/|\\|$))+/, '');
    
    // Disallow absolute or outside path navigation
    if (path.isAbsolute(normalized) || normalized.includes('..')) {
      throw new Error(`Clave de almacenamiento inválida o intento de path traversal: "${key}"`);
    }

    return normalized.replace(/\\/g, '/');
  }

  private getFilePath(key: string): string {
    const safeKey = this.sanitizeKey(key);
    const resolved = path.resolve(this.baseDir, safeKey);
    // Extra safety boundary check
    if (!resolved.startsWith(path.resolve(this.baseDir))) {
      throw new Error(`Violación de seguridad en ruta de almacenamiento: "${key}"`);
    }
    return resolved;
  }

  async put(key: string, buffer: Buffer, _mimeType: string): Promise<{ storageKey: string; url: string }> {
    const safeKey = this.sanitizeKey(key);
    const targetPath = this.getFilePath(safeKey);
    const targetDir = path.dirname(targetPath);

    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.writeFile(targetPath, buffer);

    return {
      storageKey: safeKey,
      url: this.getUrl(safeKey),
    };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const targetPath = this.getFilePath(key);
      return await fs.promises.readFile(targetPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const targetPath = this.getFilePath(key);
      await fs.promises.unlink(targetPath);
      return true;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const targetPath = this.getFilePath(key);
      await fs.promises.access(targetPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    const safeKey = this.sanitizeKey(key);
    return `${this.publicUrlPrefix}/${safeKey}`;
  }
}

// Global singleton for ImageStorage
const globalForStorage = global as unknown as { imageStorageInstance?: ImageStorage };

export function getImageStorage(): ImageStorage {
  if (!globalForStorage.imageStorageInstance) {
    globalForStorage.imageStorageInstance = new LocalStorageProvider();
  }
  return globalForStorage.imageStorageInstance;
}

export function setImageStorage(storage: ImageStorage) {
  globalForStorage.imageStorageInstance = storage;
}

/**
 * Resolves binary bytes from an ImageAsset or URL/Key.
 * Strictly throws if a blob: URL is encountered.
 */
export async function resolveImageBytes(
  input: ImageAsset | SourceImage | string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const urlOrKey = typeof input === 'string' ? input : input.url;
  const storageKey = typeof input === 'string' ? null : (input.storageKey || null);
  const inputMime = typeof input === 'string' ? undefined : input.mimeType;

  if (!urlOrKey && !storageKey) return null;

  // Strict Guard: Never allow blob URLs on the backend
  if (urlOrKey && urlOrKey.startsWith('blob:')) {
    throw new Error(
      `Error de ingestión binaria: Se recibió una URL "blob:" del navegador (${urlOrKey}). Las URLs blob no son accesibles en el backend.`
    );
  }

  const storage = getImageStorage();

  // 1. If explicit storageKey
  if (storageKey) {
    const buf = await storage.get(storageKey);
    if (buf) {
      return { buffer: buf, mimeType: inputMime || 'image/jpeg' };
    }
  }

  // 2. If url points to local uploads prefix
  if (urlOrKey && urlOrKey.startsWith('/uploads/')) {
    const key = urlOrKey.replace(/^\/uploads\//, '');
    const buf = await storage.get(key);
    if (buf) {
      return { buffer: buf, mimeType: inputMime || 'image/jpeg' };
    }
  }

  // 3. If data URL (base64)
  if (urlOrKey && urlOrKey.startsWith('data:')) {
    const matches = urlOrKey.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches) {
      return {
        buffer: Buffer.from(matches[2], 'base64'),
        mimeType: matches[1],
      };
    }
  }

  // 4. If remote HTTP / HTTPS URL
  if (urlOrKey && (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://'))) {
    try {
      const res = await fetch(urlOrKey);
      if (!res.ok) {
        throw new Error(`Fallo al descargar imagen remota (${res.status}): ${urlOrKey}`);
      }
      const arrayBuf = await res.arrayBuffer();
      const mime = res.headers.get('content-type') || inputMime || 'image/jpeg';
      return {
        buffer: Buffer.from(arrayBuf),
        mimeType: mime,
      };
    } catch (err) {
      console.warn(`Error resolving remote image bytes for ${urlOrKey}:`, err);
      return null;
    }
  }

  // 5. Try direct key retrieval on storage as fallback
  if (urlOrKey) {
    const buf = await storage.get(urlOrKey);
    if (buf) {
      return { buffer: buf, mimeType: inputMime || 'image/jpeg' };
    }
  }

  return null;
}
