import { 
  GarmentLock, 
  GarmentValidationResult, 
  GenerationRequest, 
  ImageAsset 
} from '@/types';
import { 
  ImageGenerationProvider, 
  AnalyzeGarmentOptions, 
  ProviderCapabilities 
} from './provider.interface';
import { getAiConfig } from './config';
import { GeminiGarmentAnalyzer } from './gemini-analyzer';
import { FalImageGenerator } from './fal-generator';
import { GeminiImageGenerator } from './gemini-generator';
import { GeminiImageValidator } from './gemini-validator';

/**
 * RealImageGenerationProvider acts as the enterprise facade uniting:
 * - GeminiGarmentAnalyzer (for multimodal analysis & color detection)
 * - FalImageGenerator or GeminiImageGenerator (selected by GENERATION_PROVIDER)
 * - GeminiImageValidator (for honest visual auditing with hard gates)
 */
export class RealImageGenerationProvider implements ImageGenerationProvider {
  readonly id = 'real-provider-facade';
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  private analyzer: GeminiGarmentAnalyzer;
  private generator: FalImageGenerator | GeminiImageGenerator;
  private validator: GeminiImageValidator;

  constructor() {
    const config = getAiConfig();
    this.name = `Catalog AI Real Production Engine (${config.generationModel})`;

    this.capabilities = {
      supportsImageReference: true,
      supportsMultipleReferences: true,
      supportsSeed: config.generationProvider === 'fal',
      supportsNegativePrompt: config.generationProvider === 'fal',
      supportsImageToImage: true,
      maxReferenceCount: 6,
    };

    // Initialize Analyzer
    if (!config.geminiApiKey?.trim()) {
      throw new Error('AI_CONFIGURATION_REQUIRED: falta configurar GEMINI_API_KEY en el servidor.');
    }
    if (config.aiMode !== 'real' || config.analysisProvider !== 'gemini' || !config.generationEnabled || config.validationProvider !== 'gemini' || (config.generationProvider !== 'fal' && config.generationProvider !== 'gemini')) {
      throw new Error('AI_CONFIGURATION_REQUIRED: revisá AI_MODE, ANALYSIS_PROVIDER, VALIDATION_PROVIDER, GENERATION_PROVIDER y GENERATION_ENABLED.');
    }
    if (config.generationProvider === 'fal' && !config.falKey?.trim()) {
      throw new Error('AI_CONFIGURATION_REQUIRED: falta configurar FAL_KEY en el servidor.');
    }
    this.analyzer = new GeminiGarmentAnalyzer(config.geminiApiKey, config.analysisModel);
    this.generator = config.generationProvider === 'gemini'
      ? new GeminiImageGenerator(config.geminiApiKey, config.generationModel)
      : new FalImageGenerator(config.falKey!, config.generationModel);
    this.validator = new GeminiImageValidator(config.geminiApiKey, config.validationModel);
  }

  async analyzeGarment(options: AnalyzeGarmentOptions): Promise<GarmentLock> {
    try {
      return await this.analyzer.analyze(options);
    } catch (err: unknown) {
      throw new Error('ANALYSIS_UNAVAILABLE');
    }
  }

  async generateImage(request: GenerationRequest): Promise<ImageAsset> {
    try {
      return await this.generator.generate(request);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`GENERATION_FAILED: ${msg}`);
    }
  }

  async validateImage(
    generatedAsset: ImageAsset,
    garment: GarmentLock,
    options?: {
      colorVariant?: import('@/types').ColorVariant;
      modelLock?: import('@/types').ModelLock;
      shotView?: import('@/types').MandatoryShotView;
    }
  ): Promise<GarmentValidationResult> {
    try {
      const targetVariant = options?.colorVariant || garment.colorVariants[0] || {
        id: 'col-default',
        name: 'Original',
        detectedColor: 'Original',
        colorDescription: 'Original',
        approximateHex: '#000000',
        selected: true,
        order: 0,
      };

      if (!options?.modelLock?.modelId) {
        throw new Error('MODEL_LOCK_REQUIRED: Se requiere un modelLock explícito para validar la imagen.');
      }
      const targetModel = options.modelLock;

      const targetShot = options?.shotView || 'FRONT';

      return await this.validator.validate({
        generatedAsset,
        garmentLock: garment,
        colorVariant: targetVariant,
        modelLock: targetModel,
        shotView: targetShot,
        referenceAssets: garment.referenceImages,
        garmentMaster: options?.garmentMaster,
        anchorAsset: options?.anchorAsset,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`VALIDATION_UNAVAILABLE: ${msg}`);
    }
  }
}
