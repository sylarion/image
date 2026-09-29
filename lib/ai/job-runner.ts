import { getProjectRepository } from '@/lib/storage/project.repository';
import { getImageGenerationProvider } from '@/lib/ai';
import { getAiConfig } from '@/lib/ai/config';
import { evaluateValidationStatus } from '@/lib/ai/validation';
import { transitionJobState, canAttemptRegeneration, isTerminalJobStatus } from './job-state-machine';
import { GenerationJob, ProductionStatus } from '@/types';
import { getImageStorage, resolveImageBytes } from '@/lib/storage/image-storage';

export const DEFAULT_CONCURRENCY = 2;
export const STUCK_JOB_TIMEOUT_MS = 90000; // 90 seconds
export const MAX_GENERATION_WAIT_MS = 60000; // 60 seconds

export interface RunnerStatus {
  projectId: string;
  status: ProductionStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeJobs: number;
  queued: number;
  generating: number;
  validating: number;
  approved: number;
  reviewRequired: number;
  rejected: number;
  failed: number;
  isCompleted: boolean;
  jobs: GenerationJob[];
}

/**
 * GenerationJobRunner
 * Decoupled, asynchronous job runner for Catalog AI productions.
 * Features:
 * 1. Controlled concurrency pool (concurrency = 2 or 3)
 * 2. Strict state machine transitions (QUEUED -> GENERATING -> VALIDATING -> APPROVED / FAILED)
 * 3. Stuck job watchdog protection (detects jobs frozen in GENERATING)
 * 4. Safe retry logic with MAX_GENERATION_ATTEMPTS
 * 5. Immediate persistence before and after external network calls
 * 6. Never leaves jobs hanging or in indefinite spinner state
 */
export class GenerationJobRunner {
  private static activeRuns = new Set<string>();
  private static activeJobs = new Set<string>();
  private static reservations = new Map<string, Promise<void>>();

