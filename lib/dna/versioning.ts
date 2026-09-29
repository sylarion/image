import { 
  GarmentDNA, 
  DNAChangeLog, 
  DNAConflict, 
  GarmentDNASchema 
} from '@/types/dna';
import { deriveImmutableRules } from './rules';

export interface UpdateGarmentDNAInput {
  property: string;
  newValue: unknown;
  source: 'USER' | 'AI' | 'SYSTEM';
  reason?: string;
}

/**
 * Manages versioning, immutability of historical versions, and audit trails for GarmentDNA.
 */
export class DNAVersioningService {
  /**
   * Applies manual or system modifications to a GarmentDNA instance.
   * Increments version, preserves reference to previousVersionId, and records a DNAChangeLog entry.
   * Never mutates or overwrites the previous DNA silently.
   */
  static applyUpdate(
    currentDNA: GarmentDNA,
    update: UpdateGarmentDNAInput
  ): { updatedDNA: GarmentDNA; changeLog: DNAChangeLog } {
    const { property, newValue, source, reason } = update;

    // Retrieve previous value safely using dotted path or direct key
    const previousValue = this.getNestedProperty(currentDNA, property);

    const changeLogId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const changeLog: DNAChangeLog = {
      id: changeLogId,
      garmentDNAId: currentDNA.id,
      property,
      previousValue,
      newValue,
      source,
      reason: reason || (source === 'USER' ? 'Corrección manual del usuario en el inspector' : 'Actualización de evidencia visual'),
      createdAt: new Date().toISOString(),
    };

    // Deep clone the current DNA to avoid mutating previous version in-place
    const cloned = JSON.parse(JSON.stringify(currentDNA)) as GarmentDNA;

    // Set nested value on cloned object
    this.setNestedProperty(cloned, property, newValue);

    // If a property is manually confirmed by user, update verification status to 'VERIFIED'
    if (source === 'USER') {
      const statusProp = property.includes('.') ? `${property.split('.')[0]}.status` : `${property}Status`;
      if (this.hasNestedProperty(cloned, statusProp)) {
        this.setNestedProperty(cloned, statusProp, 'VERIFIED');
      }
    }

    // Increment version and attach audit trails
    const newVersion = currentDNA.version + 1;
    const newDnaId = `dna-${currentDNA.productGroupId}-v${newVersion}`;

    cloned.id = newDnaId;
    cloned.version = newVersion;
    cloned.previousVersionId = currentDNA.id;
    cloned.changeReason = changeLog.reason;
    cloned.updatedAt = new Date().toISOString();
    cloned.auditTrail = [...(currentDNA.auditTrail || []), changeLog];

    // Re-derive immutable rules so HARD invariants update if button/neckline was edited
    cloned.immutableRules = deriveImmutableRules(cloned);

    // Validate with Zod before returning
    const validated = GarmentDNASchema.parse(cloned);

    return {
      updatedDNA: validated,
      changeLog,
    };
  }

  /**
   * Creates a new DNA version when a new reference image is added (e.g. Back view added).
   */
  static createNewVersionWithEvidence(
    previousDNA: GarmentDNA,
    mergedDNA: Partial<GarmentDNA>,
    reason: string
  ): GarmentDNA {
    const newVersion = previousDNA.version + 1;
    const newDnaId = `dna-${previousDNA.productGroupId}-v${newVersion}`;

    const changeLog: DNAChangeLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      garmentDNAId: previousDNA.id,
      property: 'evidence.references',
      previousValue: previousDNA.evidence.map((e) => e.referenceId),
      newValue: (mergedDNA.evidence || []).map((e) => e.referenceId),
      source: 'AI',
      reason,
      createdAt: new Date().toISOString(),
    };

    const nextDNA: GarmentDNA = {
      ...previousDNA,
      ...mergedDNA,
      id: newDnaId,
      version: newVersion,
      previousVersionId: previousDNA.id,
      changeReason: reason,
      auditTrail: [...(previousDNA.auditTrail || []), changeLog],
      updatedAt: new Date().toISOString(),
    };

    nextDNA.immutableRules = deriveImmutableRules(nextDNA);

    return GarmentDNASchema.parse(nextDNA);
  }

  private static getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let curr: unknown = obj;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = (curr as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return curr;
  }

  private static setNestedProperty(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let curr: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part] || typeof curr[part] !== 'object') {
        curr[part] = {};
      }
      curr = curr[part] as Record<string, unknown>;
    }
    curr[parts[parts.length - 1]] = value;
  }

  private static hasNestedProperty(obj: Record<string, unknown>, path: string): boolean {
    const parts = path.split('.');
    let curr: unknown = obj;
    for (const part of parts) {
      if (curr && typeof curr === 'object' && part in curr) {
        curr = (curr as Record<string, unknown>)[part];
      } else {
        return false;
      }
    }
    return true;
  }
}
