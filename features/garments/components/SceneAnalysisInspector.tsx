'use client';

import React, { useState } from 'react';
import { 
  SceneAnalysisPipelineResult, 
  ProductGroup, 
  GarmentCrop, 
  GarmentReference,
  AnalysisRun,
  ObservedVariant
} from '@/types';
import { 
  Layers, 
  Palette, 
  Eye, 
  Sliders, 
  Check, 
  ShieldCheck, 
  Activity,
  Dna,
  Cpu,
  Hash
} from 'lucide-react';
import { GarmentDNAInspector } from './GarmentDNAInspector';
import { GarmentDNA } from '@/types/dna';

interface SceneAnalysisInspectorProps {
  pipelineResult: SceneAnalysisPipelineResult;
  analysisRun?: AnalysisRun;
  onUpdateGroups?: (updatedGroups: ProductGroup[]) => void;
}

export function SceneAnalysisInspector({
  pipelineResult,
  analysisRun,
  onUpdateGroups,
}: SceneAnalysisInspectorProps) {
  const [productGroups, setProductGroups] = useState<ProductGroup[]>(
    pipelineResult.productGroups
  );
  const [activeCropId, setActiveCropId] = useState<string | null>(
    pipelineResult.crops[0]?.id || null
  );

  const run = analysisRun || pipelineResult.analysisRun;
  const observedVariants: ObservedVariant[] = pipelineResult.observedVariants || run?.observedVariants || [];

  const cropsMap = new Map<string, GarmentCrop>();
  for (const c of pipelineResult.crops) {
    cropsMap.set(c.id, c);
  }

  const handleRoleChange = (refId: string, newRole: GarmentReference['role']) => {
    const updated = productGroups.map((group) => ({
      ...group,
      references: group.references.map((ref) =>
        ref.id === refId ? { ...ref, role: newRole } : ref
      ),
    }));
    setProductGroups(updated);
    onUpdateGroups?.(updated);
  };

  const handleColorChange = (
    groupId: string,
    variantId: string,
    canonicalName: string,
    hex: string
  ) => {
    const updated = productGroups.map((group) => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        variants: group.variants.map((v) =>
          v.id === variantId
            ? { ...v, color: { ...v.color, canonicalName, observedName: canonicalName, hex } }
            : v
        ),
      };
    });
    setProductGroups(updated);
    onUpdateGroups?.(updated);
  };

  const { observability } = pipelineResult;
  const originalImage = run?.sourceImages?.[0];
  const allDetections = pipelineResult.analyses.flatMap((a) => a.garments);

  return (
    <div className="rounded-2xl bg-[#11131a] border border-[#1e2230] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Inspector Visual de Detección de Prendas y Variantes (Fase B)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                PÍXELES REALES
              </span>
            </div>
            <p className="text-xs text-[#8e96aa]">
              Bounding boxes, recortes físicos independientes por color y asignación de Product Identity vs Variant Identity.
            </p>
          </div>
        </div>

        {/* Observability Badge */}
        <div className="flex items-center gap-2 bg-[#090a0f] border border-[#1e2230] px-3 py-1.5 rounded-xl text-xs text-gray-300 font-mono">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>Latencia: {observability.sceneAnalysisLatencyMs}ms</span>
          <span>•</span>
          <span>Confianza: {(observability.bboxAverageConfidence * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Runtime Engine Diagnostic Bar */}
      <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1e2230] grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-mono">
        <div>
          <span className="text-gray-500 block text-[10px] uppercase font-semibold">Analysis Mode</span>
          <span className={`font-bold text-sm ${run?.mode === 'REAL' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {run?.mode || 'MOCK'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase font-semibold">Visual Provider</span>
          <span className="text-white font-bold text-sm">{run?.provider || 'Gemini'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase font-semibold">Fallback Used</span>
          <span className={`font-bold text-sm ${run?.fallbackUsed ? 'text-amber-400' : 'text-emerald-400'}`}>
            {run?.fallbackUsed ? 'YES' : 'NO'}
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase font-semibold">Detections / Crops</span>
          <span className="text-blue-400 font-bold text-sm">
            {allDetections.length} det / {pipelineResult.crops.length} crops
          </span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px] uppercase font-semibold">Trace ID</span>
          <span className="text-purple-400 font-bold text-xs truncate block" title={run?.analysisRunId}>
            {run?.analysisRunId || 'ar_local'}
          </span>
        </div>
      </div>

      {/* Sanity Check & Conflict Diagnostic */}
      {run?.sanityCheck && (
        <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${
          run.sanityCheck.passed
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span className="font-bold">
              {run.sanityCheck.passed ? 'Sanity Check: CONCILIACIÓN EXITOSA' : 'Sanity Check: CONFLICTO DETECTADO'}
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="text-gray-300">
              {run.sanityCheck.instanceCount} prendas físicas → {run.sanityCheck.cropCount} crops → {run.sanityCheck.productGroupCount} grupo(s) → {run.sanityCheck.variantCount} variante(s)
            </span>
          </div>
          {run.sanityCheck.conflicts.length > 0 && (
            <div className="space-y-1">
              {run.sanityCheck.conflicts.map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-red-900/40 text-red-200 border border-red-500/40 font-bold block text-[10px]">
                  {c.code}: {c.message}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bounding Box Visualizer on Original Image */}
      {originalImage && (
        <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1e2230] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span>Imagen Original & Cajas Delimitadoras (Bounding Boxes)</span>
            </span>
            <span className="text-[11px] text-gray-500 font-mono">
              {originalImage.width}x{originalImage.height}px • {allDetections.length} prendas detectadas
            </span>
          </div>

          <div className="relative max-w-2xl mx-auto rounded-xl overflow-hidden border border-[#232738] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={originalImage.url}
              alt="Original catalog"
              className="w-full h-auto object-contain block"
            />
            {allDetections.map((det, idx) => {
              const b = det.boundingBox;
              return (
                <div
                  key={det.detectionId}
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.width * 100}%`,
                    height: `${b.height * 100}%`,
                  }}
                  className="absolute border-2 border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/25 transition-all cursor-pointer flex flex-col justify-between p-1"
                >
                  <span className="text-[10px] bg-black/80 text-emerald-300 font-mono px-1 rounded self-start font-bold">
                    #{idx + 1} {det.dominantColor.name}
                  </span>
                  <span className="text-[9px] bg-black/70 text-gray-300 font-mono px-1 rounded self-end">
                    {(det.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Main Grid: Crops & Dominant Color Analysis + Product Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Crops & Detections List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Recortes Físicos Detectados ({pipelineResult.crops.length})</span>
            </span>
            <span className="text-[11px] text-[#8e96aa]">
              Sharp.extract() sin filtros
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {pipelineResult.crops.map((crop) => {
              const isSelected = activeCropId === crop.id;
              return (
                <div
                  key={crop.id}
                  onClick={() => setActiveCropId(crop.id)}
                  className={`p-2 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#161923] border-blue-500 ring-1 ring-blue-500 shadow-md'
                      : 'bg-[#090a0f] border-[#1e2230] hover:border-gray-700'
                  }`}
                >
                  <div className="aspect-[3/4] w-full bg-black/60 rounded-lg overflow-hidden relative mb-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={crop.url}
                      alt={crop.id}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                      {crop.width}x{crop.height}px
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-300 font-mono truncate">
                    {crop.id.split('-').slice(0, 3).join('-')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ObservedVariants Layer */}
          {observedVariants.length > 0 && (
            <div className="p-3 rounded-xl bg-[#090a0f] border border-[#1e2230] space-y-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block font-mono">
                ObservedVariant Layer ({observedVariants.length} observaciones físicas)
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {observedVariants.map((obs) => (
                  <div
                    key={obs.detectionId}
                    className="p-1.5 rounded-lg bg-[#11131a] border border-[#1e2230] flex items-center justify-between text-[11px] font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: obs.observedColor.rawHex }}
                      />
                      <span className="text-white font-bold">{obs.observedColor.semanticName}</span>
                      <span className="text-gray-400">{obs.observedColor.rawHex}</span>
                    </div>
                    <div className="text-gray-500 text-[10px]">
                      LAB: [{obs.observedColor.lab.join(', ')}]
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Right Col: Product Grouping & Variant Hierarchy */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Estructura de Dominio: Product Groups & Variants</span>
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">
              {productGroups.length} Producto(s) / {observability.detectedVariantsCount} Variante(s)
            </span>
          </div>

          <div className="space-y-4">
            {productGroups.map((group) => (
              <div
                key={group.id}
                className="p-4 rounded-xl bg-[#090a0f] border border-[#1e2230] space-y-3"
              >
                {/* Product Group Header */}
                <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
                  <div>
                    <span className="text-xs font-mono text-purple-400 block font-semibold">
                      PRODUCT IDENTITY
                    </span>
                    <h4 className="text-sm font-bold text-white">{group.name}</h4>
                  </div>
                  <div className="text-right text-[11px] text-[#8e96aa] font-mono">
                    <span>{group.visualSignature.silhouette}</span> •{' '}
                    <span>{group.visualSignature.neckline}</span> •{' '}
                    <span>{group.visualSignature.sleeveType}</span>
                  </div>
                </div>

                {/* Variants in this Product Group */}
                <div className="space-y-2">
                  <span className="text-[11px] text-gray-400 font-medium block">
                    Variantes de Color Identificadas (Misma moldería, diferente tono):
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.variants.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-lg bg-[#11131a] border border-[#1e2230] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-inner"
                            style={{ backgroundColor: v.color.hex }}
                          />
                          <div>
                            <span className="text-xs font-semibold text-white block">
                              {v.color.canonicalName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {v.color.hex} • {(v.color.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                        </div>

                        {/* Quick Color Tweak */}
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={v.color.hex}
                            onChange={(e) =>
                              handleColorChange(
                                group.id,
                                v.id,
                                v.color.canonicalName,
                                e.target.value
                              )
                            }
                            className="w-6 h-6 rounded cursor-pointer border border-[#232736] bg-transparent"
                            title="Ajustar color visual"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reference Set (Visual Roles) */}
                <div className="pt-2 border-t border-[#1e2230] space-y-2">
                  <span className="text-[11px] text-gray-400 font-medium block">
                    Reference Set (Clasificación Visual de Vistas):
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {group.references.map((ref) => (
                      <div
                        key={ref.id}
                        className="px-2.5 py-1.5 rounded-lg bg-[#161923] border border-[#232736] flex items-center gap-2 text-xs"
                      >
                        <span className="font-mono text-gray-300">
                          {ref.id.split('-').slice(0, 2).join('-')}
                        </span>

                        <select
                          value={ref.role}
                          onChange={(e) =>
                            handleRoleChange(
                              ref.id,
                              e.target.value as GarmentReference['role']
                            )
                          }
                          className="bg-[#090a0f] border border-[#232736] rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                        >
                          <option value="FRONT">FRONT</option>
                          <option value="BACK">BACK</option>
                          <option value="SIDE">SIDE</option>
                          <option value="DETAIL">DETAIL</option>
                          <option value="SWATCH">SWATCH</option>
                          <option value="UNKNOWN">UNKNOWN</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Garment DNA Inspector (Phase C) */}
                {group.garmentDNA && (
                  <div className="pt-3 border-t border-[#1e2230]">
                    <GarmentDNAInspector
                      initialDNA={group.garmentDNA}
                      onDNAChange={(updatedDNA) => {
                        const updated = productGroups.map((g) =>
                          g.id === group.id ? { ...g, garmentDNA: updatedDNA } : g
                        );
                        setProductGroups(updated);
                        onUpdateGroups?.(updated);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
