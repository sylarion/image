import { 
  DetectedGarment, 
  GarmentCrop, 
  GarmentReference, 
  GarmentVariant, 
  GarmentVisualSignature, 
  ProductGroup,
  ImageVisualRole,
  ObservedVariant
} from '@/types';
import { deltaE, rgbToLab } from './color-analyzer';

/**
 * Normalizes text strings for robust structural comparison.
 */
function normalizeStructuralToken(token?: string): string {
  return (token || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Parses hex string to RGB numbers.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0,
  };
}

/**
 * Compares structural features between two detected garments.
 * Crucial Rule: COLOR IS NOT A SIGNAL OF PRODUCT IDENTITY.
 * Two garments with identical moldería/cut but different colors belong to the SAME product.
 * Two garments with different cuts/sleeves/necklines belong to DIFFERENT products.
 */
export function areGarmentsSameProduct(
  g1: DetectedGarment,
  g2: DetectedGarment
): { sameProduct: boolean; confidence: number; reason: string } {
  // 2. Category mismatch
  const cat1 = normalizeStructuralToken(g1.probableCategory);
  const cat2 = normalizeStructuralToken(g2.probableCategory);
  if (cat1 && cat2 && cat1 !== cat2 && cat1 !== 'otro' && cat2 !== 'otro') {
    return { sameProduct: false, confidence: 0.95, reason: `Categorías distintas (${cat1} vs ${cat2})` };
  }

  // 3. Compare visual signatures if available
  const sig1 = g1.visualSignature;
  const sig2 = g2.visualSignature;

  if (sig1 && sig2) {
    const s1 = normalizeStructuralToken(sig1.silhouette);
    const s2 = normalizeStructuralToken(sig2.silhouette);
    const n1 = normalizeStructuralToken(sig1.neckline);
    const n2 = normalizeStructuralToken(sig2.neckline);
    const sl1 = normalizeStructuralToken(sig1.sleeveType);
    const sl2 = normalizeStructuralToken(sig2.sleeveType);
    const l1 = normalizeStructuralToken(sig1.length);
    const l2 = normalizeStructuralToken(sig2.length);

    // Major structural differences that force separate products:
    if (sl1 && sl2 && sl1 !== sl2) {
      return { sameProduct: false, confidence: 0.92, reason: `Manga diferente: "${sl1}" vs "${sl2}"` };
    }

    if (n1 && n2 && n1 !== n2) {
      return { sameProduct: false, confidence: 0.90, reason: `Escote diferente: "${n1}" vs "${n2}"` };
    }

    if (s1 && s2 && s1 !== s2) {
      return { sameProduct: false, confidence: 0.88, reason: `Silueta diferente: "${s1}" vs "${s2}"` };
    }

    if (l1 && l2 && l1 !== l2) {
      return { sameProduct: false, confidence: 0.85, reason: `Largo diferente: "${l1}" vs "${l2}"` };
    }

    return { sameProduct: true, confidence: 0.93, reason: 'Moldería, escote, mangas y silueta idénticas' };
  }

  // Default fallback when signatures are minimal: if categories match, cluster into same product
  return { sameProduct: true, confidence: 0.80, reason: 'Categoría compatible sin discrepancias estructurales' };
}

