import { randomUUID } from 'node:crypto';
import { GoogleGenAI, Modality, type Part } from '@google/genai';
import type { GenerationRequest, ImageAsset } from '@/types';
import { getImageStorage, resolveImageBytes } from '@/lib/storage/image-storage';
import { compileGenerationPrompt } from './prompt-compiler';

/** Gemini adapter behind the existing real provider facade. */
export class GeminiImageGenerator {
  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-3.1-flash-lite-image',
  ) {}

  async generate(request: GenerationRequest, prompt?: string): Promise<ImageAsset> {
    // Check before resolving references, which may themselves require network access.
    if (!this.apiKey?.trim()) {
      throw new Error('AI_CONFIGURATION_REQUIRED: falta configurar GEMINI_API_KEY en el servidor.');
    }

    const parts: Part[] = [{ text: prompt ?? compileGenerationPrompt(request).rawCombinedPrompt }];
    const references: (ImageAsset | string)[] = [
      ...(request.colorVariant.referenceCrop ? [request.colorVariant.referenceCrop] : []),
      ...(request.colorVariant.referenceAssets || []),
      ...request.referenceImages,
      ...request.garmentLock.referenceImages,
    ];
    const unique = [...new Map(references.map(ref => [typeof ref === 'string' ? ref : ref.url, ref])).values()];
    // Reserve one of the facade's six reference slots for model identity.
    const selected = unique.slice(0, request.modelLock.previewUrl ? 5 : 6);
    if (request.modelLock.previewUrl) selected.push(request.modelLock.previewUrl);
    for (const reference of selected) {
      const resolved = await resolveImageBytes(reference);
      if (!resolved) throw new Error('No se pudo resolver una imagen de referencia para Gemini.');
      parts.push({ inlineData: { mimeType: resolved.mimeType, data: resolved.buffer.toString('base64') } });
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey, httpOptions: { timeout: 60000, retryOptions: { attempts: 1 } } });
    const response = await ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });
    const output = response.candidates?.[0]?.content?.parts?.find(
      part => !part.thought && part.inlineData?.data && part.inlineData.mimeType?.startsWith('image/'),
    )?.inlineData;
    if (!output?.data || !output.mimeType) {
      throw new Error('Gemini no devolvió una imagen generada; la respuesta puede estar vacía o bloqueada.');
    }
    const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[output.mimeType];
    if (!extension) throw new Error(`Formato de imagen Gemini no soportado: ${output.mimeType}`);
    const buffer = Buffer.from(output.data, 'base64');
    if (!buffer.length) throw new Error('Gemini devolvió una imagen vacía.');
    const id = `asset-gemini-${randomUUID()}`;
    const stored = await getImageStorage().put(`${id}.${extension}`, buffer, output.mimeType);
    return {
      id, type: 'GENERATED', source: 'AI', ...stored,
      name: `${request.garmentLock.name} - ${request.colorVariant.name} - ${request.productionStyle} - ${request.shotView}`,
      mimeType: output.mimeType, byteSize: buffer.length,
      providerRequestId: response.responseId, createdAt: new Date().toISOString(),
    };
  }
}
