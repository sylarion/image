/**
 * AI Configuration & Environment Settings for Catalog AI.
 * Keeps API keys exclusively server-side.
 * Allows independent selection of Analysis, Generation, and Validation providers.
 */

export interface AiEnvironmentConfig {
  aiMode: 'mock' | 'real';
  
  // Analysis Provider & Model
  analysisProvider: 'gemini' | 'mock';
  analysisModel: string;
  
  // Generation Provider & Model (Supports bake-off between FLUX Pro VTO and FLUX.2 VTO)
  generationProvider: 'fal' | 'mock';
  generationModel: string;
  
  // Validation Provider & Model
  validationProvider: 'gemini' | 'mock';
  validationModel: string;
  
  // Cost Guard Limits
  maxRealGenerationsPerProduction: number;
  
  // Credentials (Server-side only)
  geminiApiKey?: string;
  falKey?: string;
}

export function getAiConfig(): AiEnvironmentConfig {
  const aiMode = (process.env.AI_MODE?.toLowerCase() === 'real' ? 'real' : 'mock') as 'mock' | 'real';

  return {
    aiMode,
    
    // Analysis
    analysisProvider: (process.env.ANALYSIS_PROVIDER?.toLowerCase() === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
    analysisModel: process.env.ANALYSIS_MODEL || 'gemini-2.5-flash',
    
    // Generation
    generationProvider: (process.env.GENERATION_PROVIDER?.toLowerCase() === 'fal' ? 'fal' : 'mock') as 'fal' | 'mock',
    // Candidate models for experimental bake-off:
    // 1) 'fal-ai/flux-pro/v1/vto'
    // 2) 'fal-ai/flux-2-lora-gallery/virtual-tryon'
    generationModel: process.env.GENERATION_MODEL || 'fal-ai/flux-pro/v1/vto',
    
    // Validation
    validationProvider: (process.env.VALIDATION_PROVIDER?.toLowerCase() === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
    validationModel: process.env.VALIDATION_MODEL || 'gemini-2.5-flash',
    
    // Hard cost safety bound
    maxRealGenerationsPerProduction: parseInt(process.env.MAX_REAL_GENERATIONS || '8', 10),
    
    // Secrets
    geminiApiKey: process.env.GEMINI_API_KEY,
    falKey: process.env.FAL_KEY,
  };
}
