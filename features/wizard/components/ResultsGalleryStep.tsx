'use client';

import React from 'react';
import { GenerationJob } from '@/types';
import { 
  Download, 
  RotateCw, 
  Sparkles, 
  CheckCircle2, 
  Sliders, 
  PlusCircle,
  ExternalLink 
} from 'lucide-react';

interface ResultsGalleryStepProps {
  jobs: GenerationJob[];
  onNewProduction: () => void;
  onRegenerateJob?: (jobId: string) => void;
}

export function ResultsGalleryStep({
  jobs,
  onNewProduction,
  onRegenerateJob,
}: ResultsGalleryStepProps) {
  // Group jobs by colorway
  const colorMap = new Map<string, { colorName: string; jobs: GenerationJob[] }>();

  for (const job of jobs) {
    const key = job.colorName || 'General';
    const existing = colorMap.get(key) || { colorName: key, jobs: [] };
    existing.jobs.push(job);
    colorMap.set(key, existing);
  }

  const handleDownloadAll = () => {
    // Open/download each valid asset
    jobs.forEach((j) => {
      const url = j.outputUrl || j.outputAsset?.url;
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${j.label || 'foto'}.webp`;
        link.target = '_blank';
        link.click();
      }
    });
  };

  const handleDownloadColor = (colorJobs: GenerationJob[]) => {
    colorJobs.forEach((j) => {
      const url = j.outputUrl || j.outputAsset?.url;
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${j.label || 'foto'}.webp`;
        link.target = '_blank';
        link.click();
      }
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Producción finalizada</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Tus fotos comerciales listas para publicar
          </h2>
          <p className="text-sm text-gray-400">
            Descargá el catálogo completo o por color con la resolución comercial máxima.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>Descargar todas ({jobs.length})</span>
          </button>

          <button
            onClick={onNewProduction}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#232738] hover:bg-[#161925] text-gray-300 font-semibold text-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nueva producción</span>
          </button>
        </div>
      </div>

      {/* Grouped Galleries by Color */}
      <div className="space-y-10">
        {Array.from(colorMap.values()).map(({ colorName, jobs: colorJobs }) => (
          <div key={colorName} className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-500 border border-white/20 shadow-inner" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                  {colorName}
                </h3>
                <span className="text-xs text-gray-400 font-mono">
                  ({colorJobs.length} fotos)
                </span>
              </div>

              <button
                onClick={() => handleDownloadColor(colorJobs)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar este color</span>
              </button>
            </div>

            {/* Shots Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {colorJobs.map((job) => {
                const imgUrl = job.outputUrl || job.outputAsset?.url;
                return (
                  <div
                    key={job.id}
                    className="group rounded-2xl bg-[#11131c] border border-[#1e2230] overflow-hidden p-2 space-y-2"
                  >
                    <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-black/60 relative">
                      {imgUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imgUrl}
                          alt={job.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}

                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-white">
                        {job.shotView}
                      </div>

                      {/* Quick Hover Download Action */}
                      {imgUrl && (
                        <a
                          href={imgUrl}
                          download={`${job.label}.webp`}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute bottom-2 right-2 p-2 rounded-xl bg-black/80 hover:bg-blue-600 text-white opacity-0 group-hover:opacity-100 transition-all shadow-md"
                          title="Descargar imagen"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-gray-300 font-medium truncate max-w-[120px]">
                        {job.shotView === 'FRONT' ? 'Frente' : job.shotView === 'BACK' ? 'Espalda' : job.shotView === 'SIDE' ? 'Costado' : 'Movimiento'}
                      </span>

                      {onRegenerateJob && (
                        <button
                          onClick={() => onRegenerateJob(job.id)}
                          className="text-[11px] text-gray-500 hover:text-indigo-400 flex items-center gap-1"
                          title="Regenerar esta foto"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
