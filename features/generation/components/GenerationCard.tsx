'use client';

import React from 'react';
import { GenerationJob } from '@/types';
import { VisualScore } from '@/components/VisualScore';
import { 
  Check, 
  RotateCw, 
  Maximize2, 
  Download, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  XCircle
} from 'lucide-react';

interface GenerationCardProps {
  job: GenerationJob;
  onApprove: (jobId: string) => void;
  onRegenerate: (jobId: string) => void;
  onOpenModal: (job: GenerationJob) => void;
  isProcessing?: boolean;
}

export function GenerationCard({
  job,
  onApprove,
  onRegenerate,
  onOpenModal,
  isProcessing = false,
}: GenerationCardProps) {
  const isGenerating = job.status === 'GENERATING' || job.status === 'QUEUED';
  const isValidating = job.status === 'VALIDATING';
  const isReviewRequired = job.status === 'REVIEW_REQUIRED';
  const isRejected = job.status === 'REJECTED';

  return (
    <div className="rounded-xl border border-[#1e2230] bg-[#11131a] overflow-hidden flex flex-col group hover:border-gray-700 transition-all">
      {/* Card Header */}
      <div className="px-3.5 py-2.5 border-b border-[#1e2230] bg-[#090a0f] flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-200 tracking-tight truncate">
          {job.label}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
            job.productionStyle === 'STUDIO_WHITE'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
          }`}
        >
          {job.productionStyle === 'STUDIO_WHITE' ? 'Mercado Libre' : 'Catálogo'}
        </span>
      </div>

      {/* Visual Canvas */}
      <div className="relative aspect-[3/4] w-full bg-black/80 flex items-center justify-center overflow-hidden">
        {job.outputUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.outputUrl}
              alt={job.label}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            />

            {/* Overlay action to expand */}
            <button
              type="button"
              onClick={() => onOpenModal(job)}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-white/80 hover:text-white hover:bg-black/90 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
              title="Ver en grande"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {job.validationScore && (
              <div className="absolute bottom-2 left-2">
                <VisualScore score={job.validationScore} compact />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-gray-500">
            {isGenerating ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-purple-400 mb-2" />
                <span className="text-xs text-gray-300 font-medium">Generando toma con IA...</span>
                <span className="text-[10px] text-gray-500 mt-1">Preservando Garment Lock & Color</span>
              </>
            ) : isValidating ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mb-2" />
                <span className="text-xs text-gray-300 font-medium">Validando consistencia visual...</span>
                <span className="text-[10px] text-gray-500 mt-1">Verificando fidelidad y mirada a cámara</span>
              </>
            ) : (
              <span className="text-xs text-gray-500">En espera de producción</span>
            )}
          </div>
        )}

        {/* Status banners */}
        {job.status === 'APPROVED' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-500/90 text-white font-mono text-[10px] flex items-center gap-1 shadow-md">
            <CheckCircle2 className="w-3 h-3" />
            <span>APROBADA</span>
          </div>
        )}

        {isReviewRequired && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-amber-500/90 text-black font-mono text-[10px] flex items-center gap-1 shadow-md font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>REVISAR (75-89%)</span>
          </div>
        )}

        {isRejected && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-600/90 text-white font-mono text-[10px] flex items-center gap-1 shadow-md font-bold">
            <XCircle className="w-3 h-3" />
            <span>RECHAZADA (&lt;75%)</span>
          </div>
        )}
      </div>

      {/* Consistency breakdown if available */}
      {job.validationScore && (
        <div className="p-3 border-t border-[#1e2230] bg-[#090a0f]">
          <VisualScore score={job.validationScore} />
        </div>
      )}

      {/* Card Actions */}
      <div className="p-3 bg-[#11131a] border-t border-[#1e2230] flex items-center justify-between gap-2 mt-auto">
        {job.status !== 'APPROVED' ? (
          <button
            type="button"
            onClick={() => onApprove(job.id)}
            disabled={isProcessing || !job.outputUrl}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Aprobar</span>
          </button>
        ) : (
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 pl-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Aprobada</span>
          </span>
        )}

        <button
          type="button"
          onClick={() => onRegenerate(job.id)}
          disabled={isProcessing}
          className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161923] hover:bg-[#1e2230] disabled:opacity-40 text-gray-300 text-xs font-medium border border-[#232736] transition-colors"
          title="Regenerar fotografía (máx. 3 intentos)"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Regenerar ({job.attempts}/3)</span>
        </button>

        {job.outputUrl && (
          <a
            href={job.outputUrl}
            download={`${job.label}.jpg`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg bg-[#161923] hover:bg-[#1e2230] text-gray-300 hover:text-white border border-[#232736] transition-colors"
            title="Descargar fotografía"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
