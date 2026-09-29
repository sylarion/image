import { notFound } from 'next/navigation';
import { getRuntimeAIStatus } from '@/lib/ai/config';
import { getAnalysisRunRepository } from '@/lib/storage/analysis-run.repository';
import { getProjectRepository } from '@/lib/storage/project.repository';
import { SceneAnalysisInspector } from '@/features/garments/components/SceneAnalysisInspector';

export const dynamic = 'force-dynamic';

export default async function AdminDebugInspectorPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const runRepo = getAnalysisRunRepository();
  const latestRun = await runRepo.getLatest();
  const projectRepo = getProjectRepository();
  const allProjects = await projectRepo.getAll();
  const latestProject = allProjects[0] || null;

  let pipelineResult = null;
  if (latestRun) {
    pipelineResult = {
      analyses: latestRun.analyses,
      crops: latestRun.crops,
      productGroups: latestRun.productGroups,
      observedVariants: latestRun.observedVariants,
      observability: {
        sceneAnalysisLatencyMs: latestRun.executionMetrics.totalDurationMs,
        detectedGarmentsCount: latestRun.executionMetrics.detectionCount,
        detectedVariantsCount: latestRun.executionMetrics.finalVariantsCount,
        bboxAverageConfidence: latestRun.detections.length ? latestRun.detections.reduce((n,d)=>n+d.confidence,0)/latestRun.detections.length : 0,
        groupingAverageConfidence: latestRun.productGroups.length ? latestRun.productGroups.reduce((n,g)=>n+g.confidence,0)/latestRun.productGroups.length : 0,
        roleAverageConfidence: latestRun.analyses.length ? latestRun.analyses.reduce((n,a)=>n+a.confidence,0)/latestRun.analyses.length : 0,
        colorAverageConfidence: latestRun.detections.length ? latestRun.detections.reduce((n,d)=>n+d.dominantColor.confidence,0)/latestRun.detections.length : 0,
        cropsCreatedCount: latestRun.executionMetrics.cropsCount,
        segmentationFallbacksCount: 0,
      },
      analysisRun: latestRun,
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="border-b border-[#1e2230] pb-4">
        <h1 className="text-xl font-bold text-white font-mono">
          [ADMIN / DEBUG] Technical Vision & Generation Run Inspector
        </h1>
        <p className="text-xs text-gray-400">
          Esta vista es interna para ingeniería y control de calidad. Muestra el motor en ejecución (REAL vs MOCK), pipeline de visión, y tabla de trazabilidad de GenerationJobs.
        </p>
      </div>

      <pre className="text-xs overflow-auto bg-[#11131c] p-4 rounded-xl border border-[#1e2230]">{JSON.stringify(getRuntimeAIStatus(), null, 2)}</pre>

      {/* PRICING & COST AUDIT (Requirement 26) */}
      {latestProject && (
        <div className="p-6 rounded-2xl bg-[#11131c] border border-[#1e2230] space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              PRICING & COST AUDIT — {latestProject.id}
            </h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Snapshot: {latestProject.pricingSnapshot?.quoteId || 'LEGACY_NO_SNAPSHOT'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">Provider / Model</span>
              <span className="text-sm font-bold text-white truncate block">
                {latestProject.pricingSnapshot?.provider || 'default'} / {latestProject.pricingSnapshot?.model || 'default'}
              </span>
              <span className="text-[10px] text-gray-500 block capitalize">
                Tier: {latestProject.pricingSnapshot?.qualityProfile || 'standard'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">Cost / Image</span>
              <span className="text-sm font-bold text-emerald-400">
                {latestProject.pricingSnapshot?.estimatedCostPerImageUsd !== null && latestProject.pricingSnapshot?.estimatedCostPerImageUsd !== undefined
                  ? `USD ${latestProject.pricingSnapshot.estimatedCostPerImageUsd.toFixed(2)}`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-gray-500 block">
                {latestProject.pricingSnapshot?.imageCount || latestProject.jobs.length} images
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">Estimated Total</span>
              <span className="text-sm font-bold text-white">
                {latestProject.pricingSnapshot?.estimatedTotalCostUsd !== null && latestProject.pricingSnapshot?.estimatedTotalCostUsd !== undefined
                  ? `USD ${latestProject.pricingSnapshot.estimatedTotalCostUsd.toFixed(2)}`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-gray-500 block">
                Gen: ${latestProject.pricingSnapshot?.estimatedGenerationCostUsd ?? 0} | Val: ${latestProject.pricingSnapshot?.estimatedValidationCostUsd ?? 0}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">Actual / Retry Cost</span>
              <span className="text-sm font-bold text-blue-300">
                {latestProject.actualCost?.actualUsd !== null && latestProject.actualCost?.actualUsd !== undefined
                  ? `USD ${latestProject.actualCost.actualUsd.toFixed(2)}`
                  : 'Ledger: Unmetered (local/mock)'}
              </span>
              <span className="text-[10px] text-gray-500 block">
                {latestProject.actualCost?.attemptsCount ?? 0} attempts / {latestProject.actualCost?.billableRequestsCount ?? 0} billable
              </span>
            </div>
          </div>
        </div>
      )}

      {/* GENERATION RUN DIAGNOSTICS */}
      {latestProject && (
        <div className="p-6 rounded-2xl bg-[#11131c] border border-[#1e2230] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              GENERATION RUN — {latestProject.name} ({latestProject.id})
            </h2>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Status: {latestProject.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">Total</span>
              <span className="text-lg font-bold text-white">{latestProject.jobs.length}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">QUEUED</span>
              <span className="text-lg font-bold text-amber-400">{latestProject.jobs.filter(j=>j.status==='QUEUED').length}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">GENERATING</span>
              <span className="text-lg font-bold text-blue-400">{latestProject.jobs.filter(j=>j.status==='GENERATING').length}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">VALIDATING</span>
              <span className="text-lg font-bold text-purple-400">{latestProject.jobs.filter(j=>j.status==='VALIDATING').length}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">APPROVED</span>
              <span className="text-lg font-bold text-emerald-400">{latestProject.jobs.filter(j=>j.status==='APPROVED').length}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#161925] border border-[#232738]">
              <span className="text-gray-400 block">FAILED</span>
              <span className="text-lg font-bold text-red-400">{latestProject.jobs.filter(j=>j.status==='FAILED').length}</span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#232738] text-gray-400">
                  <th className="py-2 px-3">Job ID</th>
                  <th className="py-2 px-3">Color</th>
                  <th className="py-2 px-3">Shot</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Attempt</th>
                  <th className="py-2 px-3">Provider</th>
                  <th className="py-2 px-3">Req ID</th>
                  <th className="py-2 px-3">Score</th>
                  <th className="py-2 px-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2230]">
                {latestProject.jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#161925]">
                    <td className="py-2 px-3 text-gray-300 truncate max-w-[120px]">{job.id}</td>
                    <td className="py-2 px-3 text-white font-medium">{job.colorName}</td>
                    <td className="py-2 px-3 text-blue-300">{job.shotView}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                        job.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                        job.status === 'GENERATING' ? 'bg-blue-500/20 text-blue-300 animate-pulse' :
                        job.status === 'VALIDATING' ? 'bg-purple-500/20 text-purple-300' :
                        job.status === 'FAILED' ? 'bg-red-500/20 text-red-300' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-400">{job.attempts}</td>
                    <td className="py-2 px-3 text-gray-300">{job.provider || '-'}</td>
                    <td className="py-2 px-3 text-gray-400 truncate max-w-[100px]">{job.providerRequestId || '-'}</td>
                    <td className="py-2 px-3 text-gray-300">{job.validationScore?.overallScore ? `${job.validationScore.overallScore}%` : '-'}</td>
                    <td className="py-2 px-3 text-red-400 truncate max-w-[160px]">{job.errorMessage || job.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <details><summary className="text-xs text-gray-400 cursor-pointer font-mono">Ver trace completo / raw analysis data</summary><pre className="text-xs overflow-auto mt-2 bg-[#11131c] p-4 rounded-xl border border-[#1e2230]">{JSON.stringify(latestRun, null, 2)}</pre></details>
      {pipelineResult ? (
        <SceneAnalysisInspector 
          pipelineResult={pipelineResult} 
          analysisRun={latestRun || pipelineResult.analysisRun}
        />
      ) : (
        <div className="p-8 rounded-2xl bg-[#11131c] border border-[#1e2230] text-center text-sm text-gray-400">
          No hay análisis registrados todavía. Subí una fotografía en el asistente para ver la inspección técnica completa en vivo.
        </div>
      )}
    </div>
  );
}

