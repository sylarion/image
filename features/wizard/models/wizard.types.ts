// ============================================================================
// FRONTEND VIEW MODELS & UI ADAPTERS (SaaS Fashion Assistant)
// Desacopla completamente la interfaz gráfica de los detalles técnicos del backend.
// ============================================================================

import { 
  SceneAnalysisPipelineResult, 
  ProductGroup, 
  GarmentVariant, 
  GarmentCrop,
  GenerationJob 
} from '@/types';
import { MODEL_CATALOG, CatalogModel } from '@/lib/constants/models';
export type { CatalogModel };

export type DestinationPreset = 
  | 'TIENDA_ONLINE' 
  | 'MERCADO_LIBRE' 
  | 'CATALOGO' 
  | 'INSTAGRAM' 
  | 'MAYORISTAS';

export type StylePreset = 
  | 'FONDO_BLANCO' 
  | 'ESTUDIO_PREMIUM' 
  | 'EDITORIAL' 
  | 'LIFESTYLE';

export type ModelSelectionType = 
  | 'NO_MODEL' 
  | 'FEMALE' 
  | 'MALE' 
  | 'ORIGINAL';

export interface ShotChoiceViewModel {
  id: 'FRONT' | 'SIDE' | 'BACK' | 'ACTION';
  label: string;
  description: string;
  thumbnail: string;
  selected: boolean;
}

export interface ColorChoiceViewModel {
  id: string;
  name: string;
  originalAiName?: string;
  hex: string;
  cropUrl: string;
  selected: boolean;
  isUserCorrected?: boolean;
}

export interface UserConfirmedGarmentIdentity {
  productGroupId: string;
  aiSuggestedName: string;
  aiSuggestedCategory: string;
  confirmedName: string;
  confirmedCategory: string;
  source: 'AI_CONFIRMED' | 'USER_CORRECTED';
  confirmedAt: string;
}

export interface UserConfirmedVariantSet {
  productGroupId: string;
  selectedVariantIds: string[];
  userConfirmed: boolean;
  customColorNames?: Record<string, string>;
  confirmedAt?: string;
}

export interface ProductChoiceViewModel {
  id: string;
  title: string;
  category: string;
  mainCropUrl: string;
  colors: ColorChoiceViewModel[];
  selected: boolean;
  confirmedIdentity?: UserConfirmedGarmentIdentity;
  confirmedVariants?: UserConfirmedVariantSet;
}

export interface DestinationPresetViewModel {
  id: DestinationPreset;
  title: string;
  subtitle: string;
  recommendedStyle: StylePreset;
  recommendedShots: ('FRONT' | 'SIDE' | 'BACK' | 'ACTION')[];
  aspectRatio: string;
}

export interface StylePresetViewModel {
  id: StylePreset;
  title: string;
  badge?: string;
  description: string;
  previewUrl: string;
}

export type ModelChoiceViewModel = CatalogModel;

export interface GenerationProgressItem {
  colorId: string;
  colorName: string;
  colorHex: string;
  completedCount: number;
  totalCount: number;
  currentAction: string;
  completedThumbnails: string[];
}

// Canonical shot choices available
export const DEFAULT_SHOT_CHOICES: ShotChoiceViewModel[] = [
  {
    id: 'FRONT',
    label: 'Frente',
    description: 'Vista principal frontal, caída y moldería visible.',
    thumbnail: '/ui-assets/shots/front.svg',
    selected: true,
  },
  {
    id: 'SIDE',
    label: 'Costado',
    description: 'Perfil y silueta lateral de la prenda.',
    thumbnail: '/ui-assets/shots/side.svg',
    selected: true,
  },
  {
    id: 'BACK',
    label: 'Espalda',
    description: 'Cierres traseros, escote posterior y terminaciones.',
    thumbnail: '/ui-assets/shots/back.svg',
    selected: true,
  },
  {
    id: 'ACTION',
    label: 'En movimiento',
    description: 'Paso dinámico, caída y vuelo del tejido en pose activa.',
    thumbnail: '/ui-assets/shots/action.svg',
    selected: true,
  },
];

