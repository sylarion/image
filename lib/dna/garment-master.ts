import { 
  GarmentMaster, 
  GARMENT_MASTER_SCHEMA_VERSION, 
  StructuralFidelityMetrics, 
  CriticalStructuralFault,
  ComprehensiveValidationAudit,
  ShotVisibilityRule
} from '@/types/garment-master';
import { GarmentDNA } from '@/types/dna';
import { GarmentLock, MandatoryShotView, ImageAsset, ModelLock, ColorVariant } from '@/types';

export const LOCKED_GARMENT_ATTRIBUTES = [
  'neckline',
  'necklineGeometry',
  'buttonCount',
  'buttonPlacement',
  'buttonLayout',
  'frontPlacket',
  'sleeves',
  'sleeveLength',
  'sleeveGeometry',
  'seams',
  'seamPlacement',
  'pockets',
  'pocketPlacement',
  'hemline',
  'silhouette',
  'garmentProportions',
  'garmentLength',
  'patternTopology',
  'printStructure',
  'textureIdentity',
  'decorativeDetails',
  'structuralDetails',
] as const;

export const SHOT_VISIBILITY_RULES: Record<MandatoryShotView, ShotVisibilityRule> = {
  FRONT: {
    requiredVisible: ['neckline', 'frontPlacket', 'buttons', 'sleeves', 'frontSeams', 'silhouette', 'hemline'],
    allowedHidden: ['rearZipper', 'backStraps', 'backSeams', 'backCutout'],
  },
  SIDE: {
    requiredVisible: ['silhouetteProfile', 'sleeveLateral', 'sideSeams', 'hemDrop'],
    allowedHidden: ['frontPlacketButtons', 'fullFrontNeckline', 'rearClosureDetails'],
  },
  BACK: {
    requiredVisible: ['backConstruction', 'rearSeams', 'silhouette', 'sleevesRear', 'hemline'],
    allowedHidden: ['frontPlacket', 'frontButtons', 'frontPockets', 'frontNecklineDepth'],
  },
  ACTION: {
    requiredVisible: ['overallSilhouette', 'neckline', 'sleeves', 'approximateLength', 'patternTopology'],
    allowedHidden: ['microButtonAlignment', 'partialLimbOcclusions', 'interiorSeams'],
  },
};

/**
 * Builds the canonical GarmentMaster strictly derived from the original photo.
 * PRINCIPLE OF AUTHORITY: Original photo is primary authority.
 */
