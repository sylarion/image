import { GenerationRequest, ImageAsset } from '@/types';
import { compileGenerationPrompt } from './prompt-compiler';

/**
 * Fal.ai Real Image Generation Adapter.
 * Supports experimental comparative evaluation between:
 * 1. 'fal-ai/flux-pro/v1/vto' (FLUX Pro Virtual Try-On)
 * 2. 'fal-ai/flux-2-lora-gallery/virtual-tryon' (FLUX.2 Fashion Try-On)
 * 
 * Takes:
 * - human_image_url (from ModelLock)
 * - garment_image_url (from GarmentLock / ColorVariant visual reference)
 * - prompt (compiled from PromptCompiler with ShotContract and look rules)
 * - seed (for reproducibility and session identity)
 */
export class FalImageGenerator {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'fal-ai/flux-pro/v1/vto') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(request: GenerationRequest): Promise<ImageAsset> {
    if (!this.apiKey) {
      throw new Error('FAL_KEY no está configurada en el servidor');
    }

    // Compile provider-independent structured prompt
    const compiled = compileGenerationPrompt(request);

    // Garment reference asset URL (prefers variant crop, falls back to first reference image)
    const rawGarmentImageUrl =
      request.colorVariant.referenceCrop || 
      request.colorVariant.referenceAssets?.[0]?.url || 
      request.garmentLock.referenceImages[0]?.url;

    // Resolve local relative paths (e.g. /uploads/crop-...) to either Fal CDN URL or base64 Data URI
    let garmentImageUrl = rawGarmentImageUrl;
    if (rawGarmentImageUrl && (rawGarmentImageUrl.startsWith('/') || rawGarmentImageUrl.startsWith('uploads/'))) {
      const { resolveImageBytes } = await import('@/lib/storage/image-storage');
      const resolved = await resolveImageBytes(rawGarmentImageUrl);
      if (resolved) {
        // Try uploading to fal.storage for a public HTTPS URL first; fallback to Data URI
        try {
          garmentImageUrl = await this.uploadToFalStorage(resolved.buffer, resolved.mimeType, 'garment-crop.png');
        } catch {
          garmentImageUrl = `data:${resolved.mimeType};base64,${resolved.buffer.toString('base64')}`;
        }
      }
    }

    // Model identity reference preview
    if (!request.modelLock?.modelId) {
      throw new Error('MODEL_LOCK_REQUIRED: Se requiere un modelLock explícito con modelId.');
    }
    let humanImageUrl = request.modelLock.previewUrl;
    if (!humanImageUrl && request.modelLock.modelId !== 'model-no-model') {
      throw new Error(`MODEL_REFERENCE_REQUIRED: El modelo seleccionado (${request.modelLock.name || request.modelLock.modelId}) no posee previewUrl ni referencia visual.`);
    }
    if (humanImageUrl && (humanImageUrl.startsWith('/') || humanImageUrl.startsWith('uploads/'))) {
      const { resolveImageBytes } = await import('@/lib/storage/image-storage');
      const resolved = await resolveImageBytes(humanImageUrl);
      if (resolved) {
        try {
          humanImageUrl = await this.uploadToFalStorage(resolved.buffer, resolved.mimeType, 'model-preview.png');
        } catch {
          humanImageUrl = `data:${resolved.mimeType};base64,${resolved.buffer.toString('base64')}`;
        }
      }
    }

    const endpoint = `https://queue.fal.run/${this.model}`;

    const isFlux2 = this.model.includes('flux-2');
    
    const catLower = (request.garmentLock.category || '').toLowerCase();
    const vtoCategory = (catLower.includes('remera') || catLower.includes('top') || catLower.includes('camisa') || catLower.includes('blusa') || catLower.includes('buzo'))
      ? 'tops'
      : (catLower.includes('pantalon') || catLower.includes('falda') || catLower.includes('short') || catLower.includes('jean'))
      ? 'bottoms'
      : 'one-pieces';

