'use client';

import React from 'react';
import { GenerationJob } from '@/types';
import { VisualScore } from '@/components/VisualScore';
import { 
  X, 
  Check, 
  RotateCw, 
  Download, 
  CheckCircle2, 
  Sparkles
} from 'lucide-react';

interface ImageModalProps {
  job: GenerationJob | null;
  onClose: () => void;
  onApprove: (jobId: string) => void;
  onRegenerate: (jobId: string) => void;
}

export function ImageModal({ job, onClose, onApprove, onRegenerate }: ImageModalProps) {
  if (!job || !job.outputUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl rounded-2xl bg-[#11131a] border border-[#1e2230] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-gray-300 hover:text-white hover:bg-black/90 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Preview Area */}
        <div className="flex-1 bg-black/95 flex items-center justify-center p-4 min-h-[300px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={job.outputUrl}
            alt={job.label}
            className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg"
          />
        </div>

        {/* Sidebar Info & Controls */}
        <div className="w-full md:w-80 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#1e2230] bg-[#090a0f] space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {job.productionStyle || 'STUDIO_WHITE'}
              </span>
              <h3 className="text-lg font-bold text-white mt-1.5">{job.label}</h3>
              <p className="text-xs text-[#8e96aa] mt-0.5">
                Generado con iluminación de estudio preservando los detalles del Garment Lock.
              </p>
            </div>

            {/* Consistency Validation Box */}
            {job.validationScore && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-300">Auditoría de Consistencia</span>
                <VisualScore score={job.validationScore} />
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#11131a] border border-[#1e2230] text-xs text-gray-400 space-y-1">
              <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Model Lock Verificado</span>
              </div>
              <p className="text-[11px] text-[#8e96aa]">
                Fisionomía, tono de piel y postura alineados con el arquetipo de modelo fijado.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-4 border-t border-[#1e2230]">
            {job.status !== 'APPROVED' ? (
              <button
                type="button"
                onClick={() => {
                  onApprove(job.id);
                  onClose();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Aprobar Fotografía</span>
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-xs flex items-center justify-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Fotografía Aprobada</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onRegenerate(job.id);
                  onClose();
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#161923] hover:bg-[#1e2230] text-gray-200 text-xs font-medium border border-[#232736] transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Regenerar</span>
              </button>

              <a
                href={job.outputUrl}
                download={`${job.label}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#161923] hover:bg-[#1e2230] text-gray-200 text-xs font-medium border border-[#232736] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
