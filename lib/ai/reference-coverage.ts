import { ImageAsset, ReferenceCoverage, CoverageStatus } from '@/types';

/**
 * Computes ReferenceCoverage from reference images.
 * Determines which garment aspects are genuinely backed by reference photography
 * vs which ones must be AI inferred.
 */
export function computeReferenceCoverage(referenceImages: ImageAsset[]): ReferenceCoverage {
  const fileNames = referenceImages.map((img) => (img.name || '').toLowerCase() + ' ' + (img.url || '').toLowerCase());
  const combinedText = fileNames.join(' ');

  // Front check
  const hasFront = combinedText.includes('front') || combinedText.includes('frente') || referenceImages.length >= 1;
  const frontStatus: CoverageStatus = hasFront ? 'VERIFIED' : 'UNKNOWN';

  // Back check: ONLY verified if there is explicit rear/back image evidence
  const hasExplicitBack = combinedText.includes('back') || combinedText.includes('espalda') || combinedText.includes('trasera') || combinedText.includes('posterior');
  const backStatus: CoverageStatus = hasExplicitBack ? 'VERIFIED' : 'UNKNOWN';

  // Side check
  const hasExplicitSide = combinedText.includes('side') || combinedText.includes('perfil') || combinedText.includes('costado') || combinedText.includes('lateral');
  const sideStatus: CoverageStatus = hasExplicitSide ? 'VERIFIED' : (hasFront ? 'INFERRED' : 'UNKNOWN');

  // Details check
  const hasExplicitDetail = combinedText.includes('detail') || combinedText.includes('detalle') || combinedText.includes('macro') || combinedText.includes('close');
  const detailsStatus: CoverageStatus = hasExplicitDetail ? 'VERIFIED' : (referenceImages.length >= 2 ? 'PARTIAL' : 'INFERRED');

  // Colors check
  const colorsStatus: CoverageStatus = referenceImages.length >= 1 ? 'VERIFIED' : 'UNKNOWN';

  // Pattern check
  const patternStatus: CoverageStatus = referenceImages.length >= 1 ? 'VERIFIED' : 'UNKNOWN';

  // Construction check
  const constructionStatus: CoverageStatus = (hasFront && hasExplicitBack) 
    ? 'VERIFIED' 
    : (hasFront ? 'PARTIAL' : 'UNKNOWN');

  return {
    front: frontStatus,
    side: sideStatus,
    back: backStatus,
    details: detailsStatus,
    colors: colorsStatus,
    pattern: patternStatus,
    construction: constructionStatus,
  };
}

/**
 * Checks if a specific shot view has verified reference coverage.
 */
export function getShotReferenceStatus(
  view: 'FRONT' | 'SIDE' | 'BACK' | 'ACTION',
  coverage?: ReferenceCoverage
): 'REFERENCE_VERIFIED' | 'AI_INFERRED' {
  if (!coverage) return 'AI_INFERRED';

  if (view === 'FRONT' && coverage.front === 'VERIFIED') {
    return 'REFERENCE_VERIFIED';
  }
  if (view === 'BACK' && coverage.back === 'VERIFIED') {
    return 'REFERENCE_VERIFIED';
  }
  if (view === 'SIDE' && coverage.side === 'VERIFIED') {
    return 'REFERENCE_VERIFIED';
  }
  if (view === 'ACTION' && coverage.front === 'VERIFIED') {
    return 'REFERENCE_VERIFIED';
  }

  return 'AI_INFERRED';
}
