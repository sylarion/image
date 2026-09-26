# REAL AI — Phase 1: Vertical Slice & Provider Evaluation

## Overview
Catalog AI Phase 1 enables real multimodal analysis and diffusion image generation while strictly maintaining domain contracts, reference coverage tracking, and hard gate validation.

Rather than committing prematurely to a single diffusion model as the permanent winner, Phase 1 establishes an experimental comparative bake-off between candidate architectures on Fal.ai:

1. **`fal-ai/flux-pro/v1/vto`** (FLUX Pro Virtual Try-On)
2. **`fal-ai/flux-2-lora-gallery/virtual-tryon`** (FLUX.2 Fashion Try-On)

Both candidates run under identical prompts compiled by `PromptCompiler` and are audited by **Google Gemini** multimodal vision using our enterprise `ValidationPolicy`.

---

## Architecture & Sub-Adapters

```
                        Input Reference Images
                                 │
                                 ▼
                     GeminiGarmentAnalyzer
                (Google Gemini 2.5/3.5 Flash)
                                 │
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
      GarmentLock                               ReferenceCoverage
(Category, moldería, textiles,           (Front: VERIFIED, Back: UNKNOWN,
   ColorVariants visual crops)              Construction: PARTIAL)
           │                                           │
           └─────────────────────┬─────────────────────┘
                                 ▼
                         PromptCompiler
                 (Injects ShotContracts, PoseHistory,
                  Look Rules, and Anti-Cloning)
                                 │
                                 ▼
                         FalImageGenerator
           ┌─────────────────────┴─────────────────────┐
           ▼                                           ▼
[Candidate 1: FLUX Pro VTO]                 [Candidate 2: FLUX.2 VTO]
  4 Shots (Front, Side, Back, Action)         4 Shots (Front, Side, Back, Action)
           │                                           │
           └─────────────────────┬─────────────────────┘
                                 ▼
                       GeminiImageValidator
                   (Multimodal Visual Audit)
                                 │
                                 ▼
                         Hard Gate Policy
              (GarmentIdentity >= 90, ColorAccuracy >= 90,
               Back without rear photo = NOT_VERIFIABLE)
```

---

## Candidate Models & Comparison Matrix

| Evaluation Dimension | FLUX Pro VTO (`flux-pro/v1/vto`) | FLUX.2 VTO (`flux-2-lora-gallery/virtual-tryon`) |
| :--- | :--- | :--- |
| **API Endpoint** | `https://queue.fal.run/fal-ai/flux-pro/v1/vto` | `https://queue.fal.run/fal-ai/flux-2-lora-gallery/virtual-tryon` |
| **Input Conditioning** | `human_image_url`, `garment_image_url`, `prompt`, `seed` | `human_image`, `garment_image`, `garment_type`, `prompt` |
| **Pricing Baseline** | ~$0.0475 / generation (based on 1024×1024 MP rate) | ~$0.04 - $0.05 / generation |
| **Garment Drape & Silhouette** | High precision on seams and collars | High precision on soft fabrics and textures |
| **Pose Freedom (SIDE, BACK, ACTION)** | High when guided by prompt directives | Good, subject to model conditioning |
| **Back Reconstruction on Front-Only Ref** | Marked `NOT_VERIFIABLE` | Marked `NOT_VERIFIABLE` |

---

## Cost Guard & Safety Controls

To avoid unexpected bills or accidental runaway costs:
*   `AI_MODE=mock`: Default setting. Zero API calls, instant execution.
*   `AI_MODE=real`: Limits session to **1 active color variant** ($1 \text{ color} \times 4 \text{ shots} \times 2 \text{ styles} = 8 \text{ generations maximum}$).
*   `MAX_REAL_GENERATIONS=8`: Hard gate enforced in `/api/projects/[id]/generate-all`.
*   Batch attempts exceeding 8 real calls are rejected with `HTTP 400 [Cost Guard]`.

---

## Environment Variables (`.env.local`)

```bash
# System Mode
AI_MODE=mock                        # 'mock' | 'real'
NEXT_PUBLIC_AI_MODE=mock

# Multimodal Analysis
ANALYSIS_PROVIDER=gemini            # 'gemini' | 'mock'
ANALYSIS_MODEL=gemini-2.5-flash
GEMINI_API_KEY=your_gemini_api_key

# Image Generation (Bake-Off Candidates)
GENERATION_PROVIDER=fal             # 'fal' | 'mock'
GENERATION_MODEL=fal-ai/flux-pro/v1/vto
# Alternativa: GENERATION_MODEL=fal-ai/flux-2-lora-gallery/virtual-tryon
FAL_KEY=your_fal_api_key

# Multimodal Validation
VALIDATION_PROVIDER=gemini          # 'gemini' | 'mock'
VALIDATION_MODEL=gemini-2.5-flash

# Safety Guard
MAX_REAL_GENERATIONS=8
```
