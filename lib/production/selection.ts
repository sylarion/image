import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { AnalysisRun, Project, ProductionStyle, GarmentCategory, ImageAsset, GenerationPlan } from '@/types';
import { getModelById, isKnownModelId } from '@/lib/constants/models';
import { buildGarmentMaster } from '@/lib/dna/garment-master';
import { getAiConfig } from '@/lib/ai/config';
import { GenerationPricingService } from '@/lib/pricing/pricing-service';

const identity = z.object({
  productGroupId: z.string(),
  aiSuggestedName: z.string().default('Prenda'),
  aiSuggestedCategory: z.string().default('Prenda'),
  confirmedName: z.string().trim().min(1).max(120),
  confirmedCategory: z.string().trim().min(1).max(120),
  source: z.enum(['AI_CONFIRMED', 'USER_CORRECTED']).default('AI_CONFIRMED'),
  confirmedAt: z.string().default(() => new Date().toISOString())
});
export const ProductionSelectionSchema = z.object({
  analysisRunId:z.string().min(1),
  products:z.array(z.object({productGroupId:z.string(),identity,selectedVariantIds:z.array(z.string()).min(1),customColorNames:z.record(z.string(),z.string().trim().min(1).max(80)).default({})})).min(1),
  shots:z.array(z.enum(['FRONT','SIDE','BACK','ACTION'])).min(1).max(4),
  destination:z.enum(['MERCADO_LIBRE','TIENDA_ONLINE','INSTAGRAM','CATALOGO','MAYORISTAS']).default('MERCADO_LIBRE'),
  style:z.enum(['FONDO_BLANCO','ESTUDIO_PREMIUM','EDITORIAL','LIFESTYLE']).default('FONDO_BLANCO'),
  modelId:z.string().default('model-female-sofia').refine(id => isKnownModelId(id), { message: 'MODEL_NOT_FOUND: Unknown model' }),
  expectedJobs:z.number().int().positive().optional(),
  quoteId:z.string().min(1).optional(),
  qualityProfile:z.enum(['draft','standard','final']).default('standard'),
}).superRefine((s,ctx) => {
  if (new Set(s.shots).size !== s.shots.length || new Set(s.products.map(p=>p.productGroupId)).size !== s.products.length || s.products.some(p=>new Set(p.selectedVariantIds).size !== p.selectedVariantIds.length)) ctx.addIssue({code:'custom',message:'Duplicate selection'});
});
export type ProductionSelection = z.infer<typeof ProductionSelectionSchema>;
const styles: Record<ProductionSelection['style'],ProductionStyle> = {FONDO_BLANCO:'STUDIO_WHITE',ESTUDIO_PREMIUM:'PREMIUM_STUDIO',EDITORIAL:'EDITORIAL_CATALOG',LIFESTYLE:'LIFESTYLE'};

/**
 * Pre-flight validation gate.
 * Validates strictly before generation:
 * - imagen usable
 * - prenda detectada
 * - variante detectada
 * - referencia válida
 * - duplicados
 * Does NOT apply post-generation gates (ModelIdentity, GarmentSimilarity, ColorSimilarity, ShotCompliance).
 */