  private static async reserve(projectId: string, jobId: string) {
    const previous = this.reservations.get(projectId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    this.reservations.set(projectId, queued);
    await previous;
    try {
      const repository = getProjectRepository();
      const project = await repository.getById(projectId);
      const job = project?.jobs.find(item => item.id === jobId);
      if (!project || !job || job.status !== 'QUEUED') return null;
      const config = getAiConfig();
      const attempts = project.jobs.reduce((sum, item) => sum + item.attempts, 0);
      const quote = project.pricingSnapshot;
      let error: string | undefined;
      if (!canAttemptRegeneration(job.attempts)) error = 'RETRY_LIMIT';
      if (quote) {
        if (quote.maxAttempts && attempts >= quote.maxAttempts) {
          error = 'COST_GUARD';
        } else if (typeof quote.maxEstimatedCostUsd === 'number' && quote.maxEstimatedCostUsd > 0) {
          const costPerAttempt = (quote.estimatedCostPerImageUsd ?? 0) + (quote.estimatedValidationCostUsd && quote.imageCount ? quote.estimatedValidationCostUsd / quote.imageCount : 0);
          if (costPerAttempt > 0 && Number(((attempts + 1) * costPerAttempt).toFixed(4)) > quote.maxEstimatedCostUsd + 0.0001) {
            error = 'COST_GUARD';
          }
        }
      }
      if (config.aiMode === 'real') {
        if (!quote?.confirmedAt || !quote.planKey || !quote.maxAttempts) error = 'QUOTE_CONFIRMATION_REQUIRED';
        else if (quote.provider !== config.generationProvider || quote.model !== config.generationModel || job.provider !== quote.provider || job.generationModel !== quote.model) error = 'QUOTE_PROVIDER_CHANGED';
        else if (!Number.isSafeInteger(config.maxRealGenerationsPerProduction) || attempts >= config.maxRealGenerationsPerProduction) error = 'COST_GUARD';
      }
      if (error) {
        job.status = transitionJobState(job.status, 'FAILED');
        job.errorCode = error; job.errorMessage = error;
        job.updatedAt = job.completedAt = new Date().toISOString();
        await repository.updateJob(projectId, job);
        return null;
      }
      job.status = transitionJobState(job.status, 'GENERATING');
      job.attempts += 1;
      job.progress = 25;
      job.updatedAt = new Date().toISOString();
      job.startedAt ||= job.updatedAt;
      job.completedAt = undefined;
      job.error = job.errorCode = job.errorMessage = job.userFriendlyMessage = undefined;
      job.provider = config.aiMode === 'real' ? config.generationProvider : 'mock';
      await repository.updateJob(projectId, job);
      return { project, job };
    } finally {
      release();
      if (this.reservations.get(projectId) === queued) this.reservations.delete(projectId);
    }
  }

  /**
   * Triggers asynchronous background execution of a project's jobs.
   * Resolves immediately without blocking the HTTP request.
   */
  static triggerRun(projectId: string, concurrency: number = DEFAULT_CONCURRENCY): void {
    if (this.activeRuns.has(projectId)) {
      console.log(`[JobRunner] Project ${projectId} is already running.`);
      return;
    }

    this.activeRuns.add(projectId);
    console.log(`[JobRunner] Starting background execution for project ${projectId} (concurrency: ${concurrency})...`);

    // Asynchronous non-blocking launch
    (async () => {
      try {
        await this.runProject(projectId, concurrency);
      } catch (err) {
        console.error(`[JobRunner] Unexpected error during project execution ${projectId}:`, err);
      } finally {
        this.activeRuns.delete(projectId);
        console.log(`[JobRunner] Finished execution run for project ${projectId}.`);
      }
    })();
  }

  /**
   * Main execution loop with concurrency control.
   */
  static async runProject(projectId: string, concurrency: number): Promise<void> {
    const repository = getProjectRepository();

    // Check stuck jobs first
    await this.recoverStuckJobs(projectId);

    let hasMoreJobs = true;

    while (hasMoreJobs) {
      const project = await repository.getById(projectId);
      if (!project) {
        console.error(`[JobRunner] Project ${projectId} not found.`);
        return;
      }

      // Pick pending jobs
      const queuedJobs = project.jobs.filter((j) => j.status === 'QUEUED').sort((a,b) => a.attempts - b.attempts);
      if (queuedJobs.length === 0) {
        hasMoreJobs = false;
        break;
      }

      // Take batch up to concurrency limit
      const currentBatch = queuedJobs.slice(0, Math.max(1, Math.min(4, Math.floor(concurrency) || 1)));

      // Process batch in parallel
      await Promise.all(
        currentBatch.map(async (job) => {
          await this.executeJob(projectId, job.id);
        })
      );
    }

    // Update actualCost snapshot when all batches finish
    const finalProject = await repository.getById(projectId);
    if (finalProject) {
      const approvedCount = finalProject.jobs.filter((j) => Boolean(j.outputAsset)).length;
      const failedCount = finalProject.jobs.filter((j) => j.status === 'FAILED' || j.status === 'REJECTED').length;
      const totalAttempts = finalProject.jobs.reduce((sum, j) => sum + (j.attempts || 0), 0);

      finalProject.actualCost = {
        estimatedUsd: finalProject.pricingSnapshot?.estimatedTotalCostUsd ?? null,
        actualUsd: null,
        generatedImages: approvedCount,
        failedImages: failedCount,
        attemptsCount: totalAttempts,
        billableRequestsCount: totalAttempts,
      };

      let projectStatus = finalProject.status;
      const allApproved = finalProject.jobs.length > 0 && finalProject.jobs.every((j) => j.status === 'APPROVED' || j.status === 'COMPLETED');
      const anyApproved = finalProject.jobs.some((j) => j.status === 'APPROVED' || j.status === 'COMPLETED');
      const allFailed = finalProject.jobs.length > 0 && finalProject.jobs.every((j) => j.status === 'FAILED' || j.status === 'REJECTED' || j.status === 'CANCELLED');

      if (allApproved) {
        projectStatus = 'COMPLETED';
      } else if (allFailed) {
        projectStatus = 'FAILED';
      } else if (anyApproved) {
        projectStatus = 'PARTIAL';
      }

      await repository.update(projectId, { actualCost: finalProject.actualCost, status: projectStatus });
    }
  }

  /**
   * Executes a single GenerationJob with strict lifecycle stages.
   */
  static async executeJob(projectId: string, jobId: string): Promise<void> {
    const key = projectId + '/' + jobId;
    if (this.activeJobs.has(key)) return;
    this.activeJobs.add(key);
    try { await this.executeReservedJob(projectId, jobId); }
    finally { this.activeJobs.delete(key); }
  }

  private static async executeReservedJob(projectId: string, jobId: string): Promise<void> {
    const reserved = await this.reserve(projectId, jobId);
    if (!reserved) return;
    const { project, job } = reserved;
    const repository = getProjectRepository();
    const garment = job.garmentLock || project.garment;
    const variant = project.garment.colorVariants.find(v => v.id === job.colorVariantId);
    let provider: ReturnType<typeof getImageGenerationProvider>;

    // 1. Strict Model Lock validation: prevent any silent fallback
    if (!project.model || !project.model.modelId) {
      const errMsg = 'MODEL_LOCK_REQUIRED: El proyecto no tiene un modelo humano seleccionado o su ID es inválido.';
      job.status = transitionJobState(job.status, 'FAILED');
      job.errorCode = 'MODEL_LOCK_REQUIRED';
      job.errorMessage = errMsg;
      job.userFriendlyMessage = 'Falta el modelo humano seleccionado para esta producción.';
      job.updatedAt = new Date().toISOString();
      job.completedAt = new Date().toISOString();
      await repository.updateJob(projectId, job);
      return;
    }

    // Resolve canonical Garment Master and approved anchor asset (if any)
    const master = job.garmentMaster || garment.garmentMaster || project.garment.garmentMaster;
    const anchorAsset = job.anchorAsset 
      || project.approvedAnchorAsset 
      || project.jobs.find(j => (j.status === 'APPROVED' || j.status === 'COMPLETED') && j.outputAsset)?.outputAsset;

    // 2. Generation step
    let generatedAsset;
    try {
      provider = getImageGenerationProvider();
      if (!variant) {
        throw new Error(`ColorVariant no encontrada para ID ${job.colorVariantId}`);
      }

      generatedAsset = await provider.generateImage({
        garmentLock: garment,
        colorVariant: variant,
        modelLock: project.model,
        productionStyle: job.productionStyle,
        shotView: job.shotView,
        referenceImages: garment.referenceImages,
        garmentMaster: master,
        anchorAsset,
        aspectRatio: job.aspectRatio, resolution: job.resolution,
      });

      if (!generatedAsset || !generatedAsset.url) {
        throw new Error('El proveedor no devolvió una imagen válida');
      }

      // Persist the primary image before QA; no thumbnail/export work is required here.
      if (getAiConfig().aiMode === 'real' && !generatedAsset.storageKey) {
        const bytes = await resolveImageBytes(generatedAsset);
        if (!bytes) throw new Error('No se pudo guardar la imagen generada.');
        const extension = bytes.mimeType.includes('png') ? 'png' : bytes.mimeType.includes('webp') ? 'webp' : 'jpg';
        const stored = await getImageStorage().put(job.id + '-' + job.attempts + '.' + extension, bytes.buffer, bytes.mimeType);
        generatedAsset = {...generatedAsset, ...stored, mimeType: bytes.mimeType, byteSize: bytes.buffer.length};
      }
      job.outputAsset = generatedAsset;
      job.outputUrl = generatedAsset.url;
      job.providerRequestId = generatedAsset.providerRequestId;
      job.garmentMaster = master;
      job.anchorAsset = anchorAsset;
      job.progress = 70;
      job.updatedAt = new Date().toISOString();

      // 3. Transition: GENERATING -> VALIDATING
      job.status = transitionJobState(job.status, 'VALIDATING');
      await repository.updateJob(projectId, job);
    } catch (genErr: unknown) {
      const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
      console.error(`[JobRunner] Error en generación de job ${jobId}:`, errMsg);

      const currentProject = await repository.getById(projectId);
      const currentJob = currentProject?.jobs.find((j) => j.id === jobId) || job;

      if (!isTerminalJobStatus(currentJob.status)) {
        const nextStatus = transitionJobState(currentJob.status, 'FAILED');
        currentJob.status = nextStatus;
        currentJob.errorCode = 'GENERATION_ERROR';
        currentJob.errorMessage = errMsg;
        currentJob.userFriendlyMessage = 'No pudimos crear esta foto. Revisá la conexión o reintentá.';
        currentJob.error = errMsg;
        currentJob.updatedAt = new Date().toISOString();
        currentJob.completedAt = new Date().toISOString();

        await repository.updateJob(projectId, currentJob);
      }
      return;
    }

    // 4. Validation step
    const sourceImageId = garment.referenceImages?.[0]?.sourceImageId || garment.referenceImages?.[0]?.id;
    const variantId = variant?.id || job.colorVariantId;
    const modelId = project.model?.modelId;
    const generatedAssetId = generatedAsset?.id;

    // Structured logging before validation (Requisito 1)
    console.error({
      jobId,
      projectId,
      sourceImageId,
      variantId,
      modelId,
      generatedAssetId,
      status: job.status,
    });

    try {
      // Validate IDs strictly (Requisito 2)
      if (!jobId || typeof jobId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(jobId)) {
        throw new Error('INVALID_JOB_ID');
      }
      if (!projectId || typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(projectId) || job.projectId !== projectId) {
        throw new Error('INVALID_PROJECT_ID');
      }
      if (!modelId || typeof modelId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(modelId)) {
        throw new Error('INVALID_MODEL_ID');
      }
      if (!sourceImageId || typeof sourceImageId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(sourceImageId) || !garment.referenceImages?.some(r => r.id === sourceImageId || r.sourceImageId === sourceImageId)) {
        throw new Error('INVALID_SOURCE_IMAGE_ID');
      }
      if (!variantId || typeof variantId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(variantId) || !project.garment.colorVariants?.some(v => v.id === variantId)) {
        throw new Error('INVALID_VARIANT_ID');
      }
      if (!generatedAssetId || typeof generatedAssetId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(generatedAssetId)) {
        throw new Error('INVALID_GENERATED_ASSET_ID');
      }

      const valRes = await provider.validateImage(generatedAsset, garment, {
        colorVariant: variant,
        modelLock: project.model,
        shotView: job.shotView,
        garmentMaster: master,
        anchorAsset,
      });
      const validationStatus = evaluateValidationStatus(valRes);

      const currentProjBeforeVal = await repository.getById(projectId);
      const freshJob = currentProjBeforeVal?.jobs.find((j) => j.id === jobId) || job;

      freshJob.validationScore = valRes;
      freshJob.referenceStatus = valRes.referenceStatus;
      freshJob.structuralFidelityScore = valRes.structuralFidelityScore;
      freshJob.criticalFaults = valRes.criticalFaults;
      freshJob.comprehensiveAudit = valRes.comprehensiveAudit;
      freshJob.progress = 100;
      freshJob.updatedAt = new Date().toISOString();
      freshJob.completedAt = new Date().toISOString();

      // Transition: VALIDATING -> APPROVED / REVIEW_REQUIRED / REJECTED
      const prevStatus = freshJob.status;
      freshJob.status = transitionJobState(freshJob.status, validationStatus);

      if (validationStatus === 'REJECTED') {
        freshJob.errorCode = 'VALIDATION_REJECTED';
        freshJob.errorMessage = (valRes.failedGates || []).join('; ') || 'No superó los criterios de fidelidad';
        freshJob.userFriendlyMessage = 'La imagen generada no cumple con la calidad o fidelidad exigida.';
      } else if (validationStatus === 'APPROVED') {
        // If the project doesn't have an approved anchor asset yet, designate this first approved asset as the anchor
        const currentProject = await repository.getById(projectId);
        if (currentProject && !currentProject.approvedAnchorAsset) {
          await repository.update(projectId, { approvedAnchorAsset: generatedAsset });
        }
      }

      await repository.updateJob(projectId, freshJob, prevStatus);

      if (validationStatus === 'REJECTED' && canAttemptRegeneration(freshJob.attempts)) {
        const latest = await repository.getById(projectId);
        const config = getAiConfig();
        const used = latest?.jobs.reduce((sum, item) => sum + item.attempts, 0) || 0;
        const quote = project.pricingSnapshot;
        const attemptsLimit = quote?.maxAttempts 
          ? (config.aiMode === 'real' ? Math.min(config.maxRealGenerationsPerProduction, quote.maxAttempts) : quote.maxAttempts)
          : (config.aiMode === 'real' ? config.maxRealGenerationsPerProduction : Infinity);

        const costPerAttempt = (quote?.estimatedCostPerImageUsd ?? 0) + (quote?.estimatedValidationCostUsd && quote?.imageCount ? quote.estimatedValidationCostUsd / quote.imageCount : 0);
        const costExceeded = Boolean(quote?.maxEstimatedCostUsd && costPerAttempt > 0 && Number(((used + 1) * costPerAttempt).toFixed(4)) > quote.maxEstimatedCostUsd + 0.0001);

        if (used < attemptsLimit && !costExceeded) {
          freshJob.status = transitionJobState(freshJob.status, 'QUEUED');
          freshJob.progress = 0;
          await repository.updateJob(projectId, freshJob);
        }
      }
    } catch (valErr: unknown) {
      const errMsg = valErr instanceof Error ? valErr.message : String(valErr);
      console.error(`[JobRunner] Error en validación de job ${jobId}:`, errMsg);

      // Re-read fresh state from repository to avoid stale in-memory state (Requisito 4)
      const currentProject = await repository.getById(projectId);
      const currentJob = currentProject?.jobs.find((j) => j.id === jobId) || job;

      if (!isTerminalJobStatus(currentJob.status)) {
        const nextStatus = transitionJobState(currentJob.status, 'FAILED');
        currentJob.status = nextStatus;

        const knownSpecificErrors = [
          'INVALID_MODEL_ID',
          'INVALID_SOURCE_IMAGE_ID',
          'INVALID_VARIANT_ID',
          'INVALID_GENERATED_ASSET_ID',
          'INVALID_PROJECT_ID',
          'INVALID_JOB_ID',
          'VALIDATION_TIMEOUT',
        ];
        currentJob.errorCode = knownSpecificErrors.includes(errMsg) ? errMsg : 'VALIDATION_ERROR';
        currentJob.errorMessage = errMsg;
        currentJob.userFriendlyMessage = 'Error al validar la calidad de la foto generada.';
        currentJob.updatedAt = new Date().toISOString();
        currentJob.completedAt = new Date().toISOString();

        await repository.updateJob(projectId, currentJob);
      }
    }
  }

  /**
   * Stuck job watchdog: Detects jobs that were left in GENERATING or VALIDATING
   * longer than STUCK_JOB_TIMEOUT_MS and marks them FAILED to prevent infinite spinners.
   */
  static async recoverStuckJobs(projectId: string): Promise<number> {
    const repository = getProjectRepository();
    const project = await repository.getById(projectId);
    if (!project) return 0;

    let recoveredCount = 0;
    const now = Date.now();
    const config = getAiConfig();
    const thresholdMs = config.stuckJobTimeoutMs || STUCK_JOB_TIMEOUT_MS;

    for (const job of project.jobs) {
      if (this.activeJobs.has(projectId + '/' + job.id)) continue;
      if (job.status === 'GENERATING' || job.status === 'VALIDATING') {
        const lastUpdate = new Date(job.updatedAt || job.createdAt).getTime();
        if (now - lastUpdate > thresholdMs) {
          console.warn(`[JobRunner Watchdog] Stuck job detected: ${job.id} in state ${job.status} for ${(now - lastUpdate) / 1000}s`);

          const isValidation = job.status === 'VALIDATING';
          job.status = transitionJobState(job.status, 'FAILED');
          job.errorCode = isValidation ? 'VALIDATION_TIMEOUT' : 'STUCK_JOB_TIMEOUT';
          job.errorMessage = isValidation
            ? `Job superó el límite de espera en validación (${thresholdMs / 1000}s)`
            : `Job superó el límite de espera en generación (${thresholdMs / 1000}s)`;
          job.userFriendlyMessage = isValidation
            ? 'La validación tardó demasiado en responder. Podés reintentar esta toma.'
            : 'El generador tardó demasiado en responder. Podés reintentar esta toma.';
          job.updatedAt = new Date().toISOString();
          job.completedAt = new Date().toISOString();

          await repository.updateJob(projectId, job);
          recoveredCount++;
        }
      }
    }

    return recoveredCount;
  }

  /**
   * Computes a full status report for a given project.
   */
  static async getProjectStatus(projectId: string): Promise<RunnerStatus | null> {
    const repository = getProjectRepository();
    if (!await repository.getById(projectId)) return null;

    // Run quick watchdog sweep
    await this.recoverStuckJobs(projectId);

    // Read fresh project state
    const project = await repository.getById(projectId);
    if (!project) return null;

    const jobs = project.jobs;
    const queued = jobs.filter((j) => j.status === 'QUEUED' || (j.status as string) === 'PENDING').length;
    const generating = jobs.filter((j) => j.status === 'GENERATING' || j.status === 'PROCESSING').length;
    const validating = jobs.filter((j) => j.status === 'VALIDATING').length;
    const approved = jobs.filter((j) => j.status === 'APPROVED').length;
    const reviewRequired = jobs.filter((j) => j.status === 'REVIEW_REQUIRED').length;
    const rejected = jobs.filter((j) => j.status === 'REJECTED').length;
    const failed = jobs.filter((j) => j.status === 'FAILED').length;

    const activeJobs = queued + generating + validating;
    const completedJobs = approved + reviewRequired;
    const failedJobs = failed + rejected;

    let computedStatus: ProductionStatus = project.status;
    if (activeJobs === 0 && jobs.length > 0) {
      if (failedJobs > 0 && completedJobs < jobs.length) {
        computedStatus = completedJobs > 0 ? 'PARTIAL' : 'FAILED';
      } else if (completedJobs === jobs.length) {
        computedStatus = 'COMPLETED';
      }
    } else if (activeJobs > 0) {
      computedStatus = validating > 0 ? 'VALIDATING' : 'GENERATING';
    }

    if (project.status !== computedStatus) {
      project.status = computedStatus;
      await repository.update(projectId, { status: computedStatus });
    }

    const isCompleted = jobs.length > 0 && activeJobs === 0;

    return {
      projectId,
      status: computedStatus,
      totalJobs: jobs.length,
      completedJobs,
      failedJobs,
      activeJobs,
      queued,
      generating,
      validating,
      approved,
      reviewRequired,
      rejected,
      failed,
      isCompleted,
      jobs: jobs.map((j) => ({
        ...j,
        id: j.id,
        status: j.status,
        errorCode: j.errorCode,
        errorMessage: j.errorMessage,
      })),
    };
  }
}
