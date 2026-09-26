import { Project, ColorVariant, GenerationJob } from '@/types';
import { PRESET_MODELS } from './models';

export const MONO_FLOREAL_VARIANTS: ColorVariant[] = [
  {
    id: 'col-black',
    name: 'Negro',
    detectedColor: 'Negro profundo',
    colorDescription: 'Negro carbón mate con estampa botánica en beige y marfil',
    patternDescription: 'Fondo negro carbón con ramilletes botánicos en marfil y toques sutiles beige',
    approximateHex: '#18181B',
    patternDistribution: 'Estampado floral distribuido homogéneamente en pernera y bustier',
    confidence: 99,
    referenceCrop: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=400&q=80',
    referenceAssets: [
      {
        id: 'crop-black-1',
        type: 'REFERENCE',
        source: 'MOCK',
        name: 'crop-mono-negro.jpg',
        url: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=400&q=80',
        createdAt: '2026-03-24T14:30:00.000Z',
      }
    ],
    selected: true,
    order: 0,
  },
  {
    id: 'col-bordo',
    name: 'Bordó',
    detectedColor: 'Rojo vino / Bordó oscuro',
    colorDescription: 'Bordó intenso profundo con flores marfil suave y hojas ocre',
    patternDescription: 'Fondo rojo vino profundo con estampa floral idéntica en contraste suave',
    approximateHex: '#881337',
    patternDistribution: 'Estampado floral idéntico en escala y posición sobre fondo bordó',
    confidence: 98,
    referenceCrop: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=400&q=80',
    referenceAssets: [
      {
        id: 'crop-bordo-1',
        type: 'REFERENCE',
        source: 'MOCK',
        name: 'crop-mono-bordo.jpg',
        url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=400&q=80',
        createdAt: '2026-03-24T14:30:00.000Z',
      }
    ],
    selected: true,
    order: 1,
  },
  {
    id: 'col-beige',
    name: 'Beige',
    detectedColor: 'Beige arena / Arena cálido',
    colorDescription: 'Tono arena lino natural con flores en marrón chocolate y blanco',
    patternDescription: 'Trama color arena cálido con motivos botánicos en contraste marrón y marfil',
    approximateHex: '#D4D4D8',
    patternDistribution: 'Estampado con alto contraste floral respetando la trama textil original',
    confidence: 97,
    referenceCrop: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    referenceAssets: [
      {
        id: 'crop-beige-1',
        type: 'REFERENCE',
        source: 'MOCK',
        name: 'crop-mono-beige.jpg',
        url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        createdAt: '2026-03-24T14:30:00.000Z',
      }
    ],
    selected: true,
    order: 2,
  },
  {
    id: 'col-green',
    name: 'Verde Oliva',
    detectedColor: 'Verde oliva militar apagado',
    colorDescription: 'Verde oliva terroso suave con estampados en tono crema',
    patternDescription: 'Base verde oliva terroso con flores en blanco roto y líneas de tallo beige',
    approximateHex: '#3F6212',
    patternDistribution: 'Base verde oliva sin alteraciones cromáticas en detalles florales',
    confidence: 96,
    selected: true,
    order: 3,
  },
  {
    id: 'col-blue',
    name: 'Azul Noche',
    detectedColor: 'Azul marino / Azul medianoche',
    colorDescription: 'Azul noche sobrio con flores en blanco perla y tostado',
    patternDescription: 'Azul índigo noche profundo manteniendo contraste textil original',
    approximateHex: '#1E3A8A',
    patternDistribution: 'Fondo azul noche homogéneo manteniendo escala de bordados y botones',
    confidence: 97,
    selected: true,
    order: 4,
  },
  {
    id: 'col-terracota',
    name: 'Terracota',
    detectedColor: 'Terracota / Óxido cálido',
    colorDescription: 'Terracota arcilloso con estampas florales en arena suave',
    patternDescription: 'Matiz arcilla tostado cálido con flores marfil suave',
    approximateHex: '#9A3412',
    patternDistribution: 'Matiz terracota preservando vivos, tiras y costuras',
    confidence: 95,
    selected: true,
    order: 5,
  },
];

