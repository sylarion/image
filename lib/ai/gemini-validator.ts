import { buildGarmentMaster, evaluateStructuralFidelityAudit } from '@/lib/dna/garment-master';
import { 
  ImageAsset, 
  GarmentLock, 
  ColorVariant, 
  ModelLock, 
  MandatoryShotView, 
  GarmentValidationResult,
  ValidationPolicy
} from '@/types';
import { DEFAULT_VALIDATION_POLICY } from './validation';
import { getShotContract } from './shot-contracts';
import { getShotReferenceStatus } from './reference-coverage';

/**
 * Real Multimodal Validation Adapter powered by Google Gemini Vision.
 * Compares reference images with generated asset, assesses adherence to ShotContract,
 * enforces Hard Gates, and marks unseen features as NOT_VERIFIABLE without fabricating scores.
 */
export class GeminiImageValidator {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async validate(context: {
    generatedAsset: ImageAsset;
    garmentLock: GarmentLock;
    colorVariant: ColorVariant;
    modelLock: ModelLock;
    shotView: MandatoryShotView;
    referenceAssets: ImageAsset[];
    garmentMaster?: import('@/types/garment-master').GarmentMaster;
    anchorAsset?: ImageAsset;
    policy?: ValidationPolicy;
  }): Promise<GarmentValidationResult> {
    const { generatedAsset, garmentLock, colorVariant, modelLock, shotView, referenceAssets, garmentMaster, anchorAsset } = context;
    const policy = context.policy || DEFAULT_VALIDATION_POLICY;
    const contract = getShotContract(shotView);
    const coverage = garmentLock.coverage;

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no configurada para validación real');
    }

    const referenceStatus = getShotReferenceStatus(shotView, coverage);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const promptText = `
Sos el Auditor Jefe de Calidad Visual de Catalog AI.
Tu tarea es auditar una fotografía generada por IA contra las fotografías de referencia originales de la prenda.

INFORMACIÓN DE LA PRENDA:
- Categoría: ${garmentLock.category}
- Material: ${garmentLock.material}
- Estampado: ${garmentLock.pattern}
- Variante de color objetivo: ${colorVariant.name} (${colorVariant.colorDescription})
- Detalles obligatorios a preservar: ${garmentLock.mustPreserve.join(', ')}
- Identidad de modelo esperada: ${modelLock.name} (${modelLock.apparentAge}, ${modelLock.skinTone}, cabello ${modelLock.hairColor})

CONTRATO FOTOGRÁFICO EXIGIDO (${shotView}):
- Orientación corporal: ${contract.bodyOrientation}
- Orientación de cabeza: ${contract.headOrientation}
- Mirada obligatoria: ${contract.gaze} (a la lente de cámara)
- Movimiento: ${contract.movement}

FOTOS EN EL REQUEST:
- Imagen 1 (Generada): URL: ${generatedAsset.url}
- Referencias originales: ${referenceAssets.map(r => r.url).join(', ')}

GARMENT MASTER DIRECTIVES (LOCKED ATTRIBUTES):
- Neckline: ${garmentMaster?.neckline || "Original neckline geometry"}
- Buttons: ${garmentMaster?.buttonCount !== undefined ? garmentMaster.buttonCount + " buttons" : "Original button layout"}
- Sleeves: ${garmentMaster?.sleeveType || "Original sleeves"}
- Seams/Pockets: ${garmentMaster?.pockets || "Original construction"}
- Locked Attributes must NOT mutate under any circumstances.
REGLAS DE AUDITORÍA CRÍTICAS:
1. Si la vista es BACK y NO existe fotografía trasera original en las referencias, la métrica BackConstructionFidelity NO SE PUEDE VERIFICAR. Marcala como status: "NOT_VERIFIABLE". No inventes un score de 100%.
2. Evalúa numéricamente (0 a 100) cada una de las siguientes dimensiones:
   - garmentIdentityScore (corte, silueta, mangas, escote)
   - colorAccuracyScore (tono del color y ausencia de recoloreo accidental en estampas)
   - shapeScore (anatomía y caída natural)
   - patternScore (alineación y escala de la estampa)
   - detailScore (costuras, bolsillos, cierres)
   - modelIdentityScore (rostro, piel, pelo, ojos idénticos)
   - shotAccuracyScore (cumplimiento del contrato de pose y ángulo)
   - poseDiversityScore (postura no clonada)

Devolvé EXCLUSIVAMENTE este JSON:
{
  "garmentIdentityScore": number,
  "colorAccuracyScore": number,
  "shapeScore": number,
  "patternScore": number,
  "detailScore": number,
  "modelIdentityScore": number,
  "shotAccuracyScore": number,
  "poseDiversityScore": number,
  "issues": ["lista de discrepancias o defectos si existen"]
}
`;

