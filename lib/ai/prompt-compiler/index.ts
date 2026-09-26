import { 
  GenerationRequest, 
  MandatoryShotView, 
  ProductionStyle
} from '@/types';
import { getShotContract } from '../shot-contracts';

export interface CompiledPrompt {
  productIdentity: string[];
  colorVariantDirectives: string[];
  modelIdentity: string[];
  shotDirection: string;
  poseDirection: string;
  cameraLookRule: string;
  camera: string;
  lighting: string;
  background: string;
  composition: string;
  previousPosesAvoidance: string[];
  mustPreserve: string[];
  mustNotChange: string[];
  rawCombinedPrompt: string;
}

const PRODUCTION_STYLE_SPECIFICATIONS: Record<
  ProductionStyle,
  {
    name: string;
    lighting: string;
    background: string;
    composition: string;
  }
> = {
  STUDIO_WHITE: {
    name: 'Mercado Libre / E-commerce Studio White',
    lighting: 'High-CRI uniform softbox studio illumination, balanced 5500K neutral light, zero harsh shadows, true-to-life textile rendering',
    background: 'Pure clean white seamless cyclorama studio background (#FFFFFF). No furniture, no props, no decor, no text, no watermark, product is absolute protagonist',
    composition: 'Clean commercial e-commerce centered framing, full-body product-focused composition, zero distractions, optimal for online marketplace catalog',
  },
  EDITORIAL_CATALOG: {
    name: 'Premium Fashion Editorial Catalog',
    lighting: 'Sophisticated commercial editorial lighting, soft directional fill, subtle warm rim light enhancing fabric textures and silhouette contours',
    background: 'Elegant minimalist architectural atmosphere: muted travertine, polished stone, or refined warm contemporary interior. Soft out-of-focus background that does not compete with the garment',
    composition: 'High-end lookbook framing, harmonious negative space, editorial styling and premium atmosphere with garment remaining the central hero',
  },
};

const SHOT_CAMERA_DIRECTIVES: Record<MandatoryShotView, string> = {
  FRONT: 'Full-body front perspective fashion photography, eye-level, 85mm lens, sharp focus on garment silhouette and textile',
  SIDE: 'Full-body true lateral side profile fashion photography, 85mm lens, high depth of field on side seams, waistline, and drape volume',
  BACK: 'Full-body rear view fashion photography, 85mm lens, pristine focus on back construction, rear closures, straps, and back draping. Authentic rear view, NOT 3/4 angle',
  ACTION: 'Full-length dynamic commercial fashion photography, high shutter speed, capturing fluid motion without motion blur',
};

/**
 * Compiles a structured, provider-independent prompt for a specific ColorVariant and canonical ShotView.
 * Strictly enforces:
 * 1. Absolute Garment Lock fidelity (mustPreserve rules cannot be omitted).
 * 2. Color Variant fidelity with visual reference evidence (nuanced tone and print distribution).
 * 3. Formal ShotContract constraints (orientation, head turn, and mandatory eye contact).
 * 4. ProductionPoseHistory & cross-variant anti-cloning pose memory.
 * 5. Studio White vs Editorial Catalog production profiles.
 */