// Helper to generate the exact 48 jobs (6 colors × 4 canonical shots × 2 sets)
function generateMonoFlorealJobs(projectId: string): GenerationJob[] {
  const jobs: GenerationJob[] = [];
  const shots = [
    { view: 'FRONT' as const, label: 'Frente' },
    { view: 'SIDE' as const, label: 'Costado' },
    { view: 'BACK' as const, label: 'Espalda' },
    { view: 'ACTION' as const, label: 'Acción' },
  ];
  const styles = [
    {
      style: 'STUDIO_WHITE' as const,
      name: 'Mercado Libre',
      urls: {
        FRONT: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=1000&q=80',
        SIDE: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=1000&q=80',
        BACK: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1000&q=80',
        ACTION: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1000&q=80',
      }
    },
    {
      style: 'EDITORIAL_CATALOG' as const,
      name: 'Catálogo Premium',
      urls: {
        FRONT: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
        SIDE: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
        BACK: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80',
        ACTION: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=80',
      }
    }
  ];

  for (const variant of MONO_FLOREAL_VARIANTS) {
    for (const style of styles) {
      for (const shot of shots) {
        const jobId = `job-${variant.id}-${style.style.toLowerCase()}-${shot.view.toLowerCase()}`;
        const outputUrl = style.urls[shot.view];

        jobs.push({
          id: jobId,
          projectId,
          colorVariantId: variant.id,
          colorName: variant.name,
          productionStyle: style.style,
          shotView: shot.view,
          label: `${variant.name} — ${shot.label} (${style.name})`,
          status: 'APPROVED',
          progress: 100,
          attempts: 1,
          outputUrl,
          outputAsset: {
            id: `asset-${jobId}`,
            type: 'GENERATED',
            source: 'MOCK',
            url: outputUrl,
            name: `${variant.name} - ${shot.label}`,
            createdAt: '2026-03-24T14:35:00.000Z',
          },
          validationScore: {
            overallScore: 97,
            garmentIdentityScore: 98,
            colorAccuracyScore: 99,
            shapeScore: 97,
            patternScore: 96,
            detailScore: 98,
            modelIdentityScore: 98,
            shotAccuracyScore: 98,
            poseDiversityScore: 95,
            issues: [],
          },
          createdAt: '2026-03-24T14:35:00.000Z',
        });
      }
    }
  }

  return jobs;
}