    const { resolveImageBytes } = await import('@/lib/storage/image-storage');
    const parts: unknown[] = [{ text: promptText }];

    // Attach real multimodal bytes: Generated Asset
    const generatedResolved = await resolveImageBytes(generatedAsset);
    if (generatedResolved) {
      parts.push({ text: '[IMAGEN GENERADA A AUDITAR]:' });
      parts.push({
        inline_data: {
          mime_type: generatedResolved.mimeType,
          data: generatedResolved.buffer.toString('base64'),
        },
      });
    }

    // Attach real multimodal bytes: Original Reference Assets
    for (let i = 0; i < referenceAssets.length; i++) {
      const ref = referenceAssets[i];
      const refResolved = await resolveImageBytes(ref);
      if (refResolved) {
        parts.push({ text: `[REFERENCIA ORIGINAL #${i + 1} (${ref.name || 'foto'})]:` });
        parts.push({
          inline_data: {
            mime_type: refResolved.mimeType,
            data: refResolved.buffer.toString('base64'),
          },
        });
      }
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini Validation API error: ${response.status}`);
      }

      const resJson = await response.json();
      const outputText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(outputText || '{}');

      const readScore = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : 0;
      const garmentIdentityScore = readScore(parsed.garmentIdentityScore);
      const colorAccuracyScore = readScore(parsed.colorAccuracyScore);
      const shapeScore = readScore(parsed.shapeScore);
      const patternScore = readScore(parsed.patternScore);
      const detailScore = readScore(parsed.detailScore);
      const modelIdentityScore = readScore(parsed.modelIdentityScore);
      const shotAccuracyScore = readScore(parsed.shotAccuracyScore);
      const poseDiversityScore = readScore(parsed.poseDiversityScore);
      const issues: string[] = parsed.issues || [];

      // Evaluate Hard Gates
      const failedGates: string[] = [];
      if (garmentIdentityScore < policy.minGarmentIdentityScore) {
        failedGates.push(`GarmentIdentity (${garmentIdentityScore}) < min (${policy.minGarmentIdentityScore})`);
      }
      if (colorAccuracyScore < policy.minColorAccuracyScore) {
        failedGates.push(`ColorAccuracy (${colorAccuracyScore}) < min (${policy.minColorAccuracyScore})`);
      }
      if (shotAccuracyScore < policy.minShotAccuracyScore) {
        failedGates.push(`ShotAccuracy (${shotAccuracyScore}) < min (${policy.minShotAccuracyScore})`);
      }
      if (modelIdentityScore < policy.minModelIdentityScore) {
        failedGates.push(`ModelIdentity (${modelIdentityScore}) < min (${policy.minModelIdentityScore})`);
      }

      // Structural Fidelity Hard Gates Evaluation
      const master = garmentMaster || garmentLock.garmentMaster || buildGarmentMaster({ garmentLock });
      const structuralAudit = evaluateStructuralFidelityAudit({
        master,
        modelLock,
        targetVariant: colorVariant,
        shotView,
        auditMetrics: {
          garmentSimilarity: garmentIdentityScore,
          modelIdentityConsistency: modelIdentityScore,
          colorVariantConsistency: colorAccuracyScore,
          shotCompliance: shotAccuracyScore,
        },
        anchorAsset,
      });
      const structuralFidelityScore = structuralAudit.metrics.structuralFidelity;
      const criticalFaults = structuralAudit.criticalFaults;
      if (criticalFaults.length > 0) {
        for (const fault of criticalFaults) {
          failedGates.push(`Hard Gate Estructural: ${fault}`);
        }
        issues.push(...structuralAudit.issues);
      }
      const policyPassed = failedGates.length === 0 && structuralAudit.status !== 'REJECTED';

      const overallScore = Math.round(
        (garmentIdentityScore + colorAccuracyScore + shapeScore + patternScore + detailScore + modelIdentityScore + shotAccuracyScore + poseDiversityScore) / 8
      );

      return {
        overallScore,
        garmentIdentityScore,
        garmentSimilarityScore: garmentIdentityScore,
        structuralFidelityScore,
        criticalFaults,
        comprehensiveAudit: structuralAudit,
        colorAccuracyScore,
        colorSimilarityScore: colorAccuracyScore,
        shotComplianceScore: shotAccuracyScore,
        shapeScore,
        patternScore,
        detailScore,
        modelIdentityScore,
        shotAccuracyScore,
        poseDiversityScore,
        policyPassed,
        failedGates,
        referenceStatus,
        issues: failedGates.length > 0 ? [...failedGates.map(g => `Hard Gate Fallido: ${g}`), ...issues] : issues,
      };
    } catch (err: unknown) {
      console.error('Error during real Gemini image validation:', err);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`VALIDATION_FAILED: ${msg}`);
    }
  }
}