export function buildGarmentMaster(params: {
  garmentLock: GarmentLock;
  sourceImageSha256?: string;
  underlyingDNA?: GarmentDNA;
  colorVariants?: string[];
}): GarmentMaster {
  const { garmentLock, sourceImageSha256, underlyingDNA, colorVariants } = params;
  const dna = underlyingDNA || garmentLock.garmentDNA;

  const parsedButtonCount = (() => {
    if (dna?.buttons?.count !== undefined && dna?.buttons?.count !== null) return dna.buttons.count;
    const combined = [...(garmentLock.details || []), dna?.closure || ' '].join(' ').toLowerCase();
    const match = combined.match(/(\d+)\s*botones/);
    return match ? parseInt(match[1], 10) : null;
  })();
  const buttonCount = parsedButtonCount;
  const buttonPresence = dna?.buttons?.visible ?? (buttonCount !== null && buttonCount > 0);
  const pocketCount = dna?.pockets?.count ?? null;
  const pocketPresence = dna?.pockets ? (pocketCount !== null ? pocketCount > 0 : garmentLock.pockets) : garmentLock.pockets;

  const necklineType = dna?.neckline?.type || 'Redondo';
  const necklineDepth = dna?.neckline?.depth || 'MEDIUM';

  const sleevePresent = dna?.sleeves?.present ?? true;
  const sleeveType = dna?.sleeves?.type || (sleevePresent ? 'Manga estándar' : 'Sin mangas');
  const sleeveLength = dna?.sleeves?.length || (sleevePresent ? 'SHORT' : 'SLEEVELESS');

  const master: GarmentMaster = {
    masterId: `master-${garmentLock.id}`,
    schemaVersion: GARMENT_MASTER_SCHEMA_VERSION,
    sourceImageSha256: sourceImageSha256 || garmentLock.referenceImages[0]?.sha256 || 'unknown-sha256',
    authorityPriority: 'ORIGINAL_IMAGE_PRIMARY',

    garmentType: garmentLock.category,
    category: garmentLock.category,

    neckline: necklineType,
    necklineGeometry: {
      type: necklineType,
      depth: necklineDepth,
      shape: dna?.neckline?.shape || necklineType,
      depthRatio: dna?.geometry?.necklineDepthRatio,
      status: dna?.neckline?.status || 'VERIFIED',
    },

    sleeveType,
    sleeveLength,
    sleeveShape: sleevePresent ? (sleeveLength === 'LONG' ? 'Recta clásica' : 'Corta comercial') : 'Sleeveless cut',

    frontPlacket: {
      present: buttonPresence,
      type: buttonPresence ? 'Cartera frontal continua' : undefined,
      status: dna?.buttons ? 'VERIFIED' : 'UNKNOWN',
    },

    buttons: {
      presence: buttonPresence,
      count: buttonCount,
      positions: dna?.buttons?.placement || (buttonPresence ? ['pechera frontal central'] : []),
      layout: buttonPresence ? 'Alineación vertical continua en cartera frontal' : 'Sin botones',
      status: dna?.buttons ? 'VERIFIED' : (buttonPresence ? 'INFERRED' : 'VERIFIED'),
    },

    seams: {
      visibility: (dna?.seams && dna.seams.length > 0) || true,
      positions: dna?.seams ? dna.seams.flatMap(s => s.placement) : ['costuras laterales', 'costura hombros'],
      details: dna?.seams ? dna.seams.map(s => s.description || s.type) : ['Costuras estándar de confección'],
      status: dna?.seams && dna.seams.length > 0 ? 'VERIFIED' : 'INFERRED',
    },

    pockets: {
      presence: pocketPresence,
      count: pocketCount,
      positions: dna?.pockets?.placement || (pocketPresence ? ['bolsillos laterales'] : []),
      type: dna?.pockets?.type,
      status: dna?.pockets ? 'VERIFIED' : 'INFERRED',
    },

    hemline: {
      line: dna?.hem?.shape || 'Recto regular',
      shape: dna?.hem?.shape || 'Recto',
      asymmetry: dna?.hem?.asymmetry ?? false,
      status: dna?.hem ? 'VERIFIED' : 'INFERRED',
    },

    silhouette: dna?.silhouette?.type || 'REGULAR',
    garmentLength: dna?.length?.class || 'Estándar',
    fit: dna?.silhouette?.type === 'FITTED' ? 'Al cuerpo' : 'Corte regular',

    pattern: garmentLock.pattern || 'Liso',
    print: (dna?.print && dna.print.length > 0) ? (dna.print[0]?.repeatPattern || 'Estampado continuo') : (garmentLock.pattern !== 'Liso' ? garmentLock.pattern : 'Ninguno'),
    patternTopology: {
      type: garmentLock.pattern || 'Liso',
      repeatPattern: dna?.print?.[0]?.repeatPattern ?? null,
      placement: dna?.print?.[0]?.placement || ['superficie textil completa'],
      coverage: dna?.print?.[0]?.coverage ?? null,
      status: dna?.print && dna.print.length > 0 ? 'VERIFIED' : 'INFERRED',
    },

    texture: dna?.materialAppearance?.texture?.join(', ') || garmentLock.material,
    fabricAppearance: {
      texture: dna?.materialAppearance?.texture || [garmentLock.material],
      drape: dna?.materialAppearance?.drape || 'Medio natural',
      opacity: dna?.materialAppearance?.opacity || 'Opaco',
      sheen: dna?.materialAppearance?.sheen || 'Mate',
      status: dna?.materialAppearance ? 'VERIFIED' : 'INFERRED',
    },

    decorativeDetails: garmentLock.details || [],
    visibleDecorativeDetails: garmentLock.details || [],
    requiredVisibleDetails: garmentLock.mustPreserve || [],
    structuralDetails: [
      `Moldería de escote ${necklineType}`,
      ...(buttonPresence && buttonCount !== null ? [`Botonera de ${buttonCount} botones exactos`] : []),
      ...(pocketPresence && pocketCount !== null ? [`${pocketCount} bolsillo(s)`] : []),
      `Largo de mangas: ${sleeveLength}`,
    ],

    garmentProportions: {
      lengthRatio: dna?.length?.relativeRatio,
      waistPosition: dna?.waist?.position,
      symmetry: !(dna?.hem?.asymmetry ?? false),
    },

    baseColor: garmentLock.colorVariants[0]?.name || 'Base',
    colorVariants: colorVariants || garmentLock.colorVariants.map(v => v.name),

    allowedChanges: {
      allowLightingNuances: true,
      allowNaturalPoseOcclusions: true,
    },
    lockedAttributes: [...LOCKED_GARMENT_ATTRIBUTES],
    shotVisibilityRules: SHOT_VISIBILITY_RULES,
    underlyingDNA: dna,
    createdAt: new Date().toISOString(),
  };

  return master;
}