export const DESTINATION_PRESETS: DestinationPresetViewModel[] = [
  {
    id: 'MERCADO_LIBRE',
    title: 'Mercado Libre',
    subtitle: 'Fondo blanco puro, encuadre comercial centrado, optimizado para conversión.',
    recommendedStyle: 'FONDO_BLANCO',
    recommendedShots: ['FRONT', 'SIDE', 'BACK'],
    aspectRatio: '1:1',
  },
  {
    id: 'TIENDA_ONLINE',
    title: 'Tienda Online',
    subtitle: 'Estudio moderno, iluminación suave y neutra para e-commerce propio.',
    recommendedStyle: 'ESTUDIO_PREMIUM',
    recommendedShots: ['FRONT', 'SIDE', 'BACK', 'ACTION'],
    aspectRatio: '3:4',
  },
  {
    id: 'CATALOGO',
    title: 'Catálogo Mayorista',
    subtitle: 'Lookbook editorial y fichas técnicas PDF para clientes y preventa comercial.',
    recommendedStyle: 'EDITORIAL',
    recommendedShots: ['FRONT', 'SIDE', 'BACK', 'ACTION'],
    aspectRatio: '3:4',
  },
  {
    id: 'INSTAGRAM',
    title: 'Instagram & Redes',
    subtitle: 'Lifestyle urbano con luz natural cálida y movimiento orgánico.',
    recommendedStyle: 'LIFESTYLE',
    recommendedShots: ['FRONT', 'ACTION'],
    aspectRatio: '4:5',
  },
  {
    id: 'MAYORISTAS',
    title: 'Mayoristas Unidos (Canal B2B)',
    subtitle: 'Publicación directa en plataforma B2B con variantes de color optimizadas.',
    recommendedStyle: 'FONDO_BLANCO',
    recommendedShots: ['FRONT', 'SIDE', 'BACK'],
    aspectRatio: '1:1',
  },
];

export const STYLE_PRESETS: StylePresetViewModel[] = [
  {
    id: 'FONDO_BLANCO',
    title: 'Fondo Blanco',
    badge: 'Recomendado para Mercado Libre',
    description: 'Sin distracciones. Iluminación pareja y fondo blanco puro estándar para marketplace.',
    previewUrl: '/ui-assets/styles/white.svg',
  },
  {
    id: 'ESTUDIO_PREMIUM',
    title: 'Estudio Premium',
    badge: 'Más Popular',
    description: 'Sombras sutiles, piso neutro de cemento pulido o ciclorama minimalista.',
    previewUrl: '/ui-assets/styles/studio.svg',
  },
  {
    id: 'EDITORIAL',
    title: 'Editorial de Moda',
    description: 'Dirección de arte contemporánea, arquitectura sobria y contraste sofisticado.',
    previewUrl: '/ui-assets/styles/editorial.svg',
  },
  {
    id: 'LIFESTYLE',
    title: 'Lifestyle Urbano',
    description: 'Luz natural de día en entornos cotidianos elegantes y modernos.',
    previewUrl: '/ui-assets/styles/lifestyle.svg',
  },
];

export const MODEL_CHOICES: CatalogModel[] = MODEL_CATALOG;

// ============================================================================
// ADAPTERS: Transform Backend Raw Results into User-Friendly ViewModels
// ============================================================================