export const INITIAL_MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    name: 'Mono Floreal',
    status: 'COMPLETED',
    createdAt: '2026-03-24T14:30:00.000Z',
    updatedAt: '2026-03-24T16:00:00.000Z',
    garment: {
      id: 'glock-001',
      name: 'Mono Floreal',
      category: 'Mono',
      material: 'Lino orgánico prelavado',
      pattern: 'Bordado floral en relieve con distribución equilibrada',
      details: [
        'Escote corazón estructurado con vivos al tono',
        'Tiras de hombros finas regulables',
        'Bolsillos laterales invisibles funcionales',
        'Largo tobillero con botamanga recta',
        'Cierre invisible en espalda posterior',
      ],
      pockets: true,
      sizes: ['2', '4', '6'],
      mustPreserve: [
        'corte y silueta exacta de la prenda',
        'escote y caída anatómica',
        'estampado floral sin recolorear arbitrariamente las flores',
        'bolsillos laterales funcionales',
        'largo exacto de botamanga',
        'textura y trama del lino prelavado',
        'cierre y caída en la espalda',
      ],
      colorVariants: MONO_FLOREAL_VARIANTS,
      coverage: {
        front: 'VERIFIED',
        side: 'INFERRED',
        back: 'UNKNOWN',
        details: 'PARTIAL',
        colors: 'VERIFIED',
        pattern: 'VERIFIED',
        construction: 'PARTIAL',
      },
      referenceImages: [
        {
          id: 'ref-1',
          type: 'REFERENCE',
          source: 'MOCK',
          name: 'mono-6-colores.jpg',
          url: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80',
          mimeType: 'image/jpeg',
          order: 0,
          createdAt: '2026-03-24T14:30:00.000Z',
        },
        {
          id: 'ref-2',
          type: 'REFERENCE',
          source: 'MOCK',
          name: 'mono-detalle-estampa.jpg',
          url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
          mimeType: 'image/jpeg',
          order: 1,
          createdAt: '2026-03-24T14:30:00.000Z',
        }
      ]
    },
    model: PRESET_MODELS[0],
    selectedPackages: {
      studioWhite: true,
      editorialCatalog: true,
    },
    jobs: generateMonoFlorealJobs('proj-001'), // Exactly 48 completed jobs (6 colors × 4 shots × 2 sets)
  },
  {
    id: 'proj-002',
    name: 'Vestido Victoria',
    status: 'COMPLETED',
    createdAt: '2026-03-23T11:15:00.000Z',
    updatedAt: '2026-03-23T12:00:00.000Z',
    garment: {
      id: 'glock-002',
      name: 'Vestido Victoria',
      category: 'Vestido',
      material: 'Seda natural 100%',
      pattern: 'Monocromático satinado',
      details: ['Escote lencero', 'Tiras regulables', 'Corte al bies'],
      pockets: false,
      sizes: ['S', 'M'],
      mustPreserve: ['caída de seda', 'escote lencero', 'reflejo satinado', 'largo midi'],
      colorVariants: [
        {
          id: 'col-ivory',
          name: 'Marfil',
          detectedColor: 'Marfil perla satinado',
          colorDescription: 'Marfil suave con reflejo aperlado sutil',
          approximateHex: '#FDFBF7',
          selected: true,
          order: 0,
        },
        {
          id: 'col-gold',
          name: 'Oro Sutil',
          detectedColor: 'Champagne / Oro suave',
          colorDescription: 'Champagne dorado pálido',
          approximateHex: '#FEF08A',
          selected: true,
          order: 1,
        }
      ],
      referenceImages: [
        {
          id: 'ref-v1',
          type: 'REFERENCE',
          source: 'MOCK',
          name: 'victoria.jpg',
          url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
          mimeType: 'image/jpeg',
          order: 0,
          createdAt: '2026-03-23T11:15:00.000Z',
        }
      ]
    },
    model: PRESET_MODELS[2],
    selectedPackages: {
      studioWhite: true,
      editorialCatalog: false,
    },
    jobs: [
      {
        id: 'job-v-front',
        projectId: 'proj-002',
        colorVariantId: 'col-ivory',
        colorName: 'Marfil',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'FRONT',
        label: 'Marfil — Frente (Mercado Libre)',
        status: 'APPROVED',
        progress: 100,
        attempts: 1,
        outputUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1000&q=80',
        validationScore: {
          overallScore: 97,
          garmentIdentityScore: 98,
          colorAccuracyScore: 98,
          shapeScore: 97,
          patternScore: 98,
          detailScore: 96,
          modelIdentityScore: 98,
          shotAccuracyScore: 99,
          poseDiversityScore: 96,
          issues: [],
        },
        createdAt: '2026-03-23T11:20:00.000Z',
      },
      {
        id: 'job-v-side',
        projectId: 'proj-002',
        colorVariantId: 'col-ivory',
        colorName: 'Marfil',
        productionStyle: 'STUDIO_WHITE',
        shotView: 'SIDE',
        label: 'Marfil — Costado (Mercado Libre)',
        status: 'APPROVED',
        progress: 100,
        attempts: 1,
        outputUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=80',
        validationScore: {
          overallScore: 96,
          garmentIdentityScore: 97,
          colorAccuracyScore: 98,
          shapeScore: 96,
          patternScore: 97,
          detailScore: 95,
          modelIdentityScore: 98,
          shotAccuracyScore: 98,
          poseDiversityScore: 95,
          issues: [],
        },
        createdAt: '2026-03-23T11:21:00.000Z',
      }
    ]
  },
  {
    id: 'proj-003',
    name: 'Vestido Florencia',
    status: 'READY',
    createdAt: '2026-03-22T09:00:00.000Z',
    updatedAt: '2026-03-22T09:30:00.000Z',
    garment: {
      id: 'glock-003',
      name: 'Vestido Florencia',
      category: 'Vestido',
      material: 'Crepe de chine',
      pattern: 'Liso mate',
      details: ['Mangas abullonadas', 'Cintura ceñida con tabla'],
      pockets: false,
      sizes: ['M', 'L'],
      mustPreserve: ['volumen mangas', 'entallado cintura', 'tono rubí'],
      colorVariants: [
        {
          id: 'col-rubi',
          name: 'Rojo Rubí',
          detectedColor: 'Rojo rubí profundo',
          colorDescription: 'Rojo escarlata intenso mate',
          approximateHex: '#BE123C',
          selected: true,
          order: 0,
        }
      ],
      referenceImages: [
        {
          id: 'ref-f1',
          type: 'REFERENCE',
          source: 'MOCK',
          name: 'florencia.jpg',
          url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
          mimeType: 'image/jpeg',
          order: 0,
          createdAt: '2026-03-22T09:00:00.000Z',
        }
      ]
    },
    model: PRESET_MODELS[1],
    selectedPackages: {
      studioWhite: true,
      editorialCatalog: false,
    },
    jobs: []
  }
];
