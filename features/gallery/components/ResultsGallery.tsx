'use client';

import React, { useState } from 'react';
import { GenerationJob } from '@/types';
import { 
  Download, 
  RotateCw, 
  CheckSquare, 
  Square, 
  Filter, 
  Check, 
  Maximize2 
} from 'lucide-react';
import { VisualScore } from '@/components/VisualScore';

interface ResultsGalleryProps {
  jobs: GenerationJob[];
  onRegenerate: (jobId: string) => void;
  onOpenModal: (job: GenerationJob) => void;
}

type StyleFilter = 'ALL' | 'STUDIO_WHITE' | 'EDITORIAL_CATALOG' | 'APPROVED' | 'REVIEW';

export function ResultsGallery({
  jobs,
  onRegenerate,
  onOpenModal,
}: ResultsGalleryProps) {
  const [filter, setFilter] = useState<StyleFilter>('ALL');
  const [colorFilter, setColorFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  // Extract unique color names present in jobs
  const availableColors = Array.from(new Set(jobs.map((j) => j.colorName)));

  const filteredJobs = jobs.filter((job) => {
    if (colorFilter !== 'ALL' && job.colorName !== colorFilter) return false;
    if (filter === 'STUDIO_WHITE') return job.productionStyle === 'STUDIO_WHITE';
    if (filter === 'EDITORIAL_CATALOG') return job.productionStyle === 'EDITORIAL_CATALOG';
    if (filter === 'APPROVED') return job.status === 'APPROVED';
    if (filter === 'REVIEW') {
      const score = job.validationScore?.overallScore ?? 100;
      return score < 90 || job.status === 'VALIDATING' || job.status === 'REVIEW_REQUIRED';
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filteredJobs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredJobs.map((j) => j.id));
    }
  };

  const handleDownloadSelected = () => {
    setDownloadSuccessMsg(`Descargando ${selectedIds.length} fotografías seleccionadas organizadas por color y set...`);
    setTimeout(() => setDownloadSuccessMsg(null), 3000);
  };

  const handleDownloadAll = () => {
    setDownloadSuccessMsg(`Generando archivo ZIP con las ${jobs.length} fotografías organizadas en /color/set/...`);
    setTimeout(() => setDownloadSuccessMsg(null), 3000);
  };

  return (
    <div className="rounded-2xl bg-[#11131a] border border-[#1e2230] p-6 space-y-6">
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">Galería de Resultados ({jobs.length} fotografías)</h3>
          <p className="text-xs text-[#8e96aa]">
            Organizadas por variante de color y set fotográfico con nomenclatura lista para producción.
          </p>
        </div>

        {/* Global Export Actions */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadSelected}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-md shadow-blue-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar seleccionadas ({selectedIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#161923] hover:bg-[#1e2230] text-gray-200 border border-[#232736] text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Todo en ZIP ({jobs.length})</span>
          </button>
        </div>
      </div>

      {downloadSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{downloadSuccessMsg}</span>
        </div>
      )}

      {/* Filter and Selection bar */}
      <div className="space-y-3">
        {/* Colors filter row */}
        {availableColors.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs pb-2 border-b border-[#1e2230]">
            <span className="text-[#8e96aa] mr-1">Filtrar por Color:</span>
            <button
              type="button"
              onClick={() => setColorFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                colorFilter === 'ALL'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#161923] text-gray-400 hover:text-white'
              }`}
            >
              Todos ({jobs.length})
            </button>
            {availableColors.map((colorName) => {
              const count = jobs.filter((j) => j.colorName === colorName).length;
              return (
                <button
                  key={colorName}
                  type="button"
                  onClick={() => setColorFilter(colorName)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    colorFilter === colorName
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#161923] text-gray-400 hover:text-white'
                  }`}
                >
                  {colorName} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Style & Status filter row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#8e96aa] mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Set / Estado:</span>
            </span>

            {(
              [
                { id: 'ALL', label: 'Todos los sets' },
                { id: 'STUDIO_WHITE', label: 'Mercado Libre' },
                { id: 'EDITORIAL_CATALOG', label: 'Catálogo' },
                { id: 'APPROVED', label: 'Aprobadas' },
                { id: 'REVIEW', label: 'En Revisión' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === item.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-[#161923] text-gray-400 hover:text-white hover:bg-[#1e2230]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5"
          >
            {selectedIds.length === filteredJobs.length && filteredJobs.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-blue-400" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>Seleccionar visibles ({filteredJobs.length})</span>
          </button>
        </div>
      </div>

      {/* Gallery Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#1e2230] rounded-xl">
          <p className="text-sm text-gray-400">No hay fotografías que coincidan con estos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
          {filteredJobs.map((job) => {
            const isSelected = selectedIds.includes(job.id);

            return (
              <div
                key={job.id}
                className={`relative rounded-xl border bg-[#090a0f] overflow-hidden group transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-1 ring-blue-500'
                    : 'border-[#1e2230] hover:border-gray-700'
                }`}
              >
                {/* Select Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelect(job.id)}
                  className="absolute top-2 left-2 z-20 p-1.5 rounded-md bg-black/70 backdrop-blur-sm text-white hover:bg-black/90"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300" />
                  )}
                </button>

                {/* Enlarge Button */}
                <button
                  type="button"
                  onClick={() => onOpenModal(job)}
                  className="absolute top-2 right-2 z-20 p-1.5 rounded-md bg-black/70 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Ver en grande"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Image Canvas */}
                <div className="aspect-[3/4] w-full bg-black/70 relative">
                  {job.outputUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.outputUrl}
                      alt={job.label}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300 cursor-pointer"
                      onClick={() => onOpenModal(job)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                      Sin imagen
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/70 text-gray-200 backdrop-blur-sm">
                      {job.productionStyle === 'STUDIO_WHITE' ? 'Mercado Libre' : 'Catálogo'}
                    </span>
                    {job.validationScore && (
                      <VisualScore score={job.validationScore} compact />
                    )}
                  </div>
                </div>

                {/* Footer details */}
                <div className="p-3 bg-[#11131a] flex items-center justify-between gap-1">
                  <div className="truncate">
                    <span className="text-xs text-gray-200 font-medium block truncate">{job.colorName}</span>
                    <span className="text-[10px] text-[#8e96aa] block truncate">{job.shotView}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRegenerate(job.id)}
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
                      title="Regenerar"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    {job.outputUrl && (
                      <a
                        href={job.outputUrl}
                        download={`${job.label}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
                        title="Descargar"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
