import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { GeminiImageGenerator } from '@/lib/ai/gemini-generator';
import { RealImageGenerationProvider } from '@/lib/ai/real-provider';
import { FalImageGenerator } from '@/lib/ai/fal-generator';
import { getAiConfig } from '@/lib/ai/config';
import { setImageStorage } from '@/lib/storage/image-storage';
import { GenerationPricingService } from '@/lib/pricing/pricing-service';
import type { GenerationRequest } from '@/types';

async function run() {
  Object.assign(process.env, { NODE_ENV: 'test', AI_MODE: 'real', GENERATION_PROVIDER: 'gemini', GENERATION_ENABLED: 'true', ANALYSIS_PROVIDER: 'gemini', VALIDATION_PROVIDER: 'gemini' });
  delete process.env.GENERATION_MODEL;
  delete process.env.GEMINI_API_KEY;
  delete process.env.FAL_KEY;
  delete process.env.GENERATION_COST_PER_IMAGE_USD;
  // All network is replaced in this process. No SDK request leaves the test.
  const network = mock.method(globalThis, 'fetch', async () => { throw new Error('External network forbidden'); });
  const request = {
    garmentLock: { name: 'Test garment', details: [], mustPreserve: [], mustNotChange: [], referenceImages: [] },
    colorVariant: { name: 'Red', referenceCrop: 'data:image/png;base64,YQ==' },
    modelLock: { previewUrl: 'data:image/png;base64,Yg==' },
    productionStyle: 'STUDIO_WHITE', shotView: 'FRONT', referenceImages: [],
  } as unknown as GenerationRequest;
  await assert.rejects(new GeminiImageGenerator('').generate(request), /GEMINI_API_KEY/);
  assert.throws(() => new RealImageGenerationProvider(), /GEMINI_API_KEY/);
  assert.equal(network.mock.callCount(), 0);
  assert.equal(getAiConfig().generationModel, 'gemini-3.1-flash-lite-image');
  assert.throws(() => GenerationPricingService.createQuote({ selectedVariantCount: 1, selectedShotCount: 1 }), /GENERATION_COST_PER_IMAGE_USD/);
  process.env.GENERATION_COST_PER_IMAGE_USD = '0.123'; // Arbitrary test fixture, not a published price.
  assert.equal(GenerationPricingService.createQuote({ selectedVariantCount: 2, selectedShotCount: 2 }).estimatedGenerationCostUsd, 0.49);
  process.env.GENERATION_COST_PER_IMAGE_USD = '-1';
  assert.throws(() => GenerationPricingService.getQualityTierRates(), /PRICING_CONFIGURATION_REQUIRED/);

  const saved = new Map<string, Buffer>();
  setImageStorage({
    put: async (key, bytes) => { saved.set(key, bytes); return { storageKey: key, url: `/uploads/${key}` }; },
    get: async key => saved.get(key) || null,
    delete: async key => saved.delete(key), exists: async key => saved.has(key), getUrl: key => `/uploads/${key}`,
  });
  process.env.GEMINI_API_KEY = 'test-only-key';
  let empty = false;
  network.mock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(body.contents[0].parts[0].text.includes('Test') || body.contents[0].parts[0].text.includes('garment'));
    assert.equal(body.contents[0].parts.filter((part: { inlineData?: unknown }) => part.inlineData).length, 2);
    assert.deepEqual(body.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
    return new Response(JSON.stringify({ responseId: 'test-response', candidates: [{ content: { parts: empty ? [{ text: 'No image' }] : [{ inlineData: { mimeType: 'image/png', data: 'Yw==' } }] } }] }), { headers: { 'Content-Type': 'application/json' } });
  });
  const provider = new RealImageGenerationProvider();
  const result = await provider.generateImage(request);
  assert.equal(result.type, 'GENERATED');
  assert.equal(result.source, 'AI');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.providerRequestId, 'test-response');
  assert.equal(saved.get(result.storageKey!)?.toString(), 'c');
  empty = true;
  await assert.rejects(provider.generateImage(request), /no devolvió una imagen/);
  process.env.GENERATION_PROVIDER = 'fal';
  assert.equal(getAiConfig().generationModel, 'fal-ai/flux-pro/v1/vto');
  assert.throws(() => new RealImageGenerationProvider(), /FAL_KEY/);
  process.env.FAL_KEY = 'test-only-fal';
  const fal = mock.method(FalImageGenerator.prototype, 'generate', async () => result);
  assert.equal(await new RealImageGenerationProvider().generateImage(request), result);
  assert.equal(fal.mock.callCount(), 1);
  assert.equal(network.mock.callCount(), 2);
  // Existing quote regression suite also runs behind the network stub.
  process.env.AI_MODE = 'mock';
  await import('./pre-generation-cost-quote.test');
  console.log('Gemini generation: local mocked tests passed; no external requests.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
