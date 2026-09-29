import { GarmentDNA, GarmentInvariant, ValidationContract } from '@/types/dna';

/**
 * Extracts immutable structural rules (GarmentInvariants) from a verified GarmentDNA.
 * Separates HARD constraints (crucial tailoring rules like button count, neckline type, sleeve length)
 * from SOFT constraints (material sheen, drape, texture notes).
 */
export function deriveImmutableRules(dna: Partial<GarmentDNA>): GarmentInvariant[] {
  const invariants: GarmentInvariant[] = [];

  // 1. Buttons
  if (dna.buttons && dna.buttons.visible && dna.buttons.count !== null && dna.buttons.count !== undefined) {
    invariants.push({
      id: `inv-btn-${Date.now()}-1`,
      property: 'buttons.count',
      expectedValue: dna.buttons.count,
      tolerance: 0,
      severity: 'HARD',
      confidence: dna.buttons.confidence ?? 0.95,
      reason: `Cantidad exacta de botones observables en referencias frontales: ${dna.buttons.count}`,
    });
  }

  // 2. Neckline
  if (dna.neckline && dna.neckline.type && dna.neckline.type !== 'UNKNOWN') {
    invariants.push({
      id: `inv-neck-${Date.now()}-2`,
      property: 'neckline.type',
      expectedValue: dna.neckline.type,
      severity: 'HARD',
      confidence: dna.neckline.confidence ?? 0.95,
      reason: `Moldería de escote obligatoria: ${dna.neckline.type}`,
    });
  }

  if (dna.neckline && dna.neckline.depth && dna.neckline.depth !== 'UNKNOWN') {
    invariants.push({
      id: `inv-neckdepth-${Date.now()}-3`,
      property: 'neckline.depth',
      expectedValue: dna.neckline.depth,
      severity: 'HARD',
      confidence: dna.neckline.confidence ?? 0.9,
      reason: `Profundidad de escote: ${dna.neckline.depth}`,
    });
  }

  // 3. Sleeves
  if (dna.sleeves) {
    if (dna.sleeves.present === false || dna.sleeves.length === 'SLEEVELESS') {
      invariants.push({
        id: `inv-sleeve-${Date.now()}-4`,
        property: 'sleeves.present',
        expectedValue: false,
        severity: 'HARD',
        confidence: dna.sleeves.confidence ?? 0.95,
        reason: 'Prenda sin mangas (sleeveless); la generación no debe agregar mangas.',
      });
    } else if (dna.sleeves.length && dna.sleeves.length !== 'UNKNOWN') {
      invariants.push({
        id: `inv-sleevelen-${Date.now()}-5`,
        property: 'sleeves.length',
        expectedValue: dna.sleeves.length,
        severity: 'HARD',
        confidence: dna.sleeves.confidence ?? 0.9,
        reason: `Largo de mangas estructural: ${dna.sleeves.length}`,
      });
    }
  }

  // 4. Pockets
  if (dna.pockets && dna.pockets.count !== null && dna.pockets.count !== undefined) {
    invariants.push({
      id: `inv-pockets-${Date.now()}-6`,
      property: 'pockets.count',
      expectedValue: dna.pockets.count,
      tolerance: 0,
      severity: 'HARD',
      confidence: dna.pockets.confidence ?? 0.9,
      reason: `Número de bolsillos verificados: ${dna.pockets.count}`,
    });
  }

  // 5. Silhouette
  if (dna.silhouette && dna.silhouette.type && dna.silhouette.type !== 'UNKNOWN') {
    invariants.push({
      id: `inv-sil-${Date.now()}-7`,
      property: 'silhouette.type',
      expectedValue: dna.silhouette.type,
      severity: 'HARD',
      confidence: dna.silhouette.confidence ?? 0.9,
      reason: `Silueta y corte general: ${dna.silhouette.type}`,
    });
  }

  // 6. Hem Asymmetry
  if (dna.hem && dna.hem.asymmetry !== undefined) {
    invariants.push({
      id: `inv-hem-${Date.now()}-8`,
      property: 'hem.asymmetry',
      expectedValue: dna.hem.asymmetry,
      severity: 'HARD',
      confidence: dna.hem.confidence ?? 0.9,
      reason: dna.hem.asymmetry ? 'Ruedo con asimetría obligatoria' : 'Ruedo simétrico y recto',
    });
  }

  // 7. Material Sheen / Drape (SOFT Invariants)
  if (dna.materialAppearance) {
    if (dna.materialAppearance.sheen) {
      invariants.push({
        id: `inv-mat-sheen-${Date.now()}-9`,
        property: 'materialAppearance.sheen',
        expectedValue: dna.materialAppearance.sheen,
        severity: 'SOFT',
        confidence: dna.materialAppearance.confidence ?? 0.8,
        reason: `Brillo de la tela: ${dna.materialAppearance.sheen}`,
      });
    }
    if (dna.materialAppearance.drape) {
      invariants.push({
        id: `inv-mat-drape-${Date.now()}-10`,
        property: 'materialAppearance.drape',
        expectedValue: dna.materialAppearance.drape,
        severity: 'SOFT',
        confidence: dna.materialAppearance.confidence ?? 0.8,
        reason: `Caída de la tela: ${dna.materialAppearance.drape}`,
      });
    }
  }

  return invariants;
}

