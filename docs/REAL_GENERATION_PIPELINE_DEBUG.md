# REAL GENERATION PIPELINE DEBUG & AUDIT REPORT

## 1. Executive Summary & Root Cause Analysis

### The 0 de 20 fotos (0%) Root Cause
In the previous wizard implementation, after users completed step 4 (Summary confirmation):
1. The frontend executed `POST /api/projects`, successfully persisting the project along with its 20 `GenerationJob` objects.
2. In the persisted project file (`.catalog-data/projects/proj-3a2d4a54-e9e4-4590-bc1b-52371db6604d.json`), all 20 jobs were initialized with `status: "QUEUED"`, `progress: 0`, and `attempts: 0`.
3. **The Disconnect:** No background runner, dispatcher, or worker was ever triggered. The frontend called `setIsCreating(false)` and statically set the UI message to `"20 fotos preparadas. Producción guardada."` while leaving `completedCount: 0`. There was no polling loop to fetch job progression, and in `app/api/projects/[id]/generate-all/route.ts`, lines 28–39 returned early without executing any job.
4. **Local Path Incompatibility with Fal.ai:** Furthermore, `FalImageGenerator` passed local relative URLs (e.g. `/uploads/crop-ar_...png`) directly in the HTTP payload to cloud provider Fal.ai, which cannot fetch localhost endpoints.

---

## 2. Real Production Trace

A forensic trace of the last stored production confirmed:

| Diagnostic Metric | Value |
| :--- | :--- |
| **Production ID** | `proj-3a2d4a54-e9e4-4590-bc1b-52371db6604d` |
| **Creation Timestamp** | `2026-09-28T13:12:13.782Z` |
| **Garment Name** | Remera de morley estampada |
| **Expected Jobs** | 20 (5 colorways $\times$ 4 shots: FRONT, SIDE, BACK, ACTION) |
| **Actual Jobs in DB** | 20 |
| **Initial States** | 20 `QUEUED` / 0 `GENERATING` / 0 `APPROVED` / 0 `FAILED` |
| **Attempts** | 0 on all 20 jobs |
| **Failure Mode** | **Scenario 1:** Dispatcher never initiated execution; frontend lacked background polling. |

---

## 3. Architecture & Implementation Decisions

### A. Decoupled Asynchronous Execution (`GenerationJobRunner`)
- **Route:** `POST /api/projects` creates the project and jobs in `READY` status, immediately invokes `GenerationJobRunner.triggerRun(saved.id, concurrency)` in a detached async scope, and responds with HTTP `201 Created` without waiting for the generation batch.
- The creation HTTP request **never** blocks waiting for 20 external AI generation calls.

### B. Controlled Concurrency Pool (`lib/ai/job-runner.ts`)
- Configurable concurrency pool (default `concurrency = 2`, max `4`).
- Picks `QUEUED` jobs, executes generation + multimodal validation, persists state before and after every network call, and continues until all queued jobs finish.
- The JSON repository serializes writes per project and per file. Without that lock, concurrent workers could overwrite each other's job state, which reproduced as partial completion during the 20-job test on Windows.

### C. Strict Finite State Machine & Watchdog Protection
- Lifecycle: `QUEUED` $\to$ `GENERATING` $\to$ `VALIDATING` $\to$ `APPROVED` / `REVIEW_REQUIRED` / `REJECTED` / `FAILED`.
- Any unhandled exception or provider timeout transitions the job cleanly to `FAILED` with explicit `errorCode`, `errorMessage`, and user-friendly copy (`"No pudimos crear esta foto. Reintentar"`).
- **Stuck Job Watchdog (`recoverStuckJobs`):** Jobs in `GENERATING` or `VALIDATING` for longer than 90 seconds are automatically terminated with `errorCode: "STUCK_JOB_TIMEOUT"`, eliminating indefinite spinners.

### D. Cloud Compatibility for Fal.ai (`lib/ai/fal-generator.ts`)
- Local crop paths (`/uploads/crop-...`) are dynamically resolved into base64 Data URIs (`data:image/png;base64,...`) before submission.
- An explicit 60-second `AbortController` timeout enforces failure if Fal.ai queue hangs.

### E. Frontend Polling & Progressive Thumbnails
- **Endpoint:** `GET /api/projects/[id]/status` returns full breakdown (`totalJobs`, `queued`, `generating`, `validating`, `approved`, `rejected`, `failed`, `isCompleted`, and `jobs`).
- `VisualProductionWizard.tsx` polls `/status` every 2000ms while on the `GENERATION` step.
- Thumbnails appear immediately as individual jobs reach `APPROVED` without waiting for the full batch of 20 photos.
- Replaced ambiguous copy *"20 fotos preparadas"* with unambiguous *"20 fotos programadas"* and dynamic status messages.

---

## 4. Test Verification Matrix

| Test Suite | Purpose | Result |
| :--- | :--- | :--- |
| **State Machine Transitions** | Legal transitions enforced, illegal shortcuts throw `JobStateTransitionError` | **PASS** |
| **Attempt Limiter** | Caps retries at `MAX_GENERATION_ATTEMPTS = 3` | **PASS** |
| **Test A: 1 variant $\times$ 1 FRONT** | Single image smoke test (`QUEUED` $\to$ `GENERATING` $\to$ `VALIDATING` $\to$ `APPROVED`) | **PASS** |
| **Test D: 5 variants $\times$ 4 shots** | 20 jobs processed through concurrency pool, 0 remain queued, 100% finished | **PASS** |
| **Stuck Job Watchdog** | Recovers abandoned jobs after threshold and marks `FAILED` with retry option | **PASS** |
| **Regression Suite** | Mock/unit suites, including the runner's 1-job, 20-job and watchdog cases | Run as `npm test` |
| **Production Build** | Type and Next production-build verification | Run as `npm run build` |

---

## 5. Runtime AI Provider Configuration Check

```json
{
  "mode": "MOCK",
  "analysisProvider": "mock",
  "validationProvider": "gemini",
  "analysisModel": "gemini-2.5-flash",
  "validationModel": "gemini-2.5-flash",
  "apiKeyConfigured": "not validated by mock mode",
  "fallbackUsed": false
}
```

The configured runtime is `AI_MODE=mock`. The real-provider acceptance test is deliberately separate (`npm run test:real`) and reports **BLOCKED** unless real mode plus the Gemini and Fal configuration gates are present; it must not be counted as a pass. Presence of an environment value alone does not prove that either provider can perform the catalog run.

## 6. Current Readiness

- The audited persisted project proves the original 0/20 cause: all 20 exact jobs were stored `QUEUED` with zero attempts and no dispatcher was started.
- Mock runtime validation now completes the 20-job matrix through the two-worker pool, with persisted state transitions and stuck-job recovery.
- A missing or failing provider ends a job in `FAILED` with a retry path; it does not silently approve a mock image in real mode.
- **Real catalog production is not yet accepted.** It requires real provider credentials and a browser acceptance run against the selected catalog image. The detached in-process runner is appropriate for this local runtime; deployment across serverless restarts requires a durable queue/worker before claiming durable production execution.
