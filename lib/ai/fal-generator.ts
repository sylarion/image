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
    const garmentImageUrl = 
      request.colorVariant.referenceCrop || 
      request.colorVariant.referenceAssets?.[0]?.url || 
      request.garmentLock.referenceImages[0]?.url;

    // Model identity reference preview
    const humanImageUrl = request.modelLock.previewUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80';

    const endpoint = `https://queue.fal.run/${this.model}`;

    const isFlux2 = this.model.includes('flux-2');
    
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
          category: 'one-pieces',
          seed: 424242,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        };

    const startTime = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Fal.ai error (${response.status}): ${errText}`);
      }

      const queueResult = await response.json();
      let outputUrl: string | undefined;

      // Handle Fal.ai queue polling or direct response
      if (queueResult.images && queueResult.images[0]?.url) {
        outputUrl = queueResult.images[0].url;
      } else if (queueResult.status_url) {
        outputUrl = await this.pollQueue(queueResult.status_url);
      } else if (queueResult.response_url) {
        outputUrl = await this.pollQueue(queueResult.response_url);
      }

      if (!outputUrl) {
        throw new Error('Fal.ai no devolvió URL de imagen válida en la respuesta');
      }

      const durationMs = Date.now() - startTime;
      console.log(`[Fal.ai Generation] Model: ${this.model} | View: ${request.shotView} | Latency: ${durationMs}ms`);

      return {
        id: `asset-fal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'GENERATED',
        source: 'AI',
        url: outputUrl,
        name: `${request.garmentLock.name} - ${request.colorVariant.name} - ${request.productionStyle} - ${request.shotView}`,
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      console.error(`Error generating image with Fal model ${this.model}:`, err);
      throw err;
    }
  }

  private async pollQueue(statusUrl: string, maxAttempts = 30): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 1500));

      const res = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${this.apiKey}` },
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
    throw new Error('Timeout esperando resultado de Fal.ai (excedió 45s)');
  }
}