export function runPreflightValidation(run: AnalysisRun, variants: Array<{ variant: { referenceCrops?: string[] }; group: unknown }>): void {
  // 1. Imagen usable
  if (!run.sourceImages || !run.sourceImages.length || run.sourceImages.some(image => !image.sha256 || image.byteSize <= 0 || image.width <= 0 || image.height <= 0 || !image.mimeType?.startsWith('image/'))) {
    throw new Error('PREFLIGHT_UNUSABLE_IMAGE');
  }

  // 2. Duplicados
  const hashes = run.sourceImages.map(image => image.sha256);
  if (new Set(hashes).size !== hashes.length) {
    throw new Error('PREFLIGHT_DUPLICATE_IMAGE');
  }

  // 3. Prenda detectada
  if (!run.productGroups || run.productGroups.length === 0) {
    throw new Error('PREFLIGHT_NO_GARMENT_DETECTED');
  }

  // 4. Variante detectada
  if (!variants || variants.length === 0) {
    throw new Error('PREFLIGHT_NO_VARIANT_DETECTED');
  }

  // 5. Referencia válida
  for (const { variant } of variants) {
    if (!variant.referenceCrops || variant.referenceCrops.length === 0) {
      throw new Error('PREFLIGHT_INVALID_REFERENCE');
    }
    for (const url of variant.referenceCrops) {
      const crop = run.crops.find(c => c.url === url);
      if (!crop || !crop.storageKey || !crop.sha256 || crop.width <= 0 || crop.height <= 0 || url.startsWith('blob:') || !run.sourceImages.some(image => image.id === crop.sourceImageId)) {
        throw new Error('PREFLIGHT_INVALID_REFERENCE');
      }
    }
  }
}
export function prepareGenerationPlan(run: AnalysisRun, input: unknown) {
  const selection = ProductionSelectionSchema.parse(input);
  if (run.status !== 'COMPLETED' || run.analysisRunId !== selection.analysisRunId) throw new Error('INVALID_ANALYSIS');
  const variants = selection.products.flatMap(p => {
    const group = run.productGroups.find(g=>g.id===p.productGroupId);
    if (!group || p.identity.productGroupId !== group.id) throw new Error('INVALID_SELECTION');
    return p.selectedVariantIds.map(id => {
      const variant=group.variants.find(v=>v.id===id);
      if (!variant || !variant.referenceCrops.length) throw new Error('INVALID_SELECTION');
      return {variant,group,choice:p};
    });
  });
  const expected = variants.length * selection.shots.length;
  if (selection.expectedJobs !== undefined && expected !== selection.expectedJobs) throw new Error('JOB_COUNT_MISMATCH');

  // Pre-flight check (imagen usable, prenda detectada, variante detectada, referencia válida, duplicados)
  runPreflightValidation(run, variants);

  const config = getAiConfig();
  const plan: GenerationPlan = {
    provider: config.aiMode === 'real' ? config.generationProvider : 'mock',
    model: config.aiMode === 'real' ? config.generationModel : 'mock-model',
    shots: [...selection.shots].sort(),
    background: styles[selection.style],
    aspectRatio: selection.destination === 'INSTAGRAM' ? '4:5' : (['MERCADO_LIBRE','MAYORISTAS'].includes(selection.destination) ? '1:1' : '3:4'),
    resolution: config.generationProvider === 'gemini' ? '1K' : 'provider-default',
    quantity: expected,
    productGroup: variants[0]?.group.id,
    variant: variants[0]?.variant.id,
    selectedModel: selection.modelId,
    products: variants.map(({group,variant,choice}) => ({
      productGroup: group.id,
      variant: variant.id,
      identity: choice.identity,
      colorName: choice.customColorNames[variant.id] || variant.color.canonicalName,
    })).sort((a,b) => a.variant.localeCompare(b.variant)),
    analysisRunId: run.analysisRunId,
    qualityProfile: selection.qualityProfile,
  };
  const planKey = createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return { selection, variants, plan, planKey };
}

