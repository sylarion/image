import { ModelLock } from '@/types';

export const PRESET_MODELS: ModelLock[] = [
  {
    modelId: 'mod-01-sofia',
    name: 'Sofía',
    gender: 'Femenino',
    apparentAge: '24-28 años',
    bodyType: 'Editorial Standard (1.78m, Talle 2/36)',
    skinTone: 'Oliva claro',
    hairColor: 'Castaño oscuro natural',
    hairLength: 'Largo con ondas suaves',
    hairStyle: 'Raya al medio natural',
    previewUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  },
  {
    modelId: 'mod-02-elena',
    name: 'Elena',
    gender: 'Femenino',
    apparentAge: '26-30 años',
    bodyType: 'Curvy Commercial (1.75m, Talle 6/42)',
    skinTone: 'Cálido medio',
    hairColor: 'Negro azabache',
    hairLength: 'Midi recto',
    hairStyle: 'Bob elegante',
    previewUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
  },
  {
    modelId: 'mod-03-clara',
    name: 'Clara',
    gender: 'Femenino',
    apparentAge: '22-26 años',
    bodyType: 'High Fashion Petite (1.72m, Talle 1/34)',
    skinTone: 'Porcelana',
    hairColor: 'Rubio ceniza',
    hairLength: 'Largo lacio',
    hairStyle: 'Recogido bajo descontracturado',
    previewUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  },
  {
    modelId: 'mod-04-mateo',
    name: 'Mateo',
    gender: 'Masculino',
    apparentAge: '25-30 años',
    bodyType: 'Athletic Casual (1.85m, Talle M/48)',
    skinTone: 'Trigueño',
    hairColor: 'Castaño',
    hairLength: 'Corto texturado',
    hairStyle: 'Clásico moderno',
    previewUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  }
];

export const DEFAULT_MODEL = PRESET_MODELS[0];