export function compileGenerationPrompt(request: GenerationRequest): CompiledPrompt {
  const { 
    garmentLock, 
    colorVariant, 
    modelLock, 
    productionStyle, 
    shotView, 
    poseHistory, 
    productionPoseHistory, 
    constraints 
  } = request;

  // Retrieve formal ShotContract
  const contract = request.shotContract || getShotContract(shotView);

  // 1. PRODUCT IDENTITY
  const productIdentity: string[] = [
    `garment category: ${garmentLock.category}`,
    `construction material: ${garmentLock.material}`,
    `overall pattern structure: ${garmentLock.pattern}`,
    `pockets: ${garmentLock.pockets ? 'functional visible pockets included' : 'no pockets'}`,
    ...garmentLock.details.map((d) => `structural detail: ${d}`),
  ];

  // 2. COLOR VARIANT DIRECTIVES (Visual Evidence First)
  const colorVariantDirectives: string[] = [
    `target color variant: ${colorVariant.name}`,
    `detected color tone: ${colorVariant.detectedColor}`,
    `nuanced color description: ${colorVariant.colorDescription}`,
    `primary hex tonal hint: ${colorVariant.approximateHex}`,
    colorVariant.patternDistribution
      ? `pattern print distribution: ${colorVariant.patternDistribution}`
      : 'preserve exact print scale and contrast on this colorway without recoloring accents',
  ];

  if (colorVariant.referenceAssets && colorVariant.referenceAssets.length > 0) {
    colorVariantDirectives.push(`visual reference evidence attached: ${colorVariant.referenceAssets.length} cropped assets providing exact shade`);
  }

  // 3. MODEL IDENTITY
  const modelIdentity: string[] = [
    `consistent model identity: ${modelLock.name}`,
    `gender: ${modelLock.gender}`,
    `apparent age: ${modelLock.apparentAge}`,
    `body type & proportions: ${modelLock.bodyType}`,
    `skin tone: ${modelLock.skinTone}`,
    `hair features: ${modelLock.hairColor}, ${modelLock.hairLength}, ${modelLock.hairStyle}`,
    'identical facial features, eye color, and makeup across all shots',
  ];

  // 4. SHOT DIRECTION & FORMAL SHOT CONTRACT
  const cameraDirective = SHOT_CAMERA_DIRECTIVES[shotView];
  const styleSpec = PRODUCTION_STYLE_SPECIFICATIONS[productionStyle] || PRODUCTION_STYLE_SPECIFICATIONS.STUDIO_WHITE;

  const shotDirection = `Mandatory Shot Contract: ${shotView}. Body orientation: ${contract.bodyOrientation}. Head orientation: ${contract.headOrientation}. Camera Gaze: ${contract.gaze}. Key aspects to feature: ${contract.focusAspects.join(', ')}.`;

  let poseRule = '';
  let headAndLookRule = '';

  if (shotView === 'FRONT') {
    poseRule = 'Natural front-facing posture. Model standing naturally, arms relaxed or gently positioned, weight balanced without obscuring garment details.';
    headAndLookRule = 'Head facing directly forward. Model MUST look directly into the camera lens with engaging commercial gaze.';
  } else if (shotView === 'SIDE') {
    poseRule = 'Authentic side profile view showing silhouette depth, fabric fall, and side contours. Arms placed away from body outline to keep silhouette visible.';
    headAndLookRule = 'Body is in true lateral profile, BUT head and neck are rotated naturally toward camera. Model MUST look directly into the camera lens.';
  } else if (shotView === 'BACK') {
    poseRule = 'Torso facing directly away from camera in a clean rear posture. Torso must show full back construction, zippers, and straps. NOT a 3/4 frontal view.';
    headAndLookRule = 'Head turned gently and naturally over the shoulder toward camera. Model MUST look directly into the camera lens with clear eye contact.';
  } else {
    // ACTION
    poseRule = 'Dynamic kinetic posture with fluid motion (natural walking stride or gentle turning posture). Arms held freely with natural hand gesture, weight dynamically distributed.';
    headAndLookRule = 'Head held naturally with eye contact locked onto camera. Model MUST look directly into the camera lens.';
  }

  // 5. POSE HISTORY AVOIDANCE (Local Set + Global Production History)
  const previousPosesAvoidance: string[] = [];
  
  if (poseHistory && poseHistory.length > 0) {
    previousPosesAvoidance.push(
      'DO NOT REPEAT previous poses in this set. Vary limb placement, foot positions, torso angle, and arm gestures.',
      ...poseHistory.map((p, i) => `Previous Shot #${i + 1} (${p.shotView}): body oriented ${p.bodyOrientation}, left arm ${p.leftArm}, right arm ${p.rightArm}, weight on ${p.weightDistribution}`)
    );
  }

  // Cross-variant anti-cloning directives from ProductionPoseHistory
  if (productionPoseHistory && productionPoseHistory.poses.length > 0) {
    const sameShotOtherVariants = productionPoseHistory.poses.filter(
      (p) => p.shotView === shotView && p.colorVariantId !== colorVariant.id
    );
    if (sameShotOtherVariants.length > 0) {
      previousPosesAvoidance.push(
        `CROSS-COLOR ANTI-CLONING: Avoid generating an identical clone of other color variants in ${shotView} view. Maintain shared photographic direction but introduce natural micro-variations in arm angle, hand positioning, and subtle torso tilt.`
      );
    }
  }

  // 6. MUST PRESERVE RULES (Inviolable)
  const mustPreserve: string[] = [
    ...garmentLock.mustPreserve.map((rule) => `EXACT PRESERVATION: ${rule}`),
    `preserve exact color balance of ${colorVariant.name} (${colorVariant.colorDescription})`,
    'preserve authentic textile drape, fabric weight, and hemline drop',
  ];

  if (constraints && constraints.length > 0) {
    mustPreserve.push(...constraints.map((c) => `specific constraint: ${c}`));
  }

  // 7. MUST NOT CHANGE RULES
  const mustNotChange: string[] = [
    'do not alter garment cut, neckline, sleeve length, or pocket placement',
    'do not recolor accents or floral embroidery arbitrarily',
    'do not change model facial features or body proportions',
    'do not create fake 3/4 poses when back or side is requested',
    'do not allow model to look away from camera; eye contact is mandatory in all shots',
    'do not add extra garments, jackets, unauthorized jewelry, or background clutter',
  ];

  const rawCombinedPrompt = [
    `[PRODUCTION STYLE]: ${styleSpec.name}`,
    `[PRODUCT IDENTITY]: ${productIdentity.join('; ')}`,
    `[COLOR VARIANT]: ${colorVariantDirectives.join('; ')}`,
    `[MODEL IDENTITY]: ${modelIdentity.join('; ')}`,
    `[SHOT CONTRACT]: ${shotDirection}`,
    `[CAMERA & ANGLE]: ${cameraDirective}`,
    `[POSE DIRECTION]: ${poseRule}`,
    `[MANDATORY LOOK RULE]: ${headAndLookRule}`,
    `[LIGHTING]: ${styleSpec.lighting}`,
    `[BACKGROUND]: ${styleSpec.background}`,
    `[COMPOSITION]: ${styleSpec.composition}`,
    previousPosesAvoidance.length > 0 ? `[PREVIOUS POSES TO AVOID]:\n${previousPosesAvoidance.join('\n')}` : null,
    `[MUST PRESERVE]:\n- ${mustPreserve.join('\n- ')}`,
    `[MUST NOT CHANGE]:\n- ${mustNotChange.join('\n- ')}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    productIdentity,
    colorVariantDirectives,
    modelIdentity,
    shotDirection,
    poseDirection: poseRule,
    cameraLookRule: headAndLookRule,
    camera: cameraDirective,
    lighting: styleSpec.lighting,
    background: styleSpec.background,
    composition: styleSpec.composition,
    previousPosesAvoidance,
    mustPreserve,
    mustNotChange,
    rawCombinedPrompt,
  };
}
