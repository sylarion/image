import { FriendlyErrorMapper } from '@/features/wizard/engine/decision-engine';
import { NextResponse } from 'next/server';
import { normalizeImage, sanitizeFilename } from '@/lib/images/normalizer';
import { getImageStorage } from '@/lib/storage/image-storage';
import { getSourceImageRepository } from '@/lib/storage/source-image.repository';
import { SourceImage } from '@/types';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se envió ningún archivo en el campo "file".' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // 1. Image validation & normalization (magic bytes, EXIF rotate, sRGB, dimensions, SHA-256)
    const normalized = await normalizeImage(inputBuffer, file.type);

    // 2. Deduplication check via SHA-256
    const sourceRepo = getSourceImageRepository();
    const existing = await sourceRepo.getBySha256(normalized.sha256);

    if (existing) {
      return NextResponse.json({
        success: true,
        deduplicated: true,
        data: existing,
      });
    }

    // 3. Persistent storage
    const storage = getImageStorage();
    const safeName = sanitizeFilename(file.name);
    const extension = normalized.mimeType === 'image/jpeg' ? 'jpg' : normalized.mimeType === 'image/png' ? 'png' : 'webp';
    const storageKey = `src-${normalized.sha256.slice(0, 16)}.${extension}`;

    const storageResult = await storage.put(storageKey, normalized.buffer, normalized.mimeType);

    // 4. Create SourceImage entity
    const sourceImage: SourceImage = {
      id: `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      originalFilename: safeName,
      mimeType: normalized.mimeType,
      byteSize: normalized.byteSize,
      width: normalized.width,
      height: normalized.height,
      sha256: normalized.sha256,
      storageKey: storageResult.storageKey,
      url: storageResult.url,
      createdAt: new Date().toISOString(),
      role: 'UNKNOWN',
      source: 'USER_UPLOAD',
    };

    const saved = await sourceRepo.save(sourceImage);

    return NextResponse.json({
      success: true,
      deduplicated: false,
      data: saved,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in /api/uploads:', error);
    const message = error instanceof Error ? error.message : 'Error al procesar el archivo';
    return NextResponse.json({ success: false, error: FriendlyErrorMapper.toUserMessage(message) }, { status: 400 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const sourceRepo = getSourceImageRepository();

    if (id) {
      const found = await sourceRepo.getById(id);
      if (!found) {
        return NextResponse.json({ success: false, error: 'Imagen no encontrada' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: found });
    }

    const all = await sourceRepo.getAll();
    return NextResponse.json({ success: true, data: all });
  } catch (error: unknown) {
    console.error('Error fetching source images:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
