# Photo Production Pipeline — Catalog AI

## Overview
Catalog AI replaces manual prompt iteration with a deterministic, multi-package production pipeline for fashion commerce. The system processes a reference photograph containing **one garment and multiple color variants** to automatically produce two complete photographic collections:

1. **E-COMMERCE / MERCADO LIBRE (`STUDIO_WHITE`)**
2. **CATÁLOGO PREMIUM (`EDITORIAL_CATALOG`)**

---

## Production Hierarchy & Domain Structure

```
GARMENT
   │
   ├── GarmentLock (Design, fabric, cut, sleeves, neckline, pockets, embroidery, print distribution)
   │
   ├── ModelLock (Facial features, apparent age, skin tone, hair, proportions, makeup)
   │
   └── ColorVariants[]
          │
          ├── NEGRO
          │     ├── STUDIO_WHITE (Front, Side, Back, Action)
          │     └── EDITORIAL_CATALOG (Front, Side, Back, Action)
          │
          ├── BORDÓ
          │     ├── STUDIO_WHITE (Front, Side, Back, Action)
          │     └── EDITORIAL_CATALOG (Front, Side, Back, Action)
          │
          └── ... (N Variants)
```

---

## Production Matrix Formula

$$\text{Total Photos} = N_{\text{variants}} \times 4_{\text{shots}} \times 2_{\text{packages}}$$

- **1 Color**: $1 \times 4 \times 2 = 8\text{ photos}$
- **3 Colors**: $3 \times 4 \times 2 = 24\text{ photos}$
- **6 Colors**: $6 \times 4 \times 2 = 48\text{ photos}$

---

## Canonical 4 Shots per Color per Style

Every active color variant produces exactly 4 distinct photographic assets per production style:

| Shot View | Camera & Body Angle | Gaze Rule | Product Visibility Focus |
| :--- | :--- | :--- | :--- |
| **01 — FRONT** | Direct front view | Direct eye contact to camera | Full frontal design, neckline, sleeves, pockets, waist cut |
| **02 — SIDE** | True lateral profile | Head turned naturally to camera | Silhouette, volume, fabric drape, waist seam, lateral length |
| **03 — BACK** | True rear orientation | Head turned naturally over shoulder to camera | Full rear construction, zippers, back straps, rear print |
| **04 — ACTION** | Dynamic natural movement | Direct eye contact to camera | Fluid posture, different limbs/weight distribution, unobstructed garment |

> **Mandatory Camera Gaze Rule**: Across all 4 shots (Front, Side, Back, Action), the model must look directly into the camera lens with a natural neck/head posture.

---

## Production Profiles

### 1. `STUDIO_WHITE` (Mercado Libre / Marketplace)
- **Background**: Pure white `#FFFFFF` studio cyclorama.
- **Lighting**: Uniform, diffuse softbox commercial studio lighting.
- **Props & Distractions**: Zero furniture, zero text, zero watermarks, zero props.
- **Protagonist**: Garment as the absolute focal point.

### 2. `EDITORIAL_CATALOG` (High-End Lookbook)
- **Background**: Refined architectural space, warm travertine textures, minimalist luxury interior.
- **Lighting**: Soft cinematic daylight with subtle directional key light.
- **Art Direction**: Commercial fashion catalog elegance without background clutter competing with the garment.

---

## Pose Memory & Anti-Cloning Engine
The system registers a `PoseDescriptor` for each shot:
- `bodyOrientation`, `headOrientation`, `leftArm`, `rightArm`, `leftLeg`, `rightLeg`, `weightDistribution`, `expression`.
- The `PromptCompiler` receives `PoseHistory[]` and explicitly injects negative constraints:
  `"DO NOT duplicate previous body postures. Vary arm placement, leg angles, and weight distribution."`

---

## Multi-Factor Validation Pipeline & Hard Gates
Before approval, each asset is audited against:
1. `GarmentIdentityScore` (Cut, fabric, silhouette preservation $\ge 90\%$)
2. `ColorAccuracyScore` (Preserves true hue without altering prints $\ge 90\%$)
3. `ShotAccuracyScore` (Adherence to formal ShotContract $\ge 90\%$)
4. `ModelIdentityScore` (Face, hair, skin consistency $\ge 88\%$)
5. `PatternScore` (Print scale and alignment $\ge 88\%$ when verified)
6. `DetailScore` (Seams, buttons, zippers, trims $\ge 85\%$ when verified)
7. `ShapeScore` (Proportions and anatomy)
8. `PoseDiversityScore` (Ensures gesture uniqueness)

### Hard Gate Enforcement:
Approval is **never granted by global average alone**. If any critical Hard Gate fails, the status is immediately set to `REJECTED`, even if `overallScore` is $\ge 90\%$.

- Automatic Approval: $\ge 90\%$ AND all hard gates passed (`APPROVED`).
- Review Required: $75\% - 89\%$ (`REVIEW_REQUIRED`).
- Below Threshold or Failed Hard Gate: (`REJECTED`).
- Unseen Features (e.g. Back without rear photo): marked `AI_INFERRED` and `NOT_VERIFIABLE`, avoiding false guarantees.