/**
 * Compiles a structured GarmentDNA into enforceable prompt constraint directives.
 * (Ready for integration in Phase D, currently pure compile function).
 */
export function compileGarmentConstraints(dna: GarmentDNA): string[] {
  const constraints: string[] = [];

  // Category & Silhouette
  if (dna.category) {
    constraints.push(`Exact garment category: ${dna.category}.`);
  }
  if (dna.silhouette.type !== 'UNKNOWN') {
    constraints.push(`Silhoutte must strictly be ${dna.silhouette.type.toLowerCase().replace(/_/g, ' ')}.`);
  }

  // Neckline
  if (dna.neckline.type !== 'UNKNOWN') {
    constraints.push(`Neckline must be ${dna.neckline.type} with ${dna.neckline.depth.toLowerCase()} depth.`);
  }

  // Sleeves
  if (dna.sleeves.present === false || dna.sleeves.length === 'SLEEVELESS') {
    constraints.push('Sleeveless design: absolutely no sleeves or shoulder coverings.');
  } else if (dna.sleeves.length && dna.sleeves.length !== 'UNKNOWN') {
    constraints.push(`Sleeves must be ${dna.sleeves.length.toLowerCase().replace(/_/g, ' ')}${dna.sleeves.type ? ` (${dna.sleeves.type})` : ''}.`);
  }

  // Buttons
  if (dna.buttons.visible && dna.buttons.count !== null && dna.buttons.count !== undefined) {
    constraints.push(`Front closure must have exactly ${dna.buttons.count} buttons placed ${dna.buttons.placement.join(', ') || 'vertically along center placket'}. Do not hallucinate or omit buttons.`);
  }

  // Pockets
  if (dna.pockets.count !== null && dna.pockets.count !== undefined) {
    if (dna.pockets.count === 0) {
      constraints.push('No visible exterior pockets.');
    } else {
      constraints.push(`Garment has exactly ${dna.pockets.count} pocket(s) positioned at ${dna.pockets.placement.join(', ') || 'sides'}.`);
    }
  }

  // Embroidery / Prints
  for (const emb of dna.embroidery) {
    constraints.push(`Embroidery feature: ${emb.kind} located at ${emb.placement.join(', ')}.`);
  }

  for (const pr of dna.print) {
    constraints.push(`Surface pattern: ${pr.repeatPattern || 'continuous'} print covering ${pr.placement.join(', ')}.`);
  }

  // Hem
  if (dna.hem.shape) {
    constraints.push(`Hemline: ${dna.hem.shape}${dna.hem.asymmetry ? ' with intentional asymmetrical cut' : ' (straight and even)'}.`);
  }

  return constraints;
}

/**
 * Builds a formal validation contract for the future validation layer.
 * Structures expected values and tolerances without touching Gemini validator yet.
 */
export function buildValidationContract(dna: GarmentDNA): ValidationContract {
  const hardInvariants = dna.immutableRules
    .filter((inv) => inv.severity === 'HARD')
    .map((inv) => ({
      property: inv.property,
      expectedValue: inv.expectedValue,
      tolerance: inv.tolerance,
      description: inv.reason || `Invariante rígido de moldería: ${inv.property}`,
    }));

  const softInvariants = dna.immutableRules
    .filter((inv) => inv.severity === 'SOFT')
    .map((inv) => ({
      property: inv.property,
      expectedValue: inv.expectedValue,
      tolerance: inv.tolerance,
      description: inv.reason || `Invariante flexible de aspecto: ${inv.property}`,
    }));

  return {
    productGroupId: dna.productGroupId,
    dnaVersion: dna.version,
    hardInvariants,
    softInvariants,
  };
}