export class VisualWizardAdapters {
  /**
   * Adapts the technical backend SceneAnalysisPipelineResult into simple visual product choices.
   */
  static toProductChoices(
    pipelineResult: SceneAnalysisPipelineResult,
    existingChoices?: ProductChoiceViewModel[]
  ): ProductChoiceViewModel[] {
    const cropsMap = new Map<string, GarmentCrop>();
    for (const crop of pipelineResult.crops) {
      cropsMap.set(crop.url, crop);
    }

    const existingMap = new Map<string, ProductChoiceViewModel>();
    if (existingChoices) {
      for (const choice of existingChoices) {
        existingMap.set(choice.id, choice);
      }
    }

    return pipelineResult.productGroups.map((group, groupIdx) => {
      const existing = existingMap.get(group.id);

      const colors: ColorChoiceViewModel[] = group.variants.map((v) => {
        const cropUrl = v.referenceCrops[0] || pipelineResult.crops[0]?.url || '';
        const existingColor = existing?.colors.find((c) => c.id === v.id);
        const customName = existing?.confirmedVariants?.customColorNames?.[v.id];
        return {
          id: v.id,
          name: customName || existingColor?.name || v.color.canonicalName,
          originalAiName: v.color.canonicalName,
          hex: v.color.hex,
          cropUrl,
          selected: existingColor !== undefined ? existingColor.selected : true,
          isUserCorrected: Boolean(customName || existingColor?.isUserCorrected),
        };
      });

      const firstCropUrl = colors[0]?.cropUrl || pipelineResult.crops[0]?.url || '';

      const defaultCategory = group.category || 'Vestido';
      
      // Build natural suggestion: avoid robotic "Remera 1" or "Mono 1"
      let defaultName = group.name || defaultCategory;
      if (/\s+\d+$/.test(defaultName)) {
        const base = defaultName.replace(/\s+\d+$/, '');
        const pattern = group.visualSignature?.patternType;
        if (pattern && pattern !== 'Liso' && !pattern.toLowerCase().includes('desconocido')) {
          defaultName = `${base} estampada`;
        } else {
          defaultName = base;
        }
      }

      // Prioritize existing user-confirmed identity (USER CONFIRMATION > AI INFERENCE)
      let confirmedIdentity: UserConfirmedGarmentIdentity;
      if (existing?.confirmedIdentity && existing.confirmedIdentity.source === 'USER_CORRECTED') {
        confirmedIdentity = {
          ...existing.confirmedIdentity,
          aiSuggestedName: defaultName,
          aiSuggestedCategory: defaultCategory,
          // Keep user's confirmedName and confirmedCategory intact
        };
      } else {
        const previousName = existing?.confirmedIdentity?.confirmedName;
        const shouldUseNewDefault = !previousName || /\s+\d+$/.test(previousName);
        confirmedIdentity = {
          productGroupId: group.id,
          aiSuggestedName: defaultName,
          aiSuggestedCategory: defaultCategory,
          confirmedName: shouldUseNewDefault ? defaultName : previousName,
          confirmedCategory: existing?.confirmedIdentity?.confirmedCategory || defaultCategory,
          source: existing?.confirmedIdentity?.source || 'AI_CONFIRMED',
          confirmedAt: existing?.confirmedIdentity?.confirmedAt || new Date().toISOString(),
        };
      }

      const friendlyTitle = confirmedIdentity.confirmedName || (
        group.variants.length > 1
          ? `${group.category || 'Modelo'} (${group.variants.length} colores)`
          : `${group.category || 'Modelo'} ${group.variants[0]?.color.canonicalName || ''}`
      );

      return {
        id: group.id,
        title: friendlyTitle,
        category: confirmedIdentity.confirmedCategory || defaultCategory,
        mainCropUrl: firstCropUrl,
        colors,
        selected: existing ? existing.selected : groupIdx === 0,
        confirmedIdentity,
        confirmedVariants: existing?.confirmedVariants,
      };
    });
  }

  /**
   * Adapts running GenerationJobs into friendly step-by-step progress cards.
   */
  static toGenerationProgress(
    colors: ColorChoiceViewModel[],
    jobs: GenerationJob[]
  ): GenerationProgressItem[] {
    return colors.map((col) => {
      const colJobs = jobs.filter((j) => j.colorVariantId === col.id || j.colorName.toLowerCase() === col.name.toLowerCase());
      const completed = colJobs.filter((j) => j.status === 'APPROVED' || j.status === 'REVIEW_REQUIRED');
      const thumbnails = completed.map((j) => j.outputUrl || j.outputAsset?.url || '').filter(Boolean);

      let currentAction = 'Preparando';
      if (completed.length === 0) currentAction = 'Analizando prenda';
      else if (completed.length === 1) currentAction = 'Creando frente';
      else if (completed.length === 2) currentAction = 'Creando costado';
      else if (completed.length === 3) currentAction = 'Creando espalda';
      else currentAction = 'Completado';

      return {
        colorId: col.id,
        colorName: col.name,
        colorHex: col.hex,
        completedCount: completed.length,
        totalCount: Math.max(colJobs.length, 4),
        currentAction,
        completedThumbnails: thumbnails,
      };
    });
  }
}
