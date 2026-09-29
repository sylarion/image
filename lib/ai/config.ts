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
  generationProvider: 'fal' | 'gemini' | 'mock';
  generationCostPerImageUsd?: number;
  generationModel: string;
  generationEnabled: boolean;
  
  // Validation Provider & Model
  validationProvider: 'gemini' | 'mock';
  validationModel: string;
  
  // Cost Guard Limits
  maxRealGenerationsPerProduction: number;
  
  // Timeout settings (in milliseconds)
  falSubmissionTimeoutMs: number;
  falQueueTimeoutMs: number;
  validationTimeoutMs: number;
  stuckJobTimeoutMs: number;

  // Credentials (Server-side only)
  geminiApiKey?: string;
  falKey?: string;
}

import fs from 'fs';
import path from 'path';

function getEnvVar(key: string): string | undefined {
  if (process.env.NODE_ENV === 'test') {
    return process.env[key];
  }
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const k = trimmed.substring(0, idx).trim();
          const v = trimmed.substring(idx + 1).trim();
          if (k === key) {
            return v;
          }
        }
      }
    }
  } catch {}
  return process.env[key];
}

export function getAiConfig(): AiEnvironmentConfig {
  const aiMode = (getEnvVar('AI_MODE')?.toLowerCase() === 'real' ? 'real' : 'mock') as 'mock' | 'real';

  return {
    aiMode,

    // Analysis
    analysisProvider: (getEnvVar('ANALYSIS_PROVIDER')?.toLowerCase() === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
    analysisModel: getEnvVar('ANALYSIS_MODEL') || 'gemini-2.5-flash',
    
    // Generation
    generationProvider: getEnvVar('GENERATION_PROVIDER')?.toLowerCase() === 'gemini' ? 'gemini' : (getEnvVar('GENERATION_PROVIDER')?.toLowerCase() === 'fal' ? 'fal' : 'mock'),
    generationCostPerImageUsd: getEnvVar('GENERATION_COST_PER_IMAGE_USD')?.trim() ? Number(getEnvVar('GENERATION_COST_PER_IMAGE_USD')) : undefined,
    // Candidate models for experimental bake-off:
    // 1) 'fal-ai/flux-pro/v1/vto'
    // 2) 'fal-ai/flux-2-lora-gallery/virtual-tryon'
    generationModel: getEnvVar('GENERATION_MODEL') || (getEnvVar('GENERATION_PROVIDER')?.toLowerCase() === 'gemini' ? 'gemini-3.1-flash-lite-image' : 'fal-ai/flux-pro/v1/vto'),
    generationEnabled: getEnvVar('GENERATION_ENABLED') === 'true',
    
    // Validation
    validationProvider: (getEnvVar('VALIDATION_PROVIDER')?.toLowerCase() === 'gemini' ? 'gemini' : 'mock') as 'gemini' | 'mock',
    validationModel: getEnvVar('VALIDATION_MODEL') || 'gemini-2.5-flash',
    
    // Hard cost safety bound
    maxRealGenerationsPerProduction: parseInt(getEnvVar('MAX_REAL_GENERATIONS') || '8', 10),
    
    // Granular Timeouts
    falSubmissionTimeoutMs: parseInt(getEnvVar('FAL_SUBMISSION_TIMEOUT_MS') || '30000', 10), // 30s
    falQueueTimeoutMs: parseInt(getEnvVar('FAL_QUEUE_TIMEOUT_MS') || '300000', 10), // 5 minutes
    validationTimeoutMs: parseInt(getEnvVar('VALIDATION_TIMEOUT_MS') || '60000', 10), // 60s
    stuckJobTimeoutMs: parseInt(getEnvVar('STUCK_JOB_TIMEOUT_MS') || '90000', 10), // 90 seconds

    // Secrets
    geminiApiKey: getEnvVar('GEMINI_API_KEY'),
    falKey: getEnvVar('FAL_KEY'),
  };
}

/** Returns a user-safe explanation when the real production runtime is not ready. */
export function getRealAnalysisConfigurationIssue(): string | null {
  if (process.env.NODE_ENV === 'test') return null;
  const config = getAiConfig();
  if (config.aiMode !== 'real') return null;
  if (config.analysisProvider !== 'gemini' || !config.geminiApiKey?.trim()) return 'Falta configurar GEMINI_API_KEY para analizar las prendas.';
  if (config.validationProvider !== 'gemini') return 'La validación real requiere Gemini como proveedor de validación.';
  return null;
}

export function getRealRuntimeConfigurationIssue(): string | null {
  if (process.env.NODE_ENV === 'test') return null;
  const config = getAiConfig();
  if (config.aiMode !== 'real') return null;
  const analysisIssue = getRealAnalysisConfigurationIssue();
  if (analysisIssue) return analysisIssue;
  if (!config.generationEnabled) return 'La generación está deshabilitada en este entorno. Configurá GENERATION_ENABLED=true y la API key del proveedor para crear fotos.';
  if (config.generationProvider === 'gemini') {
    if (!config.geminiApiKey?.trim()) return 'Falta configurar GEMINI_API_KEY para generar las fotografías.';
  } else if (config.generationProvider !== 'fal' || !config.falKey?.trim()) return 'Falta configurar FAL_KEY para generar las fotografías.';
  return null;
}

export interface RuntimeAIStatus {
  mode: 'REAL' | 'MOCK'; analysisProvider: string; validationProvider: string;
  analysisModel: string; validationModel: string; apiKeyConfigured: boolean; fallbackUsed: boolean;
}
export function getRuntimeAIStatus(): RuntimeAIStatus {
  const c = getAiConfig();
  return {mode:c.aiMode === 'real' ? 'REAL' : 'MOCK', analysisProvider:c.analysisProvider,
    validationProvider:c.validationProvider, analysisModel:c.analysisModel, validationModel:c.validationModel,
    apiKeyConfigured:Boolean(c.geminiApiKey?.trim()), fallbackUsed:false};
}
