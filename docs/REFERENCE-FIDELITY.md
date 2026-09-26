# Reference Fidelity, Coverage & Hard Gates — Catalog AI

## Overview
Catalog AI establishes a clear technical boundary between **what is genuinely verified by reference photography** and **what is inferred by generative AI**. 

A single frontal reference photograph cannot guarantee the real design of rear seams, buttons, or back closures. Rather than falsely reporting 96% verified fidelity on unseen features, Catalog AI audits coverage and enforces hard gates.

---

## 1. Reference Coverage Model

Every garment production analyzes the uploaded reference assets to determine:

```typescript
export interface ReferenceCoverage {
  front: CoverageStatus;        // VERIFIED | PARTIAL | INFERRED | UNKNOWN
  side: CoverageStatus;         // VERIFIED | PARTIAL | INFERRED | UNKNOWN
  back: CoverageStatus;         // VERIFIED | PARTIAL | INFERRED | UNKNOWN
  details: CoverageStatus;      // VERIFIED | PARTIAL | INFERRED | UNKNOWN
  colors: CoverageStatus;       // VERIFIED | PARTIAL | INFERRED | UNKNOWN
  pattern: CoverageStatus;      // VERIFIED | PARTIAL | INFERRED | UNKNOWN
  construction: CoverageStatus; // VERIFIED | PARTIAL | INFERRED | UNKNOWN
}
```

### Coverage States:
1. **`VERIFIED`**: Directly visible and documented in one or more high-resolution reference photographs.
2. **`PARTIAL`**: Visible from an angle, oblique perspective, or partially occluded.
3. **`INFERRED`**: Inferred by AI using fashion moldería principles and standard construction rules for the category.
4. **`UNKNOWN`**: No photographic evidence provided.

---

## 2. Classification of Generated Shots

| Shot Angle | Reference Evidence | Generated Classification | Audit Status |
| :--- | :--- | :--- | :--- |
| **FRONT** | Front photograph present | `REFERENCE_VERIFIED` | Full audit on neckline, sleeves, pockets |
| **BACK** | Rear photograph present | `REFERENCE_VERIFIED` | Full audit on rear closures, zippers, seams |
| **BACK** | Frontal photograph ONLY | `AI_INFERRED` | `BackConstructionFidelity = NOT_VERIFIABLE` |
| **SIDE** | Lateral profile present | `REFERENCE_VERIFIED` | Profile contour verified |
| **SIDE** | Frontal photograph ONLY | `AI_INFERRED` | Profile inferred from drape physics |
| **ACTION** | Front/dynamic present | `REFERENCE_VERIFIED` | Kinetic posture verified |

> **Critical Rule**: A metric marked `NOT_VERIFIABLE` is **never awarded 100%** nor converted to a false `PASS`.

---

## 3. Validation Hard Gates (`ValidationPolicy`)

Approval is **never determined solely by global average score**. A generated image might achieve 98% in model consistency and photorealism but fail to accurately reproduce the product's color or cut.

### Standard Enterprise Policy:
```typescript
export const DEFAULT_VALIDATION_POLICY: ValidationPolicy = {
  minGarmentIdentityScore: 90,     // Hard Gate 1
  minColorAccuracyScore: 90,       // Hard Gate 2
  minShotAccuracyScore: 90,        // Hard Gate 3
  minModelIdentityScore: 88,       // Hard Gate 4
  minPatternScoreIfVerified: 88,   // Hard Gate 5 (when pattern is VERIFIED)
  minDetailScoreIfVerified: 85,    // Hard Gate 6 (when details are VERIFIED)
};
```

### Decision Pipeline:
```
           Generated Image Asset
                     │
                     ▼
          Validation Metric Audit
                     │
         ¿Falla algún Hard Gate?
         │                     │
        SÍ                    NO
         │                     │
     REJECTED           ¿Overall >= 90?
(Independiente de       │             │
  Overall Score)       SÍ            NO
                        │             │
                    APPROVED    REVIEW_REQUIRED
```

---

## 4. Visual Color Reference Locks
Color variants in Catalog AI are backed by visual cropped assets, not just hex strings:
- `referenceAssets[]`: High-resolution visual crops of the specific colorway from the reference image.
- `referenceCrop`: Direct visual evidence preserving floral/embroidery accents.
- `confidence`: Visual detection confidence score.
- `patternDescription`: Nuanced description preventing recoloring of prints.

---

## 5. Formal ShotContracts
Both the `PromptCompiler` and `ValidationPipeline` are driven by formal contracts:
- **FRONT**: `bodyOrientation = FRONT`, `gaze = CAMERA`.
- **SIDE**: `bodyOrientation = SIDE`, `headOrientation = DIRECT_CAMERA`, `gaze = CAMERA`.
- **BACK**: `bodyOrientation = BACK`, `headOrientation = OVER_SHOULDER_TO_CAMERA`, `gaze = CAMERA`.
- **ACTION**: `movement = REQUIRED`, `gaze = CAMERA`.

---

## 6. Global Production Pose Memory (`ProductionPoseHistory`)
Prevents pose cloning across:
- **Intra-set shots**: FRONT, SIDE, BACK, ACTION are distinct postures.
- **Cross-color variants**: Negro, Bordó, Beige in FRONT view share brand direction but introduce natural micro-variations in arm and leg posture, avoiding identical synthetic clones.
