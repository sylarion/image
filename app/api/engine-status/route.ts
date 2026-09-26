import { NextResponse } from 'next/server';
import { getAiConfig } from '@/lib/ai/config';

/**
 * Exposes server-side AI operational status to the frontend.
 * Never leaks API keys, only displays active providers and engine names.
 */
export async function GET() {
  const config = getAiConfig();
  
  return NextResponse.json({
    mode: config.aiMode,
    analysisProvider: config.analysisProvider,
    analysisModel: config.analysisModel,
    generationProvider: config.generationProvider,
    generationModel: config.generationModel,
    validationProvider: config.validationProvider,
    validationModel: config.validationModel,
    hasGeminiKey: Boolean(config.geminiApiKey),
    hasFalKey: Boolean(config.falKey),
    maxRealGenerations: config.maxRealGenerationsPerProduction,
  });
}