export function createSelectedProduction(run: AnalysisRun, input: unknown): Project {
  const { selection, variants, plan, planKey } = prepareGenerationPlan(run, input);
  const expected = plan.quantity;
  // Verify Quote ID and match
  let pricingSnapshot: import('@/lib/pricing/types').GenerationPricingSnapshot | undefined = undefined;

  if (selection.quoteId) {
    const quoteValidation = GenerationPricingService.validateQuoteMatch(selection.quoteId, expected);
    if (!quoteValidation.valid || !quoteValidation.quote) {
      throw new Error(quoteValidation.error || 'QUOTE_MISMATCH');
    }
    const q = quoteValidation.quote;
    const isPlanMismatch = (q.planKey && q.planKey !== planKey) ||
      (q.provider && q.provider !== plan.provider && getAiConfig().aiMode === 'real') ||
      (q.qualityProfile && q.qualityProfile !== selection.qualityProfile);
    if (isPlanMismatch) throw new Error('QUOTE_PLAN_MISMATCH');
    pricingSnapshot = {
      planKey, confirmedAt: new Date().toISOString(), maxAttempts: q.maxAttempts, maxEstimatedCostUsd: q.maxEstimatedCostUsd,
      quoteId: q.quoteId,
      provider: q.provider,
      model: q.model,
      qualityProfile: q.qualityProfile,
      imageCount: q.totalImages,
      estimatedCostPerImageUsd: q.estimatedCostPerImageUsd,
      estimatedGenerationCostUsd: q.estimatedGenerationCostUsd,
      estimatedValidationCostUsd: q.estimatedValidationCostUsd || null,
      estimatedTotalCostUsd: q.estimatedTotalCostUsd,
      currency: q.currency,
      quotedAt: q.calculatedAt,
    };
  } else {
    if (getAiConfig().aiMode === 'real') {
      throw new Error('QUOTE_CONFIRMATION_REQUIRED');
    }
    pricingSnapshot = {
      planKey,
      confirmedAt: new Date().toISOString(),
      maxAttempts: expected * 3,
      maxEstimatedCostUsd: 0,
      quoteId: `quote-mock-${randomUUID()}`,
      provider: plan.provider,
      model: plan.model,
      qualityProfile: selection.qualityProfile,
      imageCount: expected,
      estimatedCostPerImageUsd: 0,
      estimatedGenerationCostUsd: 0,
      estimatedValidationCostUsd: 0,
      estimatedTotalCostUsd: 0,
      currency: 'USD',
      quotedAt: new Date().toISOString(),
    };
  }

  const now = new Date().toISOString(); const id = `proj-${randomUUID()}`;
  const first = variants[0];
  const references = (urls:string[]):ImageAsset[] => urls.map((url,i)=> {
    const crop = run.crops.find(c=>c.url===url);
    if (!crop || url.startsWith('blob:')) throw new Error('INVALID_REFERENCE');
    return {id:crop.id,type:'REFERENCE',source:'UPLOAD',url,order:i,createdAt:now,sourceImageId:crop.sourceImageId,storageKey:crop.storageKey,sha256:crop.sha256,width:crop.width,height:crop.height};
  });
  const selectedModel = getModelById(selection.modelId);
  const garmentColorVariants = variants.map(({variant,choice},order)=>({id:variant.id,name:choice.customColorNames[variant.id] || variant.color.canonicalName,
    detectedColor:variant.color.observedName,colorDescription:variant.color.observedName,approximateHex:variant.color.hex,
    referenceAssets:references(variant.referenceCrops),referenceCrop:variant.referenceCrops[0],selected:true,order,
  }));
  const master = buildGarmentMaster({
    garmentLock: {
      id: first.group.id,
      name: first.choice.identity.confirmedName,
      category: first.choice.identity.confirmedCategory as GarmentCategory,
      material: 'UNKNOWN',
      pattern: first.group.visualSignature.patternType,
      details: first.group.visualSignature.distinctiveDetails,
      pockets: first.group.visualSignature.hasPockets,
      sizes: [],
      mustPreserve: ['Preserve observed garment structure and all visible details'],
      garmentDNA: first.group.garmentDNA,
      referenceImages: references(variants.flatMap(v=>v.variant.referenceCrops)),
      colorVariants: garmentColorVariants,
    },
    sourceImageSha256: run.sourceImages?.[0]?.sha256,
    underlyingDNA: first.group.garmentDNA,
    colorVariants: variants.map(v => v.choice.customColorNames[v.variant.id] || v.variant.color.canonicalName),
  });
  const project: Project = {
    id,name:first.choice.identity.confirmedName,status:'READY',createdAt:now,updatedAt:now,
    analysisRunId:run.analysisRunId,productionSelection:selection,
    pricingSnapshot,
    actualCost: {
      estimatedUsd: pricingSnapshot?.estimatedTotalCostUsd ?? null,
      actualUsd: null,
      generatedImages: 0,
      failedImages: 0,
      attemptsCount: 0,
      billableRequestsCount: 0,
    },
    garment:{id:first.group.id,name:first.choice.identity.confirmedName,category:first.choice.identity.confirmedCategory as GarmentCategory,
      material:'UNKNOWN',pattern:first.group.visualSignature.patternType,details:first.group.visualSignature.distinctiveDetails,
      pockets:first.group.visualSignature.hasPockets,sizes:[],mustPreserve:['Preserve observed garment structure and all visible details'],garmentDNA:first.group.garmentDNA,
      garmentMaster: master,
      referenceImages:references(variants.flatMap(v=>v.variant.referenceCrops)),
      colorVariants:variants.map(({variant,choice},order)=>({id:variant.id,name:choice.customColorNames[variant.id] || variant.color.canonicalName,
        detectedColor:variant.color.observedName,colorDescription:variant.color.observedName,approximateHex:variant.color.hex,
        referenceAssets:references(variant.referenceCrops),referenceCrop:variant.referenceCrops[0],selected:true,order,
      })),
    },
    model: selectedModel,
    selectedPackages:{studioWhite:selection.style==='FONDO_BLANCO',editorialCatalog:selection.style==='EDITORIAL'},
    jobs:variants.flatMap(({variant,group,choice}) => selection.shots.map(shot=>({
      id:`job-${randomUUID()}`,projectId:id,analysisRunId:run.analysisRunId,productGroupId:group.id,
      colorVariantId:variant.id,colorName:choice.customColorNames[variant.id] || variant.color.canonicalName,
      productionStyle:styles[selection.style],shotView:shot,label:`${choice.customColorNames[variant.id] || variant.color.canonicalName} — ${shot}`,
      aspectRatio:selection.destination==='INSTAGRAM'?'4:5':(['MERCADO_LIBRE','MAYORISTAS'].includes(selection.destination)?'1:1':'3:4'),
      provider: plan.provider, generationModel: plan.model, resolution: plan.resolution,
      garmentLock: {id:group.id,name:choice.identity.confirmedName,category:choice.identity.confirmedCategory as GarmentCategory,
        material:'UNKNOWN',pattern:group.visualSignature.patternType,details:group.visualSignature.distinctiveDetails,
        pockets:group.visualSignature.hasPockets,sizes:[],mustPreserve:['Preserve observed garment structure and all visible details'],garmentDNA:group.garmentDNA,
        garmentMaster: master,
        referenceImages:references(variant.referenceCrops),colorVariants:[]},
      garmentMaster: master,
      modelLock: selectedModel, modelMode:selection.modelId,status:'QUEUED',progress:0,attempts:0,createdAt:now,
    }))),
  };
  if (project.jobs.length !== expected) throw new Error('JOB_COUNT_MISMATCH');
  return project;
}
