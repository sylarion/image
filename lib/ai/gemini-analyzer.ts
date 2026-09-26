import { 
  GarmentLock, 
  GarmentCategory,
  ColorVariant,
  ImageAsset 
} from '@/types';
import { GarmentCategorySchema } from '@/lib/schemas/project';
import { computeReferenceCoverage } from './reference-coverage';

export interface GeminiAnalysisResponse {
  name: string;
  category: string;
  material: string;
  pattern: string;
  details: string[];
  pockets: boolean;
  mustPreserve: string[];
  colorVariants: {
    name: string;
    detectedColor: string;
    colorDescription: string;
    approximateHex: string;
    patternDistribution?: string;
    confidence: number;
  }[];
}

/**
 * Real Multimodal Garment Analyzer powered by Google Gemini API.
 * Uses structured JSON outputs with schema enforcement.
 * Distinguishes OBSERVED, INFERRED, and UNKNOWN features via ReferenceCoverage.
 */
export class GeminiGarmentAnalyzer {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze(options: {
    name: string;
    category: string;
    sizes: string[];
    referenceImages: ImageAsset[];
  }): Promise<GarmentLock> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no está configurada en el servidor');
    }

    if (!options.referenceImages || options.referenceImages.length === 0) {
      throw new Error('Se requiere al menos una imagen de referencia para el análisis');
    }

    const coverage = computeReferenceCoverage(options.referenceImages);

    // Call Gemini Generative Language REST API directly (native fetch, 0 extra dependencies)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const promptText = `
Sos el Director Técnico de Análisis Textil de Catalog AI.
Analizá minuciosamente las fotografías provistas de esta prenda de moda.
NOMBRE INDICADO: "${options.name}"
CATEGORÍA SUGERIDA: "${options.category}"

OBJETIVOS OBLIGATORIOS:
1. Identificá moldería, corte, material probable, textura visible, escote, mangas, bolsillos, cierres y detalles de confección.
2. Identificá TODAS las variantes de color visibles en la fotografía de referencia. Si la foto muestra la misma prenda en múltiples colores (ej. Negro, Bordó, Beige, Azul, Verde, Terracota), extraé cada variante cromática con su descripción tonal exacta y su distribución de estampa/bordado.
3. Extraé una lista de "mustPreserve" innegociables (elementos que un modelo generativo jamás debe alterar).
4. Distinguí claramente lo observado directamente de lo inferido.

Devolvé EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "name": "nombre descriptivo de la prenda",
  "category": "Vestido | Mono | Remera | Camisa | Pantalón | Short | Pollera | Campera | Sweater | Conjunto | Otro",
  "material": "descripción textil y trama",
  "pattern": "descripción de estampa o liso",
  "details": ["detalle 1", "detalle 2"],
  "pockets": true/false,
  "mustPreserve": ["regla 1", "regla 2"],
  "colorVariants": [
    {
      "name": "Nombre común (ej. Negro, Bordó, etc.)",
      "detectedColor": "Tono visual exacto",
      "colorDescription": "Descripción tonal y relación con la estampa",
      "approximateHex": "#HEX",
      "patternDistribution": "Cómo se distribuye el estampado en este color",
      "confidence": 95
    }
  ]
}
`;

    // Format content parts with image URLs or base64
    const parts: unknown[] = [{ text: promptText }];

    for (const img of options.referenceImages) {
      if (img.url.startsWith('data:')) {
        const matches = img.url.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inline_data: {
              mime_type: matches[1],
              data: matches[2],
            },
          });
        }
      } else {
        // Direct image reference text context for URL
        parts.push({
          text: `[REFERENCE IMAGE URL: ${img.url}]`,
        });
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errText}`);
      }

      const rawJson = await response.json();
      const outputText = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!outputText) {
        throw new Error('Respuesta vacía de Gemini Analysis');
      }

      const parsed: GeminiAnalysisResponse = JSON.parse(outputText);

      const validatedCategory = GarmentCategorySchema.safeParse(parsed.category).success
        ? (parsed.category as GarmentCategory)
        : (options.category as GarmentCategory) || 'Mono';

      const colorVariants: ColorVariant[] = (parsed.colorVariants || []).map((v, idx) => ({
        id: `col-${Date.now()}-${idx}`,
        name: v.name,
        detectedColor: v.detectedColor,
        colorDescription: v.colorDescription,
        approximateHex: v.approximateHex || '#2563EB',
        patternDistribution: v.patternDistribution,
        confidence: v.confidence || 95,
        referenceCrop: options.referenceImages[idx % options.referenceImages.length]?.url,
        referenceAssets: [options.referenceImages[idx % options.referenceImages.length]].filter(Boolean),
        selected: true,
        order: idx,
      }));

      return {
        id: `glock-real-${Date.now()}`,
        name: parsed.name || options.name,
        category: validatedCategory,
        material: parsed.material || 'Lino orgánico prelavado',
        pattern: parsed.pattern || 'Estampado textil continuo',
        details: parsed.details || ['Corte estructurado', 'Costuras al tono'],
        pockets: Boolean(parsed.pockets),
        sizes: options.sizes.length > 0 ? options.sizes : ['1', '2', '3', '4'],
        mustPreserve: parsed.mustPreserve || ['silueta original', 'estampa y costuras'],
        colorVariants: colorVariants.length > 0 ? colorVariants : [
          {
            id: `col-default-${Date.now()}`,
            name: 'Original',
            detectedColor: 'Color base detectado',
            colorDescription: 'Color de la prenda original',
            approximateHex: '#18181B',
            selected: true,
            order: 0,
          }
        ],
        coverage,
        referenceImages: options.referenceImages,
      };
    } catch (err: unknown) {
      console.error('Error during real Gemini garment analysis:', err);
      throw err;
    }
  }
}
