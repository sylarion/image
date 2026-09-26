import { MandatoryShotView, ShotContract } from '@/types';

/**
 * Formal ShotContracts for Catalog AI.
 * Participates directly in both PromptCompiler and ValidationPipeline.
 * Ensures:
 * - FRONT: Body front, direct camera gaze.
 * - SIDE: Body side, head turned naturally, camera gaze.
 * - BACK: Torso authentically facing away, head turned over shoulder, camera gaze.
 * - ACTION: Dynamic kinetic movement required, camera gaze.
 */
export const SHOT_CONTRACTS: Record<MandatoryShotView, ShotContract> = {
  FRONT: {
    view: 'FRONT',
    bodyOrientation: 'FRONT',
    headOrientation: 'DIRECT_CAMERA',
    gaze: 'CAMERA',
    movement: 'OPTIONAL',
    focusAspects: [
      'true frontal construction',
      'full neckline and collar structure',
      'sleeve attachment and silhouette',
      'front pockets and waist seams',
      'hemline fall and proportions',
    ],
    requiresReference: 'FRONT',
  },
  SIDE: {
    view: 'SIDE',
    bodyOrientation: 'SIDE',
    headOrientation: 'DIRECT_CAMERA',
    gaze: 'CAMERA',
    movement: 'OPTIONAL',
    focusAspects: [
      'true lateral side profile',
      'drape volume and contour depth',
      'side seams and profile silhouette',
      'lateral sleeve fall',
      'lateral waist shape',
    ],
    requiresReference: 'SIDE',
  },
  BACK: {
    view: 'BACK',
    bodyOrientation: 'BACK',
    headOrientation: 'OVER_SHOULDER_TO_CAMERA',
    gaze: 'CAMERA',
    movement: 'NONE',
    focusAspects: [
      'authentic rear construction',
      'back neckline depth and closures',
      'rear zippers, ties, or buttons',
      'back shoulder seam architecture',
      'rear fabric fall and bottom hem',
    ],
    requiresReference: 'BACK',
  },
  ACTION: {
    view: 'ACTION',
    bodyOrientation: 'FRONT',
    headOrientation: 'DIRECT_CAMERA',
    gaze: 'CAMERA',
    movement: 'REQUIRED',
    focusAspects: [
      'fluid kinetic body posture',
      'natural fabric flow in motion',
      'unoccluded product presentation',
      'distinct arm and leg dynamics',
    ],
    requiresReference: 'ANY',
  },
};

/**
 * Returns the ShotContract for a specific MandatoryShotView.
 */
export function getShotContract(view: MandatoryShotView): ShotContract {
  return SHOT_CONTRACTS[view];
}
