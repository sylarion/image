import { 
  GarmentLock, 
  GarmentCategory, 
  GarmentValidationResult,
  GenerationRequest,
  ImageAsset,
  ColorVariant
} from '@/types';
import { 
  ImageGenerationProvider, 
  AnalyzeGarmentOptions, 
  ProviderCapabilities
} from './provider.interface';
import { compileGenerationPrompt } from './prompt-compiler';
import { validateGeneratedAsset } from './validation';

// Curated high quality fashion photography URLs matching realistic studio and editorial shots
const MOCK_SHOT_ASSETS: Record<string, Record<string, string>> = {
  // STUDIO_WHITE (Mercado Libre / E-commerce fondo blanco)
  STUDIO_WHITE: {
    FRONT: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=1000&q=80',
    SIDE: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=1000&q=80',
    BACK: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1000&q=80',
    ACTION: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1000&q=80',
  },
  // EDITORIAL_CATALOG (Catálogo Premium ambientado)
  EDITORIAL_CATALOG: {
    FRONT: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
    SIDE: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
    BACK: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80',
    ACTION: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80',
  }
};

const DEFAULT_COLOR_VARIANTS: ColorVariant[] = [
  {
    id: 'col-black',
    name: 'Negro',
    detectedColor: 'Negro profundo',
    colorDescription: 'Negro carbón mate con estampa botánica en beige y marfil',
    approximateHex: '#18181B',
    patternDistribution: 'Estampado floral distribuido homogéneamente en pernera y bustier',
    selected: true,
    order: 0,
  },
  {
    id: 'col-bordo',
    name: 'Bordó',
    detectedColor: 'Rojo vino / Bordó oscuro',
    colorDescription: 'Bordó intenso profundo con flores marfil suave y hojas ocre',
    approximateHex: '#581C87',
    patternDistribution: 'Estampado floral idéntico en escala y posición sobre fondo bordó',
    selected: true,
    order: 1,
  },
  {
    id: 'col-beige',
    name: 'Beige',
    detectedColor: 'Beige arena / Arena cálido',
    colorDescription: 'Tono arena lino natural con flores en marrón chocolate y blanco',
    approximateHex: '#D4D4D8',
    patternDistribution: 'Estampado con alto contraste floral respetando la trama textil original',
    selected: true,
    order: 2,
  },
  {
    id: 'col-green',
    name: 'Verde Oliva',
    detectedColor: 'Verde oliva militar apagado',
    colorDescription: 'Verde oliva terroso suave con estampados en tono crema',
    approximateHex: '#3F6212',
    patternDistribution: 'Base verde oliva sin alteraciones cromáticas en detalles florales',
    selected: true,
    order: 3,
  },
  {
    id: 'col-blue',
    name: 'Azul Noche',
    detectedColor: 'Azul marino / Azul medianoche',
    colorDescription: 'Azul noche sobrio con flores en blanco perla y tostado',
    approximateHex: '#1E3A8A',
    patternDistribution: 'Fondo azul noche homogéneo manteniendo escala de bordados y botones',
    selected: true,
    order: 4,
  },
  {
    id: 'col-terracota',
    name: 'Terracota',
    detectedColor: 'Terracota / Óxido cálido',
    colorDescription: 'Terracota arcilloso con estampas florales en arena suave',
    approximateHex: '#9A3412',
    patternDistribution: 'Matiz terracota preservando vivos, tiras y costuras',
    selected: true,
    order: 5,
  },
];

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly id = 'mock-provider';
  readonly name = 'Catalog AI Neural Mock Engine v2.0 (Multicolor)';

  readonly capabilities: ProviderCapabilities = {
    supportsImageReference: true,
    supportsMultipleReferences: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    maxReferenceCount: 6,
  };

  async analyzeGarment(options: AnalyzeGarmentOptions): Promise<GarmentLock> {
    await new Promise((resolve) => setTimeout(resolve, 600));

    const nameLower = options.name.toLowerCase();
    const isDress = nameLower.includes('vestido') || options.category === 'Vestido';
    const isJumpsuit = nameLower.includes('mono') || options.category === 'Mono';

    return {
      id: `glock-${Date.now()}`,
      name: options.name,
      category: (options.category as GarmentCategory) || 'Mono',
      material: isJumpsuit ? 'Lino orgánico prelavado con textura visible' : isDress ? 'Seda natural 100%' : 'Algodón Pima',
      pattern: 'Bordado floral en relieve con distribución equilibrada',
      details: [
        'Escote corazón estructurado con vivos al tono',
        'Tiras de hombros finas regulables',
        'Bolsillos laterales invisibles funcionales',
        'Largo tobillero con botamanga recta',
        'Cierre invisible en espalda posterior',
      ],
      pockets: true,
      sizes: options.sizes.length > 0 ? options.sizes : ['1', '2', '3', '4'],
      mustPreserve: [
        'corte y silueta exacta de la prenda',
        'escote y caída anatómica',
        'estampado floral sin recolorear arbitrariamente las flores',
        'bolsillos laterales funcionales',
        'largo exacto de botamanga',
        'textura y trama del lino prelavado',
        'cierre y caída en la espalda',
      ],
      colorVariants: DEFAULT_COLOR_VARIANTS.map((v, idx) => ({
        ...v,
        referenceCrop: options.referenceImages[idx % options.referenceImages.length]?.url,
        referenceAssets: [options.referenceImages[idx % options.referenceImages.length]].filter(Boolean),
        confidence: 96 + (idx % 4),
      })),
      coverage: {
        front: options.referenceImages.length > 0 ? 'VERIFIED' : 'UNKNOWN',
        side: options.referenceImages.length > 1 ? 'PARTIAL' : 'INFERRED',
        back: options.referenceImages.some(img => (img.name || '').toLowerCase().includes('back') || (img.name || '').toLowerCase().includes('espalda')) ? 'VERIFIED' : 'UNKNOWN',
        details: options.referenceImages.length > 1 ? 'PARTIAL' : 'INFERRED',
        colors: options.referenceImages.length > 0 ? 'VERIFIED' : 'UNKNOWN',
        pattern: options.referenceImages.length > 0 ? 'VERIFIED' : 'UNKNOWN',
        construction: options.referenceImages.length > 1 ? 'PARTIAL' : 'UNKNOWN',
      },
      referenceImages: options.referenceImages,
    };
  }

  async generateImage(request: GenerationRequest): Promise<ImageAsset> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Compile internal structured prompts
    compileGenerationPrompt(request);

    const stylePool = MOCK_SHOT_ASSETS[request.productionStyle] || MOCK_SHOT_ASSETS.STUDIO_WHITE;
    const url = stylePool[request.shotView] || MOCK_SHOT_ASSETS.STUDIO_WHITE.FRONT;

    return {
      id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'GENERATED',
      source: 'MOCK',
      url,
      name: `${request.garmentLock.name} - ${request.colorVariant.name} - ${request.productionStyle} - ${request.shotView}`,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    };
  }

  async validateImage(generatedAsset: ImageAsset, garment: GarmentLock): Promise<GarmentValidationResult> {
    const firstVariant = garment.colorVariants[0] || DEFAULT_COLOR_VARIANTS[0];

    return validateGeneratedAsset({
      generatedAsset,
      garmentLock: garment,
      colorVariant: firstVariant,
      modelLock: {
        modelId: 'mod-default',
        name: 'Modelo 01',
        gender: 'Femenino',
        apparentAge: '25 años',
        bodyType: 'Editorial Standard',
        skinTone: 'Oliva claro',
        hairColor: 'Castaño oscuro',
        hairLength: 'Largo con ondas',
        hairStyle: 'Raya al medio',
        previewUrl: '',
      },
      shotView: 'FRONT',
      referenceAssets: garment.referenceImages,
    });
  }
}