export class ProductGroupingService {
  /**
   * Builds an ObservedVariant layer from physical detections and crops.
   * Preserves individual physical observation identity before any variant reconciliation.
   */
  createObservedVariants(
    items: {
      detection: DetectedGarment;
      crop: GarmentCrop;
      sourceImageId: string;
      imageRole?: ImageVisualRole;
    }[]
  ): ObservedVariant[] {
    return items.map((item) => {
      const { detection, crop, sourceImageId, imageRole } = item;
      const rgb = hexToRgb(detection.dominantColor.hex);
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);

      let effectiveRole: ImageVisualRole = 'FRONT';
      if (detection.orientation && detection.orientation !== 'UNKNOWN') {
        effectiveRole = detection.orientation;
      } else if (imageRole && imageRole !== 'UNKNOWN' && imageRole !== 'MULTI_VIEW') {
        effectiveRole = imageRole;
      }

      return {
        id: `obs-${detection.detectionId}`,
        analysisRunId: detection.analysisRunId,
        category: detection.probableCategory,
        visionColorHex: detection.aiSuggestedColor?.hex,
        detectionId: detection.detectionId,
        cropId: crop.id,
        cropUrl: crop.url,
        sourceImageId,
        observedColor: {
          rawHex: detection.dominantColor.hex,
          rgb,
          lab,
          semanticName: detection.dominantColor.name,
        },
        rawColorHex: detection.dominantColor.hex,
        colorLab: lab,
        semanticColorName: detection.dominantColor.name,
        productGroupCandidateId: detection.sameProductGroup || 'group-candidate-1',
        confidence: detection.confidence,
        orientation: effectiveRole,
      };
    });
  }

  /**
   * Groups a collection of detected garments and their physical crops
   * into canonical ProductGroups, GarmentVariants, and ReferenceSets.
   */
  groupDetections(
    items: {
      detection: DetectedGarment;
      crop: GarmentCrop;
      sourceImageId: string;
      imageRole?: ImageVisualRole;
    }[]
  ): ProductGroup[] {
    const observedVariants = this.createObservedVariants(items);
    return this.reconcileObservedVariants(items, observedVariants);
  }

  /**
   * Groups detections and also returns the intermediate ObservedVariant layer.
   */
  groupDetectionsWithObservations(
    items: {
      detection: DetectedGarment;
      crop: GarmentCrop;
      sourceImageId: string;
      imageRole?: ImageVisualRole;
    }[]
  ): { productGroups: ProductGroup[]; observedVariants: ObservedVariant[] } {
    const observedVariants = this.createObservedVariants(items);
    const productGroups = this.reconcileObservedVariants(items, observedVariants);
    return { productGroups, observedVariants };
  }


  /**
   * Reconciles ObservedVariants into ProductGroups & GarmentVariants using:
   * 1. Structural features -> ProductGroup identity
   * 2. Perceptual color distance (Delta E in LAB) -> Variant identity
   * 3. Physical crop / orientation -> Reference identity
   */
  reconcileObservedVariants(
    items: {
      detection: DetectedGarment;
      crop: GarmentCrop;
      sourceImageId: string;
      imageRole?: ImageVisualRole;
    }[],
    observedVariants: ObservedVariant[]
  ): ProductGroup[] {
    const productGroups: ProductGroup[] = [];

    // Map by detectionId for quick reference
    const itemsByDetectionId = new Map<string, typeof items[0]>();
    for (const item of items) {
      itemsByDetectionId.set(item.detection.detectionId, item);
    }

    for (const obs of observedVariants) {
      const item = itemsByDetectionId.get(obs.detectionId);
      if (!item) continue;
      const { detection, crop, sourceImageId } = item;

      // 1. Resolve ProductGroup by structural identity
      let targetGroup = productGroups.find((grp) => {
        const representativeDetection: DetectedGarment = {
          detectionId: grp.id,
          boundingBox: crop.boundingBox,
          confidence: grp.confidence,
          probableCategory: grp.category,
          dominantColor: grp.variants[0]
            ? {
                name: grp.variants[0].color.canonicalName,
                hex: grp.variants[0].color.hex,
                confidence: grp.variants[0].color.confidence,
              }
            : detection.dominantColor,
          orientation: 'FRONT',
          visualSignature: grp.visualSignature,
          sameProductGroup: grp.id,
        };

        const result = areGarmentsSameProduct(detection, representativeDetection);
        return result.sameProduct;
      });

      if (!targetGroup) {
        const groupId = `prod-${Date.now()}-${productGroups.length + 1}`;
        const defaultSignature: GarmentVisualSignature = detection.visualSignature || {
          category: detection.probableCategory || 'Prenda',
          silhouette: 'Estándar',
          neckline: 'Estándar',
          sleeveType: 'Estándar',
          length: 'Midi',
          hasPockets: false,
          patternType: 'Liso',
          distinctiveDetails: [],
        };

        targetGroup = {
          id: groupId,
          name: `${detection.probableCategory || 'Producto'} ${productGroups.length + 1}`,
          category: detection.probableCategory || 'Prenda',
          variants: [],
          references: [],
          visualSignature: defaultSignature,
          confidence: detection.confidence,
        };
        productGroups.push(targetGroup);
      }

      // 2. Resolve VariantIdentity by perceptual color distance (Delta E) in LAB space
      // Rule: Two detections with identical/near-identical color (Delta E < 10) share a variant.
      // Distinct colors (Delta E >= 10) form separate variants.
      let targetVariant: GarmentVariant | undefined;

      for (const v of targetGroup.variants) {
        const vLab = v.color.lab || (v.color.hex ? rgbToLab(hexToRgb(v.color.hex).r, hexToRgb(v.color.hex).g, hexToRgb(v.color.hex).b) : undefined);
        if (vLab) {
          const dE = deltaE(obs.observedColor.lab, vLab);
          // If deltaE is very small (< 10), they represent the same colorway!
          const previous = observedVariants.find(o=>v.observedVariantIds?.includes(o.id || o.detectionId));
          const visionLab = (hex:string) => { const c=hexToRgb(hex); return rgbToLab(c.r,c.g,c.b); };
          const visionDisagrees = obs.visionColorHex && previous?.visionColorHex &&
            deltaE(visionLab(obs.visionColorHex),visionLab(previous.visionColorHex)) >= 10;
          // Printed fabric/background can collapse crop averages. Preserve observations
          // when the independent numeric vision estimate contradicts a pixel-color merge.
          if (dE < 10 && !visionDisagrees) {
            targetVariant = v;
            break;
          }
        } else {
          // Fallback to normalized name match if lab not available
          const vColor = normalizeStructuralToken(v.color.canonicalName);
          const obsColor = normalizeStructuralToken(obs.observedColor.semanticName);
          if (vColor === obsColor) {
            targetVariant = v;
            break;
          }
        }
      }

      if (!targetVariant) {
        // Create new distinct variant
        const variantColorName = obs.observedColor.semanticName;
        const variantId = `var-${targetGroup.id}-${variantColorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${targetGroup.variants.length + 1}`;

        targetVariant = {
          id: variantId,
          productGroupId: targetGroup.id,
          color: {
            canonicalName: variantColorName,
            observedName: variantColorName,
            hex: obs.observedColor.rawHex,
            rgb: obs.observedColor.rgb,
            lab: obs.observedColor.lab,
            confidence: obs.confidence,
          },
          referenceCrops: [crop.url],
          sourceImageIds: [sourceImageId],
          cropIds: [crop.id],
          observedVariantIds: [obs.id || obs.detectionId],
        };
        targetGroup.variants.push(targetVariant);
      } else {
        targetVariant.cropIds = [...new Set([...(targetVariant.cropIds || []), crop.id])];
        // Add physical reference crop to existing variant
        if (!targetVariant.referenceCrops.includes(crop.url)) {
          targetVariant.referenceCrops.push(crop.url);
        }
        if (!targetVariant.sourceImageIds.includes(sourceImageId)) {
          targetVariant.sourceImageIds.push(sourceImageId);
        }
        if (!targetVariant.observedVariantIds) {
          targetVariant.observedVariantIds = [];
        }
        if (!targetVariant.observedVariantIds.includes(obs.id || obs.detectionId)) {
          targetVariant.observedVariantIds.push(obs.id || obs.detectionId);
        }
      }

      // 3. Resolve ReferenceIdentity: Each physical detection ALWAYS creates a reference
      const rawRole = obs.orientation;
      const validRole = (rawRole === 'MULTI_VIEW' ? 'FRONT' : rawRole) || 'FRONT';
      const reference: GarmentReference = {
        id: `ref-${crop.id}`,
        productGroupId: targetGroup.id,
        variantId: targetVariant.id,
        role: validRole as GarmentReference['role'],
        sourceImageId,
        cropId: crop.id,
        confidence: detection.confidence,
      };

      targetGroup.references.push(reference);
    }

    return productGroups;
  }
}

