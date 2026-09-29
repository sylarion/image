import sharp from 'sharp';

export interface AnalyzedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  lab: [number, number, number];
  canonicalName: string;
  observedName: string;
  confidence: number;
  isBackgroundLikely: boolean;
}


const CANONICAL_PALETTE: { name: string; hex: string; r: number; g: number; b: number }[] = [
  { name: 'Negro', hex: '#18181B', r: 24, g: 24, b: 27 },
  { name: 'Blanco', hex: '#FFFFFF', r: 255, g: 255, b: 255 },
  { name: 'Crudo', hex: '#F5F5F4', r: 245, g: 245, b: 244 },
  { name: 'Gris Claro', hex: '#CBD5E1', r: 203, g: 213, b: 225 },
  { name: 'Gris', hex: '#64748B', r: 100, g: 116, b: 139 },
  { name: 'Gris Plomo', hex: '#334155', r: 51, g: 65, b: 85 },
  { name: 'Rojo', hex: '#DC2626', r: 220, g: 38, b: 38 },
  { name: 'Bordó', hex: '#7F1D1D', r: 127, g: 29, b: 29 },
  { name: 'Terracota', hex: '#C2410C', r: 194, g: 65, b: 12 },
  { name: 'Naranja', hex: '#EA580C', r: 234, g: 88, b: 12 },
  { name: 'Coral', hex: '#FB7185', r: 251, g: 113, b: 133 },
  { name: 'Rosa', hex: '#DB2777', r: 219, g: 39, b: 119 },
  { name: 'Fucsia', hex: '#BE185D', r: 190, g: 24, b: 93 },
  { name: 'Lavanda', hex: '#C084FC', r: 192, g: 132, b: 252 },
  { name: 'Violeta', hex: '#7C3AED', r: 124, g: 58, b: 237 },
  { name: 'Azul Marino', hex: '#1E3A8A', r: 30, g: 58, b: 138 },
  { name: 'Azul', hex: '#1D4ED8', r: 29, g: 78, b: 216 },
  { name: 'Azul Noche', hex: '#1E1B4B', r: 30, g: 27, b: 75 },
  { name: 'Celeste', hex: '#38BDF8', r: 56, g: 189, b: 248 },
  { name: 'Turquesa', hex: '#06B6D4', r: 6, g: 182, b: 212 },
  { name: 'Verde Agua', hex: '#2DD4BF', r: 45, g: 212, b: 191 },
  { name: 'Verde Esmeralda', hex: '#10B981', r: 16, g: 185, b: 129 },
  { name: 'Verde', hex: '#16A34A', r: 22, g: 163, b: 74 },
  { name: 'Verde Seco', hex: '#4D7C0F', r: 77, g: 124, b: 15 },
  { name: 'Verde Oliva', hex: '#3F6212', r: 63, g: 98, b: 18 },
  { name: 'Beige', hex: '#D4D4D8', r: 212, g: 212, b: 216 },
  { name: 'Camel', hex: '#B45309', r: 180, g: 83, b: 9 },
  { name: 'Marrón', hex: '#78350F', r: 120, g: 53, b: 15 },
  { name: 'Amarillo', hex: '#EAB308', r: 234, g: 179, b: 8 },
  { name: 'Mostaza', hex: '#CA8A04', r: 202, g: 138, b: 4 },
];

/**
 * Checks whether an RGB pixel is likely pure studio white / cyclorama background.
 */
function isStudioBackground(r: number, g: number, b: number): boolean {
  // Pure or near pure white
  if (r >= 242 && g >= 242 && b >= 242) return true;
  // Very light neutral gray studio cyclorama
  if (r >= 235 && g >= 235 && b >= 235 && Math.abs(r - g) <= 5 && Math.abs(g - b) <= 5) return true;
  return false;
}

/**
 * Checks whether an RGB pixel falls into typical human skin tone ranges
 * to avoid mistaking model's skin or wooden mannequin for garment color.
 */
function isHumanSkinTone(r: number, g: number, b: number): boolean {
  // Common skin tone bounds in RGB space
  if (r > 160 && g > 110 && b > 80 && r > g && g > b) {
    const diff = r - b;
    if (diff >= 30 && diff <= 100 && (r - g) >= 15) {
      return true;
    }
  }
  return false;
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // 1. RGB to linear sRGB
  let rLin = r / 255;
  let gLin = g / 255;
  let bLin = b / 255;

  rLin = rLin > 0.04045 ? Math.pow((rLin + 0.055) / 1.055, 2.4) : rLin / 12.92;
  gLin = gLin > 0.04045 ? Math.pow((gLin + 0.055) / 1.055, 2.4) : gLin / 12.92;
  bLin = bLin > 0.04045 ? Math.pow((bLin + 0.055) / 1.055, 2.4) : bLin / 12.92;

  // 2. Linear sRGB to XYZ (D65 standard illuminant)
  const x = (rLin * 0.4124 + gLin * 0.3576 + bLin * 0.1805) / 0.95047;
  const y = (rLin * 0.2126 + gLin * 0.7152 + bLin * 0.0722) / 1.00000;
  const z = (rLin * 0.0193 + gLin * 0.1192 + bLin * 0.9505) / 1.08883;

  // 3. XYZ to CIE L*a*b*
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = 116 * fy - 16;
  const aVal = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [Number(L.toFixed(2)), Number(aVal.toFixed(2)), Number(bVal.toFixed(2))];
}