    // Payload adapts gracefully between FLUX Pro VTO and FLUX.2 Try-On schemas
    const payload = isFlux2
      ? {
          human_image: humanImageUrl,
          garment_image: garmentImageUrl,
          prompt: compiled.rawCombinedPrompt,
          seed: 424242,
        }
      : {
          prompt: compiled.rawCombinedPrompt,
          garment_image_url: garmentImageUrl,
          human_image_url: humanImageUrl,
          category: vtoCategory,
          seed: 424242,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        };

    const startTime = Date.now();
    const config = (await import('./config')).getAiConfig();

    try {
      // 1. Explicit Submission Timeout (POST to Fal queue)
      const submissionController = new AbortController();
      const submissionTimer = setTimeout(() => submissionController.abort(), config.falSubmissionTimeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: submissionController.signal,
      });
      clearTimeout(submissionTimer);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Fal.ai error (${response.status}): ${errText}`);
      }

      const queueResult = await response.json();
      let outputUrl: string | undefined;
      const providerRequestId = queueResult.request_id || queueResult.id;

      // 2. Explicit Queue / Polling Timeout
      const queueController = new AbortController();
      const queueTimer = setTimeout(() => queueController.abort(), config.falQueueTimeoutMs);

      if (queueResult.images && queueResult.images[0]?.url) {
        outputUrl = queueResult.images[0].url;
      } else if (queueResult.status_url) {
        outputUrl = await this.pollQueue(queueResult.status_url, Math.ceil(config.falQueueTimeoutMs / 2500), queueController.signal);
      } else if (queueResult.response_url) {
        outputUrl = await this.pollQueue(queueResult.response_url, Math.ceil(config.falQueueTimeoutMs / 2500), queueController.signal);
      }
      clearTimeout(queueTimer);

      if (!outputUrl) {
        throw new Error('Fal.ai no devolvió URL de imagen válida en la respuesta');
      }

      const durationMs = Date.now() - startTime;
      console.log(`[Fal.ai Generation] Model: ${this.model} | ReqId: ${providerRequestId} | View: ${request.shotView} | Latency: ${durationMs}ms`);

      return {
        id: `asset-fal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'GENERATED',
        source: 'AI',
        url: outputUrl,
        name: `${request.garmentLock.name} - ${request.colorVariant.name} - ${request.productionStyle} - ${request.shotView}`,
        mimeType: 'image/jpeg',
        providerRequestId,
        createdAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      console.error(`Error generating image with Fal model ${this.model}:`, err);
      throw err;
    }
  }

  private async pollQueue(statusUrl: string, maxAttempts = 120, signal?: AbortSignal): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) {
        throw new Error('Generación cancelada por timeout de cola (excedió tiempo máximo de espera)');
      }
      await new Promise((r) => setTimeout(r, 2500));

      const res = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${this.apiKey}` },
        signal,
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data.status === 'COMPLETED' && data.images && data.images[0]?.url) {
        return data.images[0].url;
      }
      if (data.status === 'FAILED') {
        throw new Error(`Fal.ai generation job failed: ${data.error || 'Unknown queue error'}`);
      }
    }
    throw new Error('Timeout esperando resultado de Fal.ai (excedió intentos máximos de polling)');
  }

  /**
   * Uploads raw binary buffer to Fal storage to get an official public HTTPS URL.
   * If fal storage API fails, caller falls back safely to Data URI.
   */
  async uploadToFalStorage(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const uploadInitiateRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: filename,
        content_type: mimeType,
      }),
    });

    if (!uploadInitiateRes.ok) {
      throw new Error(`Fal storage initiate failed: ${uploadInitiateRes.status}`);
    }

    const { upload_url, file_url } = await uploadInitiateRes.json();

    const putRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: buffer as unknown as BodyInit,
    });

    if (!putRes.ok) {
      throw new Error(`Fal storage upload failed: ${putRes.status}`);
    }

    return file_url;
  }
}
