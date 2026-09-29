import { 
  StructuralObservation, 
  StructuralConsensus, 
  DNAConflict, 
  GarmentDNAEvidence 
} from '@/types/dna';

/**
 * Service to calculate consensus across multiple image references and variant observations.
 * When multiple references agree, it boosts confidence score.
 * When contradictory observations exist, it flags a DNAConflict and prevents blind averaging.
 */
export class StructuralConsensusService {
  /**
   * Resolves consensus for a discrete or categorical property across multiple observations.
   */
  static resolveCategoricalProperty<T extends string | number | boolean>(
    property: string,
    observations: { referenceId: string; role: string; value: T; confidence: number }[]
  ): {
    consensus: StructuralConsensus;
    conflict?: DNAConflict;
  } {
    if (!observations || observations.length === 0) {
      return {
        consensus: {
          property,
          observations: [],
          resolvedValue: 'UNKNOWN',
          agreement: 0,
          status: 'INSUFFICIENT_EVIDENCE',
        },
      };
    }

    if (observations.length === 1) {
      return {
        consensus: {
          property,
          observations,
          resolvedValue: observations[0].value,
          agreement: 1.0,
          status: 'CONFIRMED',
        },
      };
    }

    // Group counts by stringified value
    const counts = new Map<string, { value: T; totalConfidence: number; count: number }>();
    for (const obs of observations) {
      const key = String(obs.value);
      const existing = counts.get(key) || { value: obs.value, totalConfidence: 0, count: 0 };
      existing.totalConfidence += obs.confidence;
      existing.count += 1;
      counts.set(key, existing);
    }

    // Single distinct value: Perfect consensus
    if (counts.size === 1) {
      const top = Array.from(counts.values())[0];
      return {
        consensus: {
          property,
          observations,
          resolvedValue: top.value,
          agreement: 1.0,
          status: 'CONFIRMED',
        },
      };
    }

    // Multiple distinct values: Contradiction exists
    const sorted = Array.from(counts.values()).sort((a, b) => b.totalConfidence - a.totalConfidence);
    const majority = sorted[0];
    const agreement = majority.count / observations.length;

    // Check if severe disagreement (e.g. 5 buttons vs 4 buttons)
    const conflict: DNAConflict = {
      property,
      observations: observations.map((o) => ({
        referenceId: o.referenceId,
        role: (['FRONT', 'BACK', 'SIDE', 'DETAIL', 'SWATCH'].includes(o.role)
          ? o.role
          : 'FRONT') as any,
        observedValue: o.value,
        confidence: o.confidence,
      })),
      severity: property.startsWith('buttons') || property.startsWith('neckline') || property.startsWith('sleeves')
        ? 'HARD'
        : 'SOFT',
      resolutionRequired: true,
      notes: `Inconsistencia detectada entre referencias (${sorted.map((s) => `${s.value}: ${s.count} obs`).join(', ')}). Se requiere verificación o desempate visual.`,
    };

    return {
      consensus: {
        property,
        observations,
        resolvedValue: majority.value,
        agreement,
        status: 'CONFLICT',
      },
      conflict,
    };
  }
}