export function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(lab1[0] - lab2[0], 2) +
    Math.pow(lab1[1] - lab2[1], 2) +
    Math.pow(lab1[2] - lab2[2], 2)
  );
}

export class ColorAnalyzer {
  /**
   * Analyzes an image buffer (cropped garment) at pixel level.
   * Strips background and skin tones, calculates dominant chromatic cluster,
   * and maps to canonical fashion palettes.
   */
  async analyzeGarmentCrop(
    imageBuffer: Buffer,
    semanticSuggestion?: { name?: string; hex?: string }
  ): Promise<AnalyzedColor> {
    // Resize down to 80x80 thumbnail for fast, robust chromatic clustering
    const { data, info } = await sharp(imageBuffer)
      .resize(80, 80, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    const channels = info.channels; // 4 (RGBA)

    // Collect valid garment pixels (prioritizing central 70% where garment is most prominent)
    const validPixels: { r: number; g: number; b: number; weight: number }[] = [];
    let backgroundPixelsCount = 0;

    const startX = Math.floor(info.width * 0.15);
    const endX = Math.ceil(info.width * 0.85);
    const startY = Math.floor(info.height * 0.15);
    const endY = Math.ceil(info.height * 0.85);

    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const offset = (y * info.width + x) * channels;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const a = channels >= 4 ? data[offset + 3] : 255;

        // Skip fully transparent
        if (a < 50) continue;

        if (isStudioBackground(r, g, b)) {
          backgroundPixelsCount++;
          continue;
        }

        // Weight pixels: inner core pixels get 2x weight over perimeter
        const isCore = x >= startX && x <= endX && y >= startY && y <= endY;
        const isSkin = isHumanSkinTone(r, g, b);

        const weight = isSkin ? 0.3 : (isCore ? 2.0 : 1.0);
        validPixels.push({ r, g, b, weight });
      }
    }

    // Fallback if the whole image was flagged as background
    if (validPixels.length === 0) {
      return {
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        lab: [100, 0, 0],
        canonicalName: 'Blanco',
        observedName: semanticSuggestion?.name || 'Blanco',
        confidence: 0.7,
        isBackgroundLikely: true,
      };
    }

    // Weighted average of garment pixels
    let sumR = 0, sumG = 0, sumB = 0, totalWeight = 0;
    for (const p of validPixels) {
      sumR += p.r * p.weight;
      sumG += p.g * p.weight;
      sumB += p.b * p.weight;
      totalWeight += p.weight;
    }

    const avgR = Math.round(sumR / totalWeight);
    const avgG = Math.round(sumG / totalWeight);
    const avgB = Math.round(sumB / totalWeight);
    const calculatedHex = rgbToHex(avgR, avgG, avgB);
    const calculatedLab = rgbToLab(avgR, avgG, avgB);

    // Map to closest canonical color name
    let bestMatch = CANONICAL_PALETTE[0];
    let minDistance = Infinity;

    for (const color of CANONICAL_PALETTE) {
      const dist = colorDistance(avgR, avgG, avgB, color.r, color.g, color.b);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = color;
      }
    }

    // Confidence calculation: higher if dominant pixels represent substantial portion of crop
    const coverageRatio = validPixels.length / totalPixels;
    let confidence = Math.min(0.98, Math.max(0.72, coverageRatio * 1.1));

    // If semanticSuggestion aligns, boost confidence and prioritize it
    let observedName = bestMatch.name;
    if (semanticSuggestion?.name && semanticSuggestion.name.trim().length > 0) {
      observedName = semanticSuggestion.name;
      const sem = semanticSuggestion.name.toLowerCase();
      const canon = bestMatch.name.toLowerCase();
      if (sem.includes(canon) || canon.includes(sem)) {
        confidence = Math.min(0.99, confidence + 0.05);
      }
    }

    return {
      hex: calculatedHex,
      rgb: { r: avgR, g: avgG, b: avgB },
      lab: calculatedLab,
      canonicalName: bestMatch.name,
      observedName,
      confidence: Number(confidence.toFixed(2)),
      isBackgroundLikely: backgroundPixelsCount > totalPixels * 0.85,
    };
  }
}

