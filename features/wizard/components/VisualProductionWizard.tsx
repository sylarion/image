'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  DEFAULT_SHOT_CHOICES, 
  DESTINATION_PRESETS, 
  STYLE_PRESETS, 
  MODEL_CHOICES,
  DestinationPreset, 
  StylePreset, 
  ProductChoiceViewModel, 
  ColorChoiceViewModel,
  ShotChoiceViewModel,
  GenerationProgressItem,
  VisualWizardAdapters 
} from '../models/wizard.types';
import { WelcomeScreen } from './WelcomeScreen';
import { UploadStep } from './UploadStep';
import { DetectedProductsStep } from './DetectedProductsStep';
import { ShotsStep } from './ShotsStep';
import { DestinationStep } from './DestinationStep';
import { StyleStep } from './StyleStep';
import { ModelStep } from './ModelStep';
import { SummaryStep } from './SummaryStep';
import { GenerationStep } from './GenerationStep';
import { ResultsGalleryStep } from './ResultsGalleryStep';
import { GenerationJob } from '@/types';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { 
  WizardDecisionEngine, 
  FriendlyErrorMapper, 
  SubStep, 
  WizardFormState 
} from '../engine/decision-engine';
import { HumanReviewStep } from './HumanReviewStep';
import { GenerationCostQuote, QualityProfile } from '@/lib/pricing/types';
import { QuoteStatus } from './SummaryStep';

export type WizardStep = 
  | 'WELCOME'
  | 'UPLOAD'
  | 'PRODUCTS'
  | 'SHOTS'
  | 'DESTINATION'
  | 'STYLE'
  | 'MODEL'
  | 'SUMMARY'
  | 'GENERATION'
  | 'RESULTS';

