import { ModelLock } from '@/types';

export type ModelSelectionType = 
  | 'NO_MODEL' 
  | 'FEMALE' 
  | 'MALE' 
  | 'ORIGINAL';

export interface CatalogModel extends ModelLock {
  id: string;
  type: ModelSelectionType;
  description: string;
  tags: string[];
  selected?: boolean;
  legacyIds?: string[];
  isGhost?: boolean;
}

export const MODEL_CATALOG: CatalogModel[] = [
  {
    id: 'model-female-sofia',
    modelId: 'model-female-sofia',
    name: 'Sofía',
    gender: 'Femenino',
    type: 'FEMALE',
    apparentAge: '24-28 años',
    bodyType: 'Editorial Standard (1.78m, Talle 2/36)',
    skinTone: 'Oliva claro',
    hairColor: 'Castaño oscuro natural',
    hairLength: 'Largo con ondas suaves',
    hairStyle: 'Raya al medio natural',
    description: 'Estilo comercial natural, pose relajada y elegante.',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    tags: ['editorial', 'comercial', 'mujer', 'castaño', 'ondas', 'argentina'],
    selected: true,
    legacyIds: ['mod-01-sofia'],
  },
  {
    id: 'model-female-elena',
    modelId: 'model-female-elena',
    name: 'Elena',
    gender: 'Femenino',
    type: 'FEMALE',
    apparentAge: '26-30 años',
    bodyType: 'Curvy Commercial (1.75m, Talle 6/42)',
    skinTone: 'Cálido medio',
    hairColor: 'Negro azabache',
    hairLength: 'Midi recto',
    hairStyle: 'Bob elegante',
    description: 'Estatura media, estilo catálogo versátil.',
    previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    tags: ['curvy', 'catalogo', 'mujer', 'negro', 'bob', 'argentina'],
    selected: false,
    legacyIds: ['mod-02-elena'],
  },
  {
    id: 'model-female-clara',
    modelId: 'model-female-clara',
    name: 'Clara',
    gender: 'Femenino',
    type: 'FEMALE',
    apparentAge: '22-26 años',
    bodyType: 'High Fashion Petite (1.72m, Talle 1/34)',
    skinTone: 'Porcelana',
    hairColor: 'Rubio ceniza',
    hairLength: 'Largo lacio',
    hairStyle: 'Recogido bajo descontracturado',
    description: 'High fashion petite, perfil estilizado y sofisticado.',
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    tags: ['high-fashion', 'petite', 'mujer', 'rubio', 'lacio', 'argentina'],
    selected: false,
    legacyIds: ['mod-03-clara'],
  },
  {
    id: 'model-male-mateo',
    modelId: 'model-male-mateo',
    name: 'Mateo',
    gender: 'Masculino',
    type: 'MALE',
    apparentAge: '25-30 años',
    bodyType: 'Athletic Casual (1.85m, Talle M/48)',
    skinTone: 'Trigueño',
    hairColor: 'Castaño',
    hairLength: 'Corto texturado',
    hairStyle: 'Clásico moderno',
    description: 'Look moderno casual y postura contemporánea.',
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    tags: ['casual', 'athletic', 'hombre', 'castaño', 'urbano', 'argentina'],
    selected: false,
    legacyIds: ['mod-04-mateo'],
  },
  {
    id: 'model-no-model',
    modelId: 'model-no-model',
    name: 'Maniquí invisible / Fantasma',
    gender: 'Unisex',
    type: 'NO_MODEL',
    apparentAge: 'N/A',
    bodyType: 'Maniquí invisible (Ghost Mannequin)',
    skinTone: 'Neutro / Transparente',
    hairColor: 'Sin cabello',
    hairLength: 'N/A',
    hairStyle: 'N/A',
    description: 'Prenda con volumen 3D real sin cuerpo humano visible. Silueta limpia para e-commerce.',
    previewUrl: '/ui-assets/models/ghost-mannequin.svg',
    tags: ['ghost-mannequin', 'sin-modelo', 'ecommerce', 'catalogo'],
    selected: false,
    isGhost: true,
    legacyIds: [],
  },
];

export const HUMAN_MODELS: CatalogModel[] = MODEL_CATALOG.filter((m) => !m.isGhost);
export const PRESET_MODELS: CatalogModel[] = HUMAN_MODELS;
export const DEFAULT_MODEL: CatalogModel = MODEL_CATALOG[0];
export const GHOST_MANNEQUIN_MODEL: CatalogModel = MODEL_CATALOG.find((m) => m.isGhost)!;

export function getModelById(modelId: string): CatalogModel {
  if (!modelId || typeof modelId !== 'string') {
    throw new Error('MODEL_NOT_FOUND: modelId is required and must be a string');
  }
  const normalizedId = modelId.trim();
  const found = MODEL_CATALOG.find(
    (m) => m.id === normalizedId || m.modelId === normalizedId || (m.legacyIds && m.legacyIds.includes(normalizedId))
  );
  if (!found) {
    throw new Error(`MODEL_NOT_FOUND: Model with ID '${modelId}' not found in catalog`);
  }
  return found;
}

export function findModelById(modelId: string): CatalogModel | undefined {
  if (!modelId || typeof modelId !== 'string') return undefined;
  const normalizedId = modelId.trim();
  return MODEL_CATALOG.find(
    (m) => m.id === normalizedId || m.modelId === normalizedId || (m.legacyIds && m.legacyIds.includes(normalizedId))
  );
}

export function isKnownModelId(modelId: string): boolean {
  return findModelById(modelId) !== undefined;
}
