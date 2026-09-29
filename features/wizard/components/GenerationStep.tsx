'use client';

import React from 'react';
import { GenerationProgressItem } from '../models/wizard.types';
import { 
  Sparkles, 
  Check, 
  Loader2, 
  Camera 
} from 'lucide-react';

interface GenerationStepProps {
  progressItems: GenerationProgressItem[];
  currentOverallStatus: string;
  failedCount?: number;
  onRetryFailed?: () => void;
  onViewResults?: () => void;
}

export function GenerationStep({
  progressItems,
  currentOverallStatus,
  failedCount = 0,
  onRetryFailed,
  onViewResults,
}: GenerationStepProps) {
  const totalGenerations = progressItems.reduce((acc, p) => acc + p.totalCount, 0);
  const completedGenerations = progressItems.reduce((acc, p) => acc + p.completedCount, 0);
  const percentage = totalGenerations > 0 ? Math.round((completedGenerations / totalGenerations) * 100) : 0;
  const isFinished = totalGenerations > 0 && completedGenerations + failedCount >= totalGenerations;

  return (
    <div className="space-y-8 max-w-3xl mx-auto py-8 animate-fade-in">
      {/* Top Friendly Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
          {isFinished ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 animate-spin text-blue-400" />
          )}
          <span>{isFinished ? 'Producción Finalizada' : 'Producción en Curso'}</span>
        </div>

        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          {isFinished ? '¡Tus fotos están listas!' : 'Creando tus fotos comerciales...'}
        </h2>
        <p className="text-sm text-gray-400">
          {currentOverallStatus || 'Generando vistas de frente, costado y espalda'}
        </p>

        {/* Global Progress Bar */}
        <div className="max-w-md mx-auto pt-2">
          <div className="w-full bg-[#1e2230] h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFinished ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 mt-1 font-mono">
            <span>{completedGenerations} de {totalGenerations} fotos</span>
            <span>{percentage}%</span>
          </div>
        </div>

        {isFinished && onViewResults && (
          <div className="pt-2">
            <button
              onClick={onViewResults}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-lg shadow-blue-600/30"
            >
              Ver Galería Completa
            </button>
          </div>
        )}
      </div>

      {/* Failure alert card if any photo failed */}
      {failedCount > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-sm font-semibold text-red-300 block">
              No se pudo completar la generación: {failedCount} {failedCount === 1 ? 'toma falló' : 'tomas fallaron'}
            </span>
            <span className="text-xs text-gray-400">
              {currentOverallStatus || 'Revisá los códigos de error o reintentá las tomas fallidas.'}
            </span>
          </div>
          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-medium border border-red-500/30 transition-colors"
            >
              Reintentar fotos faltantes
            </button>
          )}
        </div>
      )}

      {/* Progress Breakdown by Colorway */}
      <div className="space-y-4">
        {progressItems.map((item) => {
          const isDone = item.completedCount >= item.totalCount;

          return (
            <div
              key={item.colorId}
              className="p-5 rounded-3xl bg-[#11131c] border border-[#1e2230] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-inner"
                    style={{ backgroundColor: item.colorHex }}
                  />
                  <div>
                    <span className="text-sm font-bold text-white block">
                      {item.colorName}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {['Frente', 'Costado', 'Espalda', 'Acción'].slice(0, item.totalCount).map((shotName, sIdx) => {
                        const isShotDone = sIdx < item.completedCount;
                        const isGenerating = sIdx === item.completedCount && !isDone;
                        return (
                          <span
                            key={shotName}
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              isShotDone
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : isGenerating
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                                : 'bg-[#161925] text-gray-500'
                            }`}
                          >
                            {isShotDone ? '✓' : isGenerating ? '⏳' : '○'} {shotName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white">
                    {item.completedCount}/{item.totalCount}
                  </span>
                  {isDone ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  ) : (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                </div>
              </div>

              {/* Emerging Thumbnails immediately upon approval */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {Array.from({ length: item.totalCount }).map((_, idx) => {
                  const thumb = item.completedThumbnails[idx];

                  return (
                    <div
                      key={idx}
                      className="aspect-[3/4] rounded-xl overflow-hidden bg-[#090a0f] border border-[#1e2230] relative flex items-center justify-center"
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt="preview"
                          className="w-full h-full object-cover animate-fade-in"
                        />
                      ) : (
                        <Camera className="w-4 h-4 text-gray-700 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