export function VisualProductionWizard() {
  const router = useRouter();

  // Wizard Navigation State
  const [analysisRunId, setAnalysisRunId] = useState<string>('');
  const [productionError, setProductionError] = useState<string>('');
  const [step, setStep] = useState<WizardStep>('WELCOME');

  // Business State (ViewModels)
  const [products, setProducts] = useState<ProductChoiceViewModel[]>([]);
  const [shots, setShots] = useState<ShotChoiceViewModel[]>(DEFAULT_SHOT_CHOICES);
  const [destination, setDestination] = useState<DestinationPreset>('MERCADO_LIBRE');
  const [style, setStyle] = useState<StylePreset>('FONDO_BLANCO');
  const [modelId, setModelId] = useState<string>(MODEL_CHOICES[0].id);

  // Pre-generation Pricing & Quote State
  const [qualityProfile, setQualityProfile] = useState<QualityProfile>('standard');
  const [quote, setQuote] = useState<GenerationCostQuote | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('QUOTE_LOADING');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [qualityTierRates, setQualityTierRates] = useState<Record<QualityProfile, number> | undefined>();

  // Async Analysis & Generation State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState('Detectando prendas');
  const [isCreating, setIsCreating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressItem[]>([]);
  const [completedJobs, setCompletedJobs] = useState<GenerationJob[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [failedJobsCount, setFailedJobsCount] = useState<number>(0);
  const [pollingActive, setPollingActive] = useState<boolean>(false);

  // 1. Welcome action triggers
  const handleStart = () => {
    setStep('UPLOAD');
  };

  // 2. Upload and Automatic Analysis
  const handleImagesUploaded = async (uploadedFiles: { id: string; url: string; name: string }[]) => {
    setProductionError('');
    setIsAnalyzing(true);
    setAnalyzingMessage('Detectando prendas y separando colores...');

    try {
      const sourceImageIds = uploadedFiles.map((f) => f.id);

      // Call Backend Scene Analysis & Crop endpoint
      const response = await fetch('/api/vision/analyze-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceImageIds }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => null);
        if (errorJson?.code === 'ANALYSIS_UNAVAILABLE' || errorJson?.code === 'AI_CONFIGURATION_REQUIRED') {
          setProductionError(errorJson?.error || 'No pudimos analizar esta foto con la configuración actual. Configurá el análisis real o volvé a intentar cuando esté disponible.');
          setAnalyzingMessage('');
          return;
        }
        throw new Error(errorJson?.error || 'Error al analizar la imagen visualmente');
      }

      const json = await response.json();
      if (!json.success || !json.data) {
        throw new Error(json.error || 'Respuesta inesperada del análisis');
      }

      const adaptedProducts: ProductChoiceViewModel[] = json.data.products;
      setAnalysisRunId(json.data.analysisRunId);
      setProducts(adaptedProducts);
      const conflicts: {property:string;reason?:string}[] = [];

      // Compute next adaptive step using Decision Engine
      const nextAdaptiveStep = WizardDecisionEngine.getNextStep(
        'UPLOAD',
        {
          products: adaptedProducts,
          shots,
          destination,
          style,
          modelId,
        },
        conflicts.length > 0
      );

      setStep(nextAdaptiveStep as WizardStep);
    } catch (err: unknown) {
      console.error('Error inesperado durante el análisis de escena:', err);
      const friendlyMsg = FriendlyErrorMapper.toUserMessage(
        err instanceof Error ? err.message : undefined
      );
      setProductionError(friendlyMsg);
      setAnalyzingMessage('');
      setStep('UPLOAD');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Toggle color selection

  const handleToggleColor = (productId: string, colorId: string) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId) return prod;
        const colors = prod.colors.map(c=>c.id===colorId?{...c,selected:!c.selected}:c);
        return {...prod,colors,confirmedVariants:{...prod.confirmedVariants,
          productGroupId:prod.id,selectedVariantIds:colors.filter(c=>c.selected).map(c=>c.id),
          userConfirmed:true,confirmedAt:new Date().toISOString()}};
      })
    );
  };

  // 3.5. Update user-confirmed semantic garment identity
  const handleUpdateIdentity = (
    productId: string,
    identity: import('../models/wizard.types').UserConfirmedGarmentIdentity
  ) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId) return prod;
        return {
          ...prod,
          title: identity.confirmedName,
          category: identity.confirmedCategory,
          confirmedIdentity: identity,
        };
      })
    );
  };

  // 3.6. Update user-confirmed color name (human color correction)
  const handleUpdateColorName = (
    productId: string,
    colorId: string,
    newColorName: string
  ) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id !== productId) return prod;
        const updatedColors = prod.colors.map((c) => {
          if (c.id !== colorId) return c;
          return {
            ...c,
            name: newColorName,
            isUserCorrected: true,
            originalAiName: c.originalAiName || c.name,
          };
        });

        const customColorNames = {
          ...(prod.confirmedVariants?.customColorNames || {}),
          [colorId]: newColorName,
        };

        return {
          ...prod,
          colors: updatedColors,
          confirmedVariants: {
            productGroupId: prod.id,
            selectedVariantIds: updatedColors.filter((c) => c.selected).map((c) => c.id),
            userConfirmed: true,
            customColorNames,
            confirmedAt: new Date().toISOString(),
          },
        };
      })
    );
  };

  // 3.7. User recovery: Add missing variant manually
  const handleAddVariant = async (productId: string, variant: {name:string;file:File}) => {
    setProductionError('');
    try {
      const data = new FormData(); data.append('file',variant.file);
      const upload = await fetch('/api/uploads',{method:'POST',body:data});
      if (!upload.ok) throw new Error('INVALID_IMAGE');
      const uploaded = await upload.json();
      const response = await fetch('/api/vision/analyze-scene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        sourceImageIds:[uploaded.data.id], recovery:{analysisRunId,productGroupId:productId,colorName:variant.name},
      })});
      if (!response.ok) throw new Error('ANALYSIS_UNAVAILABLE');
      const result = await response.json();
      setProducts(previous => result.data.products.map((p:ProductChoiceViewModel)=> {
        const old=previous.find(o=>o.id===p.id);
        return {...p, title:old?.title || p.title,category:old?.category || p.category,
          confirmedIdentity:old?.confirmedIdentity || p.confirmedIdentity,confirmedVariants:old?.confirmedVariants,
          colors:p.colors.map(c=>old?.colors.find(o=>o.id===c.id) || c)};
      }));
    } catch (error) { setProductionError(FriendlyErrorMapper.toUserMessage(error instanceof Error ? error.message : undefined)); }
  };

  // 4. Toggle shots selection
  const handleToggleShot = (shotId: ShotChoiceViewModel['id']) => {
    setShots((prev) =>
      prev.map((s) => (s.id === shotId ? { ...s, selected: !s.selected } : s))
    );
  };

  // 5. Select destination (Automates Smart Defaults)
  const handleSelectDestination = (dest: DestinationPreset) => {
    setDestination(dest);
    const preset = DESTINATION_PRESETS.find((p) => p.id === dest);
    if (preset) {
      setStyle(preset.recommendedStyle);
      setShots((prev) =>
        prev.map((s) => ({
          ...s,
          selected: preset.recommendedShots.includes(s.id),
        }))
      );
    }
  };

  // Poll project status periodically when GENERATION step is active
  useEffect(() => {
    if (step !== 'GENERATION' || !activeProjectId) return;

    let isMounted = true;
    const startTime = Date.now();
    const CLIENT_SAFETY_TIMEOUT_MS = 180000; // 3 minutes defensive client safety net

    const interval = setInterval(async () => {
      try {
        if (Date.now() - startTime > CLIENT_SAFETY_TIMEOUT_MS) {
          console.warn('[VisualProductionWizard] Timeout defensivo alcanzado (3 min). Deteniendo polling.');
          clearInterval(interval);
          setPollingActive(false);
          return;
        }

        const res = await fetch(`/api/projects/${activeProjectId}/status`);
        if (!res.ok) return;

        const json = await res.json();
        if (!json.success || !json.data || !isMounted) return;

        const data = json.data;
        const jobs: GenerationJob[] = data.jobs || [];

        setCompletedJobs(jobs);
        const failedCount = (data.failedJobs !== undefined ? data.failedJobs : ((data.failed || 0) + (data.rejected || 0)));
        setFailedJobsCount(failedCount);

        // Update color progress cards with real thumbnails and counts
        setGenerationProgress((prev) =>
          prev.map((item) => {
            const variantJobs = jobs.filter((j) => j.colorVariantId === item.colorId);
            const finishedJobs = variantJobs.filter(
              (j) => j.status === 'APPROVED' || j.status === 'REVIEW_REQUIRED' || j.status === 'REJECTED' || j.status === 'FAILED'
            );
            const approvedThumbs = variantJobs
              .filter((j) => (j.status === 'APPROVED' || j.status === 'REVIEW_REQUIRED') && (j.outputUrl || j.outputAsset?.url))
              .map((j) => j.outputUrl || j.outputAsset!.url);

            const activeJob = variantJobs.find((j) => j.status === 'GENERATING' || j.status === 'VALIDATING');
            const failedVariantJob = variantJobs.find((j) => j.status === 'FAILED');

            let currentAction = 'En cola de producción';
            if (activeJob) {
              currentAction = activeJob.status === 'GENERATING' ? `Generando ${activeJob.shotView.toLowerCase()}...` : 'Validando fidelidad...';
            } else if (failedVariantJob && finishedJobs.length >= item.totalCount) {
              currentAction = `No se pudo completar la generación (${failedVariantJob.errorCode || 'Error'})`;
            } else if (finishedJobs.length >= item.totalCount) {
              currentAction = 'Variante completada';
            }

            return {
              ...item,
              completedCount: approvedThumbs.length,
              completedThumbnails: approvedThumbs,
              currentAction,
            };
          })
        );

        // Stop polling when project reaches terminal state or activeJobs === 0
        const isTerminalProject = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(data.status);
        const hasNoActiveJobs = data.activeJobs === 0 || (data.queued === 0 && data.generating === 0 && data.validating === 0);

        if (data.isCompleted || isTerminalProject || (hasNoActiveJobs && jobs.length > 0)) {
          clearInterval(interval);
          setPollingActive(false);
        }
      } catch (pollErr) {
        console.error('Error polling project status:', pollErr);
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [step, activeProjectId]);

  // 5. Real-time Pre-Generation Cost Quote calculation
  const activeColorCount = products.flatMap((p) => p.colors.filter((c) => c.selected)).length;
  const activeShotCount = shots.filter((s) => s.selected).length;
  const lastQuotedPayloadRef = useRef<string>('');

  const buildSelectionPayload = useCallback(() => {
    if (!analysisRunId) return null;
    const selectedProducts = products
      .filter((p) => p.colors.some((c) => c.selected))
      .map((p) => ({
        productGroupId: p.id,
        identity: p.confirmedIdentity || {
          productGroupId: p.id,
          aiSuggestedName: p.title || 'Prenda',
          aiSuggestedCategory: p.category || 'Prenda',
          confirmedName: p.confirmedIdentity?.confirmedName || p.title || 'Prenda',
          confirmedCategory: p.confirmedIdentity?.confirmedCategory || p.category || 'Prenda',
          source: 'AI_CONFIRMED' as const,
          confirmedAt: new Date().toISOString(),
        },
        selectedVariantIds: p.colors.filter((c) => c.selected).map((c) => c.id),
        customColorNames: Object.fromEntries(
          p.colors.filter((c) => c.isUserCorrected).map((c) => [c.id, c.name])
        ),
      }));

    const selectedShots = shots.filter((s) => s.selected).map((s) => s.id);
    if (selectedProducts.length === 0 || selectedShots.length === 0) return null;

    const totalVariantCount = selectedProducts.reduce((acc, p) => acc + p.selectedVariantIds.length, 0);
    const expectedJobs = totalVariantCount * selectedShots.length;

    return {
      analysisRunId,
      products: selectedProducts,
      shots: selectedShots,
      destination,
      style,
      modelId,
      expectedJobs,
      qualityProfile: qualityProfile || 'standard',
    };
  }, [analysisRunId, products, shots, destination, style, modelId, qualityProfile]);

  const fetchQuote = useCallback(async (payload: ReturnType<typeof buildSelectionPayload>, force = false) => {
    if (!payload) {
      setQuote(null);
      setQuoteStatus('QUOTE_UNAVAILABLE');
      return;
    }

    const payloadKey = JSON.stringify(payload);
    if (!force && payloadKey === lastQuotedPayloadRef.current) {
      return;
    }

    setQuoteStatus('QUOTE_LOADING');
    setQuoteError(null);

    try {
      const res = await fetch('/api/generation/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selection: payload }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setQuoteStatus('QUOTE_UNAVAILABLE');
        setQuoteError(errData?.error || 'No pudimos calcular el costo de esta producción.');
        return;
      }

      const data = await res.json();
      if (data.success) {
        lastQuotedPayloadRef.current = payloadKey;
        setQuote(data);
        setQualityTierRates(data.qualityTierRates);
        setQuoteStatus('QUOTE_READY');
        setQuoteError(null);
      } else {
        setQuoteStatus('QUOTE_UNAVAILABLE');
        setQuoteError(data.error || 'No pudimos calcular el costo de esta producción.');
      }
    } catch (err: unknown) {
      setQuoteStatus('QUOTE_UNAVAILABLE');
      setQuoteError(err instanceof Error ? err.message : 'Error de conexión al cotizar');
    }
  }, []);

  useEffect(() => {
    const payload = buildSelectionPayload();
    if (!payload) {
      setQuote(null);
      setQuoteStatus('QUOTE_UNAVAILABLE');
      return;
    }

    const payloadKey = JSON.stringify(payload);
    if (payloadKey === lastQuotedPayloadRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      fetchQuote(payload);
    }, 300);

    return () => clearTimeout(timer);
  }, [buildSelectionPayload, fetchQuote]);

  // 6. Summary confirmation & Execution
  const handleConfirmProduction = async () => {
    if (!quote || quoteStatus !== 'QUOTE_READY') {
      setProductionError('Es necesario contar con una cotización válida antes de generar.');
      return;
    }

    setIsCreating(true);
    setStep('GENERATION');
    setFailedJobsCount(0);

    try {
      // 1. Create project in backend with selected colorways and quoteId
      const activeColors = products.flatMap((p) => p.colors.filter((c) => c.selected));
      const firstProduct = products[0];

      // Initialize visual progress cards
      const initialProgress = activeColors.map((c) => ({
        colorId: c.id,
        colorName: c.name,
        colorHex: c.hex,
        completedCount: 0,
        totalCount: shots.filter((s) => s.selected).length,
        currentAction: 'Iniciando producción...',
        completedThumbnails: [],
      }));
      setGenerationProgress(initialProgress);

      const confirmedName = firstProduct?.confirmedIdentity?.confirmedName || firstProduct?.title || 'Mi Producción';
      const confirmedCategory = firstProduct?.confirmedIdentity?.confirmedCategory || firstProduct?.category || 'Vestido';

      const selectedProducts = products.filter(p=>p.colors.some(c=>c.selected));
      const createRes = await fetch('/api/projects', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          analysisRunId,
          quoteId: quote.quoteId,
          qualityProfile: quote.qualityProfile,
          products: selectedProducts.map(p=>({
            productGroupId: p.id,
            identity: p.confirmedIdentity,
            selectedVariantIds: p.colors.filter(c=>c.selected).map(c=>c.id),
            customColorNames: Object.fromEntries(p.colors.filter(c=>c.isUserCorrected).map(c=>[c.id,c.name])),
          })),
          shots: shots.filter(s=>s.selected).map(s=>s.id),
          destination,
          style,
          modelId,
          expectedJobs: activeColors.length * shots.filter(s=>s.selected).length
        }),
      });

      if (!createRes.ok) {
        const errJson = await createRes.json().catch(() => null);
        throw new Error(errJson?.error || 'Error al crear el proyecto');
      }

      const projectJson = await createRes.json();
      const projId = projectJson.data.id;
      setActiveProjectId(projId);

      const createdJobs: GenerationJob[] = projectJson.data.jobs;
      if (createdJobs.length !== activeColors.length * shots.filter(s=>s.selected).length) throw new Error('JOB_COUNT_MISMATCH');
      setCompletedJobs(createdJobs);
      setIsCreating(false);
      setPollingActive(true);
    } catch (err: unknown) {
      console.error('Error generating production:', err);
      setIsCreating(false);
      setProductionError(err instanceof Error ? err.message : 'No pudimos preparar la producción. Revisá la selección e intentá nuevamente.');
      setStep('SUMMARY');
    }
  };

  const handleRetryFailed = async () => {
    if (!activeProjectId) return;
    
    // Check estimated cost of regenerating failed items
    const costPerImage = quote?.estimatedCostPerImageUsd ?? 0.04;
    const isFree = quote?.estimatedGenerationCostUsd === 0;
    const estimatedRetryCost = isFree ? 'Sin costo de API' : `USD ${(failedJobsCount * costPerImage).toFixed(2)}`;

    const confirmed = window.confirm(
      `Esta regeneración de ${failedJobsCount} ${failedJobsCount === 1 ? 'toma' : 'tomas'} tiene un costo estimado de ${estimatedRetryCost}.\n\n¿Deseás continuar con la regeneración?`
    );
    if (!confirmed) return;

    try {
      await fetch(`/api/projects/${activeProjectId}/start-generation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrency: 2 }),
      });
      setPollingActive(true);
    } catch (e) {
      console.error('Error retrying failed jobs:', e);
    }
  };

  // 4 Macro-Etapas Visuales para una experiencia ágil y no técnica
  const MACRO_STAGES = [
    { key: 'UPLOAD', label: '1. Subir', steps: ['UPLOAD'] },
    { key: 'CHOOSE', label: '2. Elegir', steps: ['PRODUCTS', 'SHOTS'] },
    { key: 'PREPARE', label: '3. Preparar', steps: ['DESTINATION', 'STYLE', 'MODEL'] },
    { key: 'CREATE', label: '4. Crear', steps: ['SUMMARY', 'GENERATION', 'RESULTS'] },
  ];

  const currentMacroStageIndex = MACRO_STAGES.findIndex((stage) =>
    stage.steps.includes(step)
  );
  const selectedModel = MODEL_CHOICES.find((m) => m.id === modelId);
  const generationStatus = (() => {
    const total = completedJobs.length;
    const approved = completedJobs.filter((job) => job.status === 'APPROVED' || job.status === 'REVIEW_REQUIRED').length;
    const generating = completedJobs.filter((job) => job.status === 'GENERATING' || job.status === 'VALIDATING').length;
    const queued = completedJobs.filter((job) => job.status === 'QUEUED' || (job.status as string) === 'PENDING').length;
    const failedJobs = completedJobs.filter((job) => job.status === 'FAILED');

    if (isCreating) return 'Programando tus fotos...';
    if (failedJobs.length > 0 && generating === 0 && queued === 0) {
      const firstFailed = failedJobs[0];
      const errInfo = firstFailed.errorCode ? `${firstFailed.errorCode}${firstFailed.errorMessage ? `: ${firstFailed.errorMessage}` : ''}` : (firstFailed.errorMessage || 'Error en validación');
      return `No se pudo completar la generación (${errInfo})`;
    }
    if (generating > 0) return `${approved} de ${total} fotos listas. ${generating} en proceso.`;
    if (queued > 0) return `${approved} de ${total} fotos listas. ${queued} en cola.`;
    if (failedJobsCount > 0) return `${approved} de ${total} fotos listas. ${failedJobsCount} necesitan reintento.`;
    return `${approved} de ${total} fotos listas.`;
  })();

  return (
    <div className="min-h-screen bg-[#07090e] text-gray-100 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="border-b border-[#161923] bg-[#090b12]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            onClick={() => setStep('WELCOME')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">
              Catalog<span className="text-blue-500">AI</span>
            </span>
          </div>

          {/* Stepper consolidado en 4 Macro-Etapas */}
          {currentMacroStageIndex >= 0 && step !== 'GENERATION' && step !== 'RESULTS' && (
            <div className="flex items-center gap-1.5 sm:gap-3">
              {MACRO_STAGES.map((s, idx) => {
                const isCompleted = idx < currentMacroStageIndex;
                const isCurrent = idx === currentMacroStageIndex;
                return (
                  <div key={s.key} className="flex items-center gap-1.5 sm:gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 sm:px-3 py-1 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                          : isCompleted
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-gray-500'
                      }`}
                    >
                      {s.label}
                    </span>
                    {idx < MACRO_STAGES.length - 1 && (
                      <span className="text-gray-700 text-xs hidden sm:inline">›</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-xs text-gray-400 font-medium hidden sm:block">
            Asistente de Producción
          </div>
        </div>
      </header>

      {productionError && <p role="alert" className="text-center text-red-300">{productionError}</p>}
      {/* Main Container: Desktop Split Layout with Live Preview when garment is selected */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {step === 'WELCOME' && (
          <WelcomeScreen
            onStartSingleGarment={handleStart}
            onStartMultiGarment={handleStart}
          />
        )}

        {step !== 'WELCOME' && (
          <div className={`grid grid-cols-1 ${products.length > 0 && step !== 'GENERATION' && step !== 'RESULTS' ? 'lg:grid-cols-12 gap-8' : 'max-w-4xl mx-auto'}`}>
            {/* Left Area: Active Step Questions & Options */}
            <div className={products.length > 0 && step !== 'GENERATION' && step !== 'RESULTS' ? 'lg:col-span-8' : 'w-full'}>
              {step === 'UPLOAD' && (
                <UploadStep
                  onImagesUploaded={handleImagesUploaded}
                  isAnalyzing={isAnalyzing}
                  analyzingMessage={analyzingMessage}
                  analysisError={productionError}
                />
              )}

              {step === 'PRODUCTS' && (
                <DetectedProductsStep
                  products={products}
                  onToggleColor={handleToggleColor}
                  onUpdateIdentity={handleUpdateIdentity}
                  onUpdateColorName={handleUpdateColorName}
                  onAddVariant={handleAddVariant}
                  onNext={() => setStep('SHOTS')}
                  onBack={() => setStep('UPLOAD')}
                />
              )}

              {step === 'SHOTS' && (
                <ShotsStep
                  shots={shots}
                  onToggleShot={handleToggleShot}
                  onNext={() => setStep('DESTINATION')}
                  onBack={() => setStep('PRODUCTS')}
                />
              )}

              {step === 'DESTINATION' && (
                <DestinationStep
                  selectedDestination={destination}
                  onSelectDestination={handleSelectDestination}
                  onNext={() => {
                    const next = WizardDecisionEngine.getNextStep('DESTINATION', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(next as WizardStep);
                  }}
                  onBack={() => {
                    const prev = WizardDecisionEngine.getPreviousStep('DESTINATION', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(prev as WizardStep);
                  }}
                />
              )}

              {step === 'STYLE' && (
                <StyleStep
                  selectedStyle={style}
                  destination={destination}
                  onSelectStyle={(st) => setStyle(st)}
                  onNext={() => {
                    const next = WizardDecisionEngine.getNextStep('STYLE', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(next as WizardStep);
                  }}
                  onBack={() => {
                    const prev = WizardDecisionEngine.getPreviousStep('STYLE', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(prev as WizardStep);
                  }}
                />
              )}

              {step === 'MODEL' && (
                <ModelStep
                  selectedModelId={modelId}
                  onSelectModel={(id) => setModelId(id)}
                  onNext={() => {
                    const next = WizardDecisionEngine.getNextStep('MODEL', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(next as WizardStep);
                  }}
                  onBack={() => {
                    const prev = WizardDecisionEngine.getPreviousStep('MODEL', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(prev as WizardStep);
                  }}
                />
              )}

              {step === 'SUMMARY' && (
                <SummaryStep
                  products={products}
                  shots={shots}
                  destination={destination}
                  style={style}
                  modelId={modelId}
                  modelName={selectedModel?.name || 'Modelo estándar'}
                  qualityProfile={qualityProfile}
                  onQualityChange={(q) => setQualityProfile(q)}
                  quote={quote}
                  quoteStatus={quoteStatus}
                  quoteError={quoteError}
                  onRetryQuote={() => {
                    const payload = buildSelectionPayload();
                    if (payload) fetchQuote(payload, true);
                  }}
                  qualityTierRates={qualityTierRates}
                  onConfirm={handleConfirmProduction}
                  onBack={() => {
                    const prev = WizardDecisionEngine.getPreviousStep('SUMMARY', {
                      products,
                      shots,
                      destination,
                      style,
                      modelId,
                    });
                    setStep(prev as WizardStep);
                  }}
                  isCreating={isCreating}
                />
              )}

              {step === 'GENERATION' && (
                <GenerationStep
                  progressItems={generationProgress}
                  currentOverallStatus={generationStatus}
                  failedCount={failedJobsCount}
                  onRetryFailed={handleRetryFailed}
                  onViewResults={() => setStep('RESULTS')}
                />
              )}

              {step === 'RESULTS' && (
                <ResultsGalleryStep
                  jobs={completedJobs}
                  onNewProduction={() => setStep('WELCOME')}
                />
              )}
            </div>

            {/* Right Area: Constant Live Preview of Selected Garment & Settings */}
            {products.length > 0 && step !== 'GENERATION' && step !== 'RESULTS' && (
              <div className="hidden lg:block lg:col-span-4 space-y-4">
                <div className="sticky top-24 p-5 rounded-3xl bg-[#11131c] border border-[#1e2230] space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#1e2230] pb-3">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Tu Prenda
                    </span>
                    <span className="text-[11px] text-blue-400 font-semibold">
                      {products[0]?.confirmedIdentity?.confirmedCategory || products[0]?.category}
                    </span>
                  </div>

                  {/* Compact Crop Preview (non-intrusive height) */}
                  <div className="h-40 w-full rounded-2xl overflow-hidden bg-black/60 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={products[0]?.mainCropUrl || ''}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 right-2 p-2 rounded-xl bg-black/85 backdrop-blur-md text-xs text-white flex items-center justify-between">
                      <span className="font-semibold truncate">
                        {products[0]?.confirmedIdentity?.confirmedName || products[0]?.title}
                      </span>
                      <span className="text-[10px] text-blue-300 font-medium bg-blue-500/20 px-2 py-0.5 rounded-full">
                        {products[0]?.colors.filter((c) => c.selected).length} {products[0]?.colors.filter((c) => c.selected).length === 1 ? 'color' : 'colores'}
                      </span>
                    </div>
                  </div>

                  {/* Progressive Live Selection Summary: Only show decisions once reached/selected */}
                  <div className="space-y-2 pt-1 text-xs text-gray-400 divide-y divide-[#1e2230]/50">
                    <div className="flex items-center justify-between pt-1">
                      <span>Colores activos:</span>
                      <span className="text-white font-medium">
                        {products[0]?.colors.filter((c) => c.selected).length} de {products[0]?.colors.length} variantes
                      </span>
                    </div>

                    {['SHOTS', 'DESTINATION', 'STYLE', 'MODEL', 'SUMMARY'].includes(step) && (
                      <div className="flex items-center justify-between pt-2">
                        <span>Tomas:</span>
                        <span className="text-white font-medium">
                          {shots.filter((s) => s.selected).length} ángulos
                        </span>
                      </div>
                    )}

                    {['DESTINATION', 'STYLE', 'MODEL', 'SUMMARY'].includes(step) && (
                      <div className="flex items-center justify-between pt-2">
                        <span>Destino:</span>
                        <span className="text-white font-medium capitalize">
                          {destination.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}

                    {['STYLE', 'MODEL', 'SUMMARY'].includes(step) && (
                      <div className="flex items-center justify-between pt-2">
                        <span>Estilo de fondo:</span>
                        <span className="text-white font-medium capitalize">
                          {style.toLowerCase().replace(/_/g, ' ')}
                        </span>
                      </div>
                    )}

                    {['MODEL', 'SUMMARY'].includes(step) && (
                      <div className="flex items-center justify-between pt-2">
                        <span>Presentación:</span>
                        <span className="text-white font-medium">
                          {modelId === 'model-no-model' ? 'Maniquí Invisible' : 'Modelo Humano'}
                        </span>
                      </div>
                    )}

                    {/* Pre-generation live cost preview */}
                    {quote && ['SHOTS', 'DESTINATION', 'STYLE', 'MODEL', 'SUMMARY'].includes(step) && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-gray-300 font-semibold">Costo estimado:</span>
                        <span className="text-emerald-400 font-bold">
                          {quote.estimatedGenerationCostUsd === 0 && (quote.estimatedValidationCostUsd ?? 0) === 0
                            ? 'Sin costo de API'
                            : `USD ${quote.estimatedTotalCostUsd?.toFixed(2)}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile Sticky Pre-Generation Bar (Requirement 25) */}
        {step === 'SUMMARY' && products.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a0c14]/95 backdrop-blur-lg border-t border-[#1e2230] z-50 flex items-center justify-between lg:hidden shadow-2xl">
            <div>
              <span className="text-xs text-gray-400 block">
                {activeColorCount * activeShotCount} imágenes
              </span>
              <span className="text-sm font-bold text-white">
                {quote?.estimatedTotalCostUsd === 0 
                  ? 'Sin costo de API' 
                  : quote?.estimatedTotalCostUsd !== null && quote?.estimatedTotalCostUsd !== undefined
                    ? `USD ${quote.estimatedTotalCostUsd.toFixed(2)} estimados`
                    : 'Calculando...'}
              </span>
            </div>
            <button
              onClick={handleConfirmProduction}
              disabled={quoteStatus !== 'QUOTE_READY' || isCreating}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30"
            >
              <span>Generar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-[#161923] py-4 text-center text-xs text-gray-600">
        Catalog AI • Asistente de Producción Fotográfica para E-commerce
      </footer>
    </div>
  );
}