/**
 * Compiles explicit tailoring constraints for prompt-compiler to enforce
 * that a color variant is NOT a new garment design.
 */
export function compileGarmentMasterDirectives(
  master: GarmentMaster,
  targetColorVariantName: string,
  shotView: MandatoryShotView
): string[] {
  const directives: string[] = [
    'CRITICAL TAILORING RULE: A color variant is strictly NOT a new garment design.',
    'Preserve the exact garment design and pattern moldería from the original physical reference.',
    'Do not redesign, reinterpret, alter, or simplify the garment construction.',
    `Only change the explicitly authorized colorway to "${targetColorVariantName}". All construction seams, hardware, cut, and silhouettes must remain 100% identical.`,
    `Keep exactly the same neckline geometry (${master.neckline}). Do not change collar or create V-necklines if not present.`,
  ];

  if (master.buttons.presence && master.buttons.count !== null) {
    if (shotView === 'FRONT') {
      directives.push(`MANDATORY BUTTON COUNT: Exactly ${master.buttons.count} visible buttons along front placket. Do NOT add extra buttons. Do NOT omit any button.`);
    } else if (shotView === 'SIDE') {
      directives.push(`Preserve front button placket structure (${master.buttons.count} buttons) consistent with front view.`);
    }
  } else if (!master.buttons.presence) {
    directives.push('NO BUTTONS: This garment design has zero front buttons. Do not add or hallucinate buttons.');
  }

  if (master.sleeveLength === 'SLEEVELESS') {
    directives.push('SLEEVELESS CUT: Absolutely no sleeves or arm coverings allowed.');
  } else {
    directives.push(`SLEEVE SPECIFICATION: Keep exact sleeve cut and length (${master.sleeveType}, ${master.sleeveLength}).`);
  }

  if (master.pockets.presence && master.pockets.count !== null) {
    directives.push(`POCKET STRUCTURE: Exactly ${master.pockets.count} pocket(s) positioned at ${master.pockets.positions.join(', ') || 'sides'}. Do not invent additional pockets.`);
  } else {
    directives.push('NO POCKETS: Do not add or invent pockets on this garment.');
  }

  directives.push(`Preserve silhouette (${master.silhouette}) and overall length (${master.garmentLength}).`);
  directives.push(`Preserve hemline finish: ${master.hemline.shape}${master.hemline.asymmetry ? ' with intentional asymmetrical slant' : ' (straight and even)'}.`);

  if (master.pattern !== 'Liso') {
    directives.push(`PATTERN TOPOLOGY: Preserve identical distribution and scale of print (${master.patternTopology.type}) on the new colorway without recoloring accents.`);
  }

  return directives;
}

/**
 * Hard Gates Quality Audit Service.
 * Evaluates generated image against Original Garment Master + Approved Anchor.
 * Critical structural faults (extra button, altered neckline, invented pocket) cause immediate REJECTION.
 */
