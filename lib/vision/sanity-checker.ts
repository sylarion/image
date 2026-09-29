import { GarmentInstance, GarmentCrop, ProductGroup, SanityCheckResult, SanityCheckConflict } from '@/types';

export class SceneSanityChecker {
  /**
   * Evaluates the consistency between physical detections, physical crops,
   * product grouping, and variant reconciliation.
   */
  static evaluate(params: {
    instances: GarmentInstance[];
    crops: GarmentCrop[];
    productGroups: ProductGroup[];
  }): SanityCheckResult {
    const { instances, crops, productGroups } = params;
    const instanceCount = instances.length;
    const cropCount = crops.length;
    const productGroupCount = productGroups.length;
    const variantCount = productGroups.reduce((acc, g) => acc + g.variants.length, 0);

    const conflicts: SanityCheckConflict[] = [];

    // Rule 1: Zero physical detections
    if (instanceCount === 0) {
      conflicts.push({
        code: 'ZERO_DETECTIONS',
        message: 'No se detectaron prendas físicas visibles en la imagen.',
      });
    }

    // Rule 2: Unmatched crops (crops count does not match instance count)
    if (instanceCount > 0 && cropCount !== instanceCount) {
      conflicts.push({
        code: 'UNMATCHED_CROPS',
        message: `Discrepancia en recortes: ${instanceCount} prendas detectadas pero se generaron ${cropCount} recortes físicos.`,
        details: { instanceCount, cropCount },
      });
    }

    // Rule 3: CRITICAL SANITY CHECK — VARIANT_RECONCILIATION_CONFLICT
    // If multiple physical garments exist (>= 2) but collapsed into 1 single variant
    // without confirmation that they are identical duplicates.
    if (instanceCount >= 2 && variantCount === 1) {
      conflicts.push({
        code: 'VARIANT_RECONCILIATION_CONFLICT',
        message: `Conflicto de reconciliación: Se detectaron ${instanceCount} prendas físicas visibles pero el sistema colapsó el resultado a 1 sola variante sin justificación.`,
        details: {
          instanceCount,
          productGroupCount,
          variantCount,
        },
      });
    }

    // Rule 4: Instances without product group
    if (instanceCount > 0 && productGroupCount === 0) {
      conflicts.push({
        code: 'UNRESOLVED_GROUP',
        message: 'Las prendas detectadas no pudieron asignarse a ningún grupo de producto.',
      });
    }

    return {
      passed: conflicts.length === 0,
      instanceCount,
      cropCount,
      productGroupCount,
      variantCount,
      conflicts,
    };
  }
}
