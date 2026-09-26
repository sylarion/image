'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Project, GarmentLock, ModelLock, ProductionPackageSelection, GenerationJob } from '@/types';
import { StatusBadge } from '@/components/StatusBadge';
import { GarmentLockCard } from '@/features/garments/components/GarmentLockCard';
import { ModelLockSelector } from '@/features/generation/components/ModelLockSelector';
import { ProductionPackageSelector } from '@/features/generation/components/ProductionPackageSelector';
import { GenerationCard } from '@/features/generation/components/GenerationCard';
import { ImageModal } from '@/features/generation/components/ImageModal';
import { ResultsGallery } from '@/features/gallery/components/ResultsGallery';
import { 
  ArrowLeft, 
  Sparkles, 
  Play, 
  Loader2, 
  Layers, 
  LayoutGrid, 
  SlidersHorizontal,
  CheckCircle,
  AlertCircle,
  Palette
} from 'lucide-react';

interface ProductionDetailViewProps {
  initialProject: Project;
}

export function ProductionDetailView({ initialProject }: ProductionDetailViewProps) {
  const [project, setProject] = useState<Project>({
    ...initialProject,
    garment: {
      ...initialProject.garment,
      colorVariants: initialProject.garment.colorVariants || [],
      details: initialProject.garment.details || [],
      mustPreserve: initialProject.garment.mustPreserve || [],
    },
    jobs: initialProject.jobs || [],
  });
  const [activeTab, setActiveTab] = useState<'SETUP' | 'PRODUCTION' | 'GALLERY'>(
    initialProject.jobs?.length > 0 ? 'PRODUCTION' : 'SETUP'
  );
  
  // Selected Color Tab for viewing generation jobs
  const [selectedColorId, setSelectedColorId] = useState<string>(
    initialProject.garment.colorVariants?.[0]?.id || 'col-black'
  );

  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [modalJob, setModalJob] = useState<GenerationJob | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Garment Lock & Color Variants update
  const handleUpdateGarment = async (updatedGarment: GarmentLock) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garment: updatedGarment }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.data);
        showNotification('Ficha técnica y variantes de color actualizadas');
      }
    } catch {
      showNotification('Error al guardar Garment Lock', 'error');
    }
  };

  // Model Lock update
  const handleSelectModel = async (selectedModel: ModelLock) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.data);
        showNotification(`Modelo única bloqueada para toda la producción: ${selectedModel.name}`);
      }
    } catch {
      showNotification('Error al actualizar Model Lock', 'error');
    }
  };

  // Package selection update
  const handleUpdatePackages = async (packages: ProductionPackageSelection) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedPackages: packages }),
      });
      const data = await res.json();
      if (data.success) {
        setProject(data.data);
      }
    } catch {
      showNotification('Error al actualizar paquetes', 'error');
    }
  };

  // Batch generate all jobs according to matrix
  const handleGenerateAll = async () => {
    try {
      setIsGeneratingAll(true);
      setActiveTab('PRODUCTION');

      const res = await fetch(`/api/projects/${project.id}/generate-all`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al generar producción');
      }

      setProject(data.data);
      showNotification(`¡Matriz producida exitosamente! (${data.data.jobs.length} fotografías generadas)`);
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Error al generar', 'error');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Job single action: Approve
  const handleApproveJob = async (jobId: string) => {
    try {
      setProcessingJobId(jobId);
      const res = await fetch(`/api/projects/${project.id}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'APPROVE' }),
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev) => ({
          ...prev,
          jobs: prev.jobs.map((j) => (j.id === jobId ? data.data : j)),
        }));
        showNotification('Fotografía aprobada');
      }
    } catch {
      showNotification('Error al aprobar fotografía', 'error');
    } finally {
      setProcessingJobId(null);
    }
  };

  // Job single action: Regenerate
  const handleRegenerateJob = async (jobId: string) => {
    try {
      setProcessingJobId(jobId);
      showNotification('Regenerando toma con variación de pose...');
      const res = await fetch(`/api/projects/${project.id}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'REGENERATE' }),
      });
      const data = await res.json();
      if (data.success) {
        setProject((prev) => ({
          ...prev,
          jobs: prev.jobs.map((j) => (j.id === jobId ? data.data : j)),
        }));
        showNotification('Nueva toma generada');
      }
    } catch {
      showNotification('Error al regenerar fotografía', 'error');
    } finally {
      setProcessingJobId(null);
    }
  };

  const colorVariantsList = project.garment.colorVariants || [];
  const selectedColors = colorVariantsList.filter((v) => v.selected);
  const activeSetsCount = (project.selectedPackages?.studioWhite ? 1 : 0) + (project.selectedPackages?.editorialCatalog ? 1 : 0);
  const totalExpectedPhotos = selectedColors.length * 4 * activeSetsCount;
  const completedCount = (project.jobs || []).filter((j) => j.status === 'APPROVED').length;

  const studioWhiteCurrentJobs = project.jobs.filter(
    (j) => j.colorVariantId === selectedColorId && j.productionStyle === 'STUDIO_WHITE'
  );
  const editorialCatalogCurrentJobs = project.jobs.filter(
    (j) => j.colorVariantId === selectedColorId && j.productionStyle === 'EDITORIAL_CATALOG'
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Breadcrumb & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-[#11131a] hover:bg-[#161923] border border-[#1e2230] text-gray-400 hover:text-white transition-colors"
            title="Volver a producciones"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8e96aa] mt-0.5">
              <span>{selectedColors.length} colores activos</span>
              <span>•</span>
              <span>Modelo única: <strong>{project.model.name}</strong></span>
              <span>•</span>
              <span>Talles: <strong>{project.garment.sizes.join(', ')}</strong></span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono border border-blue-500/30 bg-blue-500/10 text-blue-400">
                Motor: {process.env.NEXT_PUBLIC_AI_MODE === 'real' ? 'Real AI (Gemini + Fal)' : 'Simulación (Mock)'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Production Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || selectedColors.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium text-sm shadow-xl shadow-blue-500/20 active:scale-98 transition-all cursor-pointer"
          >
            {isGeneratingAll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando Matriz ({totalExpectedPhotos} fotos)...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {project.jobs.length > 0
                    ? `Regenerar Matriz (${totalExpectedPhotos} fotos)`
                    : `Generar Producción (${totalExpectedPhotos} fotos)`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border animate-fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#1e2230] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('SETUP')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'SETUP'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          <span>Configuración & Colores ({selectedColors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PRODUCTION')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PRODUCTION'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-400" />
          <span>Producción por Color ({project.jobs.length}/{totalExpectedPhotos})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('GALLERY')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'GALLERY'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4 text-emerald-400" />
          <span>Galería & Descargas ({completedCount})</span>
        </button>
      </div>

      {/* Tab 1: Setup & Locks */}
      {activeTab === 'SETUP' && (
        <div className="space-y-8 animate-fade-in">
          {/* Garment Lock & Color Variants */}
          <GarmentLockCard
            garment={project.garment}
            onUpdate={handleUpdateGarment}
          />

          {/* Model Lock Component */}
          <ModelLockSelector
            selectedModel={project.model}
            onSelectModel={handleSelectModel}
          />

          {/* Production Packages Selection with Matrix Calculator */}
          <ProductionPackageSelector
            selection={project.selectedPackages}
            colorCount={selectedColors.length}
            onChange={handleUpdatePackages}
          />

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={handleGenerateAll}
              disabled={isGeneratingAll || selectedColors.length === 0}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Confirmar y Producir {totalExpectedPhotos} Fotografías</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Production Matrix by Color */}
      {activeTab === 'PRODUCTION' && (
        <div className="space-y-6 animate-fade-in">
          {/* Color Selector Tabs (Navigation by Color Variant) */}
          <div className="p-3 rounded-2xl bg-[#11131a] border border-[#1e2230] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-gray-400 font-medium px-2 flex items-center gap-1.5 shrink-0">
                <Palette className="w-3.5 h-3.5 text-blue-400" />
                <span>Color:</span>
              </span>

              {selectedColors.map((color) => {
                const isCurrent = color.id === selectedColorId;
                const jobsForColor = project.jobs.filter((j) => j.colorVariantId === color.id);
                const approvedCount = jobsForColor.filter((j) => j.status === 'APPROVED').length;

                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setSelectedColorId(color.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-1 ring-blue-400'
                        : 'bg-[#161923] hover:bg-[#1e2230] text-gray-300 border border-[#232736]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/20"
                      style={{ backgroundColor: color.approximateHex }}
                    />
                    <span>{color.name}</span>
                    {jobsForColor.length > 0 && (
                      <span className="text-[10px] px-1 rounded bg-black/40 font-mono">
                        {approvedCount}/{jobsForColor.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <span className="text-xs font-mono text-gray-400">
              Total Producción: {completedCount} de {project.jobs.length} aprobadas
            </span>
          </div>

          {project.jobs.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[#1e2230] bg-[#11131a]/50">
              <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Producción en espera</h3>
              <p className="text-sm text-[#8e96aa] max-w-md mx-auto mt-1 mb-6">
                Tenés {selectedColors.length} colores configurados. Al presionar iniciar se sintetizarán automáticamente las 4 vistas canónicas para Mercado Libre y Catálogo ({totalExpectedPhotos} fotografías).
              </p>
              <button
                type="button"
                onClick={handleGenerateAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Generar {totalExpectedPhotos} fotos ahora</span>
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* SET 1: MERCADO LIBRE / E-COMMERCE (STUDIO_WHITE) */}
              {project.selectedPackages.studioWhite && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                        MERCADO LIBRE / E-COMMERCE — Fondo Blanco Puro
                      </h3>
                    </div>
                    <span className="text-xs text-[#8e96aa]">4 tomas canónicas • Mirada a cámara</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {studioWhiteCurrentJobs.map((job) => (
                      <GenerationCard
                        key={job.id}
                        job={job}
                        onApprove={handleApproveJob}
                        onRegenerate={handleRegenerateJob}
                        onOpenModal={setModalJob}
                        isProcessing={processingJobId === job.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SET 2: CATÁLOGO PREMIUM (EDITORIAL_CATALOG) */}
              {project.selectedPackages.editorialCatalog && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                        CATÁLOGO PREMIUM — Dirección Editorial
                      </h3>
                    </div>
                    <span className="text-xs text-[#8e96aa]">4 tomas de campaña • Ambientación cuidada</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {editorialCatalogCurrentJobs.map((job) => (
                      <GenerationCard
                        key={job.id}
                        job={job}
                        onApprove={handleApproveJob}
                        onRegenerate={handleRegenerateJob}
                        onOpenModal={setModalJob}
                        isProcessing={processingJobId === job.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Results Gallery */}
      {activeTab === 'GALLERY' && (
        <div className="animate-fade-in">
          <ResultsGallery
            jobs={project.jobs}
            onRegenerate={handleRegenerateJob}
            onOpenModal={setModalJob}
          />
        </div>
      )}

      {/* Modal Viewer */}
      <ImageModal
        job={modalJob}
        onClose={() => setModalJob(null)}
        onApprove={handleApproveJob}
        onRegenerate={handleRegenerateJob}
      />
    </div>
  );
}