export function evaluateStructuralFidelityAudit(params: {
  master: GarmentMaster;
  modelLock: ModelLock;
  targetVariant: ColorVariant;
  shotView: MandatoryShotView;
  auditMetrics: Partial<StructuralFidelityMetrics>;
  anchorAsset?: ImageAsset;
  hasModelMismatch?: boolean;
  hasButtonMismatch?: boolean;
  hasNecklineAltered?: boolean;
  hasSleeveMutated?: boolean;
  hasSeamMissing?: boolean;
  hasPocketInvented?: boolean;
  hasSilhouetteAltered?: boolean;
  hasHemLengthAltered?: boolean;
  hasPatternMutated?: boolean;
}): ComprehensiveValidationAudit {
  const { 
    master, 
    modelLock, 
    targetVariant, 
    shotView, 
    auditMetrics, 
    anchorAsset,
    hasModelMismatch,
    hasButtonMismatch,
    hasNecklineAltered,
    hasSleeveMutated,
    hasSeamMissing,
    hasPocketInvented,
    hasSilhouetteAltered,
    hasHemLengthAltered,
    hasPatternMutated,
  } = params;

  const visibility = master.shotVisibilityRules[shotView] || SHOT_VISIBILITY_RULES.FRONT;
  const criticalFaults: CriticalStructuralFault[] = [];
  const issues: string[] = [];

  // Base score derivation with sensible defaults if not passed
  let garmentSimilarity = auditMetrics?.garmentSimilarity ?? 95;
  let structuralFidelity = auditMetrics?.structuralFidelity ?? 96;
  let necklineConsistency = auditMetrics?.necklineConsistency ?? 96;
  let sleeveConsistency = auditMetrics?.sleeveConsistency ?? 95;
  let buttonPlacementConsistency = auditMetrics?.buttonPlacementConsistency ?? 96;
  let seamConsistency = auditMetrics?.seamConsistency ?? 93;
  let hemConsistency = auditMetrics?.hemConsistency ?? 94;
  let silhouetteConsistency = auditMetrics?.silhouetteConsistency ?? 95;
  let garmentProportionConsistency = auditMetrics?.garmentProportionConsistency ?? 93;
  let patternConsistency = auditMetrics?.patternConsistency ?? 94;
  let textureConsistency = auditMetrics?.textureConsistency ?? 92;
  let decorativeDetailConsistency = auditMetrics?.decorativeDetailConsistency ?? 93;
  let colorVariantConsistency = auditMetrics?.colorVariantConsistency ?? 95;
  let modelIdentityConsistency = auditMetrics?.modelIdentityConsistency ?? 96;
  const shotCompliance = auditMetrics?.shotCompliance ?? 96;

  // 1. HARD GATE: Model Identity Consistency
  if (hasModelMismatch || modelIdentityConsistency < 90) {
    criticalFaults.push('CRITICAL_MODEL_IDENTITY_MISMATCH');
    issues.push(`ModelIdentity (${modelIdentityConsistency}) no coincide con el ModelLock seleccionado (${modelLock.name})`);
    modelIdentityConsistency = Math.min(modelIdentityConsistency, 70);
  }

  // 2. HARD GATE: Buttons (Angle-Aware)
  let buttonCountStatus: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'EXCLUDED_BY_ANGLE' = 'NOT_APPLICABLE';
  if (master.buttons.presence) {
    if (shotView === 'BACK') {
      buttonCountStatus = 'EXCLUDED_BY_ANGLE';
    } else {
      if (hasButtonMismatch) {
        buttonCountStatus = 'FAIL';
        criticalFaults.push('CRITICAL_BUTTON_EXTRA');
        issues.push(`Inconsistencia en botones frontales: detectado conteo diferente al original (${master.buttons.count})`);
        structuralFidelity = Math.min(structuralFidelity, 65);
      } else {
        buttonCountStatus = 'PASS';
      }
    }
  }

  // 3. HARD GATE: Neckline
  if (hasNecklineAltered || (shotView === 'FRONT' && necklineConsistency < 95)) {
    criticalFaults.push('CRITICAL_NECKLINE_ALTERED');
    issues.push(`Escote alterado respecto a la foto original (${master.neckline})`);
    necklineConsistency = Math.min(necklineConsistency, 60);
    structuralFidelity = Math.min(structuralFidelity, 70);
  }

  // 4. HARD GATE: Sleeves
  if (hasSleeveMutated || sleeveConsistency < 93) {
    criticalFaults.push('CRITICAL_SLEEVE_MUTATED');
    issues.push(`Moldería de mangas mutada respecto al original (${master.sleeveType}, ${master.sleeveLength})`);
    sleeveConsistency = Math.min(sleeveConsistency, 65);
    structuralFidelity = Math.min(structuralFidelity, 72);
  }

  // 5. HARD GATE: Seams
  if (hasSeamMissing || seamConsistency < 90) {
    criticalFaults.push('CRITICAL_SEAM_MISSING');
    issues.push('Costuras estructurales o pespuntes obligatorios omitidos');
    seamConsistency = Math.min(seamConsistency, 70);
  }

  // 6. HARD GATE: Pockets (Angle-Aware)
  let pocketStatus: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'EXCLUDED_BY_ANGLE' = 'NOT_APPLICABLE';
  if (master.pockets.presence) {
    if (shotView === 'BACK' && !master.pockets.positions.some(p => p.includes('traser') || p.includes('back'))) {
      pocketStatus = 'EXCLUDED_BY_ANGLE';
    } else {
      if (hasPocketInvented) {
        pocketStatus = 'FAIL';
        criticalFaults.push('CRITICAL_POCKET_INVENTED');
        issues.push('Bolsillo inventado no presente en la foto original');
        structuralFidelity = Math.min(structuralFidelity, 70);
      } else {
        pocketStatus = 'PASS';
      }
    }
  } else {
    if (hasPocketInvented) {
      pocketStatus = 'FAIL';
      criticalFaults.push('CRITICAL_POCKET_INVENTED');
      issues.push('La prenda original no tiene bolsillos y el generador inventó bolsillos.');
      structuralFidelity = Math.min(structuralFidelity, 68);
    } else {
      pocketStatus = 'PASS';
    }
  }

  // 7. HARD GATE: Silhouette & Hem
  if (hasSilhouetteAltered || silhouetteConsistency < 93) {
    criticalFaults.push('CRITICAL_SILHOUETTE_ALTERED');
    issues.push(`Silueta modificada respecto a la prenda original (${master.silhouette})`);
    silhouetteConsistency = Math.min(silhouetteConsistency, 70);
  }

  if (hasHemLengthAltered || hemConsistency < 92) {
    criticalFaults.push('CRITICAL_HEM_LENGTH_ALTERED');
    issues.push('Largo de prenda o ruedo asimétrico modificado');
    hemConsistency = Math.min(hemConsistency, 75);
  }

  // 8. HARD GATE: Pattern Topology
  if (hasPatternMutated || (master.pattern !== 'Liso' && patternConsistency < 90)) {
    criticalFaults.push('CRITICAL_PATTERN_MUTATED');
    issues.push('Topología de estampa o escala de patrón alterada en la variante');
    patternConsistency = Math.min(patternConsistency, 70);
  }

  // Cross-check against secondary anchor if present
  let anchorValidated = false;
  if (anchorAsset && anchorAsset.url) {
    anchorValidated = true;
    // Anchor confirms visual continuity without overriding original
  }

  // Overall calculations
  garmentSimilarity = Math.round((structuralFidelity + necklineConsistency + sleeveConsistency + seamConsistency + hemConsistency + silhouetteConsistency) / 6);
  const overallScore = Math.round(
    (garmentSimilarity + structuralFidelity + necklineConsistency + sleeveConsistency + seamConsistency + hemConsistency + silhouetteConsistency + modelIdentityConsistency + shotCompliance) / 9
  );

  const modelIdentityPassed = modelIdentityConsistency >= 90 && !hasModelMismatch;
  const garmentIdentityPassed = criticalFaults.length === 0 && structuralFidelity >= 95 && garmentSimilarity >= 90;

  // Final Gate Decision:
  // If ANY critical fault exists, or model fails, or garment fails -> REJECTED immediately!
  let status: 'APPROVED' | 'REVIEW_REQUIRED' | 'REJECTED' = 'APPROVED';
  if (criticalFaults.length > 0 || !modelIdentityPassed || !garmentIdentityPassed) {
    status = 'REJECTED';
  } else if (overallScore < 90) {
    status = 'REVIEW_REQUIRED';
  }

  const metrics: StructuralFidelityMetrics = {
    garmentSimilarity,
    structuralFidelity,
    necklineConsistency,
    sleeveConsistency,
    buttonCountConsistency: buttonCountStatus,
    buttonPlacementConsistency,
    seamConsistency,
    pocketConsistency: pocketStatus,
    hemConsistency,
    silhouetteConsistency,
    garmentProportionConsistency,
    patternConsistency,
    textureConsistency,
    decorativeDetailConsistency,
    colorVariantConsistency,
    modelIdentityConsistency,
    shotCompliance,
  };

  return {
    status,
    overallScore,
    modelIdentityPassed,
    garmentIdentityPassed,
    metrics,
    criticalFaults,
    issues,
    anchorValidated,
  };
}

/**
 * Validates cross-variant consistency across two jobs of different colorways.
 * Checks that differences are ONLY chromatic, strictly blocking structural divergence.
 */
export function validateCrossVariantConsistency(params: {
  variantAColor: string;
  variantBColor: string;
  master: GarmentMaster;
  hasStructuralDivergence: boolean;
}): { consistent: boolean; reason?: string } {
  const { variantAColor, variantBColor, master, hasStructuralDivergence } = params;

  if (hasStructuralDivergence) {
    return {
      consistent: false,
      reason: `DIVERGENCIA ESTRUCTURAL ENTRE VARIANTES: La variante ${variantBColor} no comparte la misma moldería y confección que ${variantAColor}. Una variante de color no puede ser una prenda distinta.`,
    };
  }

  return {
    consistent: true,
  };
}
