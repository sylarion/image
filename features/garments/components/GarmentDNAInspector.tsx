'use client';

import React, { useState } from 'react';
import { GarmentDNA, DNAChangeLog, GarmentInvariant } from '@/types/dna';
import { DNAVersioningService } from '@/lib/dna/versioning';
import { 
  Dna, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Edit3, 
  Check, 
  Layers, 
  Scissors, 
  Sparkles,
  History,
  FileCheck
} from 'lucide-react';

interface GarmentDNAInspectorProps {
  initialDNA: GarmentDNA;
  onDNAChange?: (updatedDNA: GarmentDNA) => void;
}

export function GarmentDNAInspector({
  initialDNA,
  onDNAChange,
}: GarmentDNAInspectorProps) {
  const [dna, setDna] = useState<GarmentDNA>(initialDNA);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'STRUCTURE' | 'INVARIANTS' | 'EVIDENCE' | 'CONFLICTS' | 'AUDIT'>('STRUCTURE');

  const handleStartEdit = (fieldPath: string, currentValue: unknown) => {
    setEditingField(fieldPath);
    setTempValue(String(currentValue ?? ''));
  };

  const handleSaveEdit = (fieldPath: string) => {
    let parsedValue: unknown = tempValue;
    if (tempValue.toLowerCase() === 'true') parsedValue = true;
    else if (tempValue.toLowerCase() === 'false') parsedValue = false;
    else if (!isNaN(Number(tempValue)) && tempValue.trim() !== '') parsedValue = Number(tempValue);

    const { updatedDNA } = DNAVersioningService.applyUpdate(dna, {
      property: fieldPath,
      newValue: parsedValue,
      source: 'USER',
      reason: `Corrección manual de usuario para el campo ${fieldPath}`,
    });

    setDna(updatedDNA);
    setEditingField(null);
    onDNAChange?.(updatedDNA);
  };

  const renderStatusBadge = (status?: string, confidence?: number) => {
    const isVerified = status === 'VERIFIED';
    const isUnknown = status === 'UNKNOWN';
    const isConflict = status === 'CONFLICT';

    return (
      <div className="flex items-center gap-1.5">
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            isVerified
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : isConflict
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              : isUnknown
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          }`}
        >
          {status || 'VERIFIED'}
        </span>
        {confidence !== undefined && (
          <span className="text-[10px] text-gray-500 font-mono">
            {(confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl bg-[#0d0f17] border border-[#1e2230] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Dna className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                Inspector y Bloqueo Estructural: GARMENT_DNA (Fase C)
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                v{dna.version}
              </span>
            </div>
            <p className="text-xs text-[#8e96aa]">
              Identidad física invariable del producto. Toda modificación manual genera una versión inmutable con ChangeLog auditado.
            </p>
          </div>
        </div>

        {/* Global Confidence & Conflicts summary */}
        <div className="flex items-center gap-3">
          {dna.conflicts.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{dna.conflicts.length} Conflicto(s)</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141724] border border-[#232738] text-xs font-mono text-gray-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Confianza Global: {(dna.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1e2230] pb-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('STRUCTURE')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'STRUCTURE'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>Estructura Textil</span>
        </button>
        <button
          onClick={() => setActiveTab('INVARIANTS')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'INVARIANTS'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Reglas Inmutables ({dna.immutableRules.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('EVIDENCE')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'EVIDENCE'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Evidencia Visual ({dna.evidence.length})</span>
        </button>
        {dna.conflicts.length > 0 && (
          <button
            onClick={() => setActiveTab('CONFLICTS')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'CONFLICTS'
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                : 'text-rose-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Conflictos ({dna.conflicts.length})</span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'AUDIT'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Trail ({dna.auditTrail.length})</span>
        </button>
      </div>

      {/* Tab 1: Structure */}
      {activeTab === 'STRUCTURE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Moldería & Silueta */}
          <div className="p-4 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <span className="text-xs font-semibold text-gray-300">Silueta y Calce</span>
              {renderStatusBadge(dna.silhouette.status, dna.silhouette.confidence)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Tipo:</span>
              {editingField === 'silhouette.type' ? (
                <div className="flex items-center gap-1">
                  <input
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="bg-[#090a0f] border border-indigo-500 rounded px-1.5 py-0.5 text-white w-24 text-xs font-mono"
                  />
                  <button onClick={() => handleSaveEdit('silhouette.type')} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-white">
                  <span>{dna.silhouette.type}</span>
                  <button onClick={() => handleStartEdit('silhouette.type', dna.silhouette.type)} className="text-gray-500 hover:text-indigo-400">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card: Escote / Neckline */}
          <div className="p-4 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <span className="text-xs font-semibold text-gray-300">Escote / Cuello</span>
              {renderStatusBadge(dna.neckline.status, dna.neckline.confidence)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Tipo:</span>
              {editingField === 'neckline.type' ? (
                <div className="flex items-center gap-1">
                  <input
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="bg-[#090a0f] border border-indigo-500 rounded px-1.5 py-0.5 text-white w-28 text-xs font-mono"
                  />
                  <button onClick={() => handleSaveEdit('neckline.type')} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-white">
                  <span>{dna.neckline.type}</span>
                  <button onClick={() => handleStartEdit('neckline.type', dna.neckline.type)} className="text-gray-500 hover:text-indigo-400">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Profundidad:</span>
              <span className="font-mono text-gray-300">{dna.neckline.depth}</span>
            </div>
          </div>

          {/* Card: Mangas / Sleeves */}
          <div className="p-4 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <span className="text-xs font-semibold text-gray-300">Mangas</span>
              {renderStatusBadge(dna.sleeves.status, dna.sleeves.confidence)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Presencia:</span>
              <span className="font-mono text-white">{dna.sleeves.present ? 'Con mangas' : 'Sin mangas (Sleeveless)'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Largo:</span>
              <span className="font-mono text-gray-300">{dna.sleeves.length || 'SLEEVELESS'}</span>
            </div>
          </div>

          {/* Card: Botones / Buttons (CRITICAL) */}
          <div className="p-4 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <span className="text-xs font-semibold text-gray-300">Botones (Invariante Hard)</span>
              {renderStatusBadge(dna.buttons.status, dna.buttons.confidence)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Cantidad exacta:</span>
              {editingField === 'buttons.count' ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="bg-[#090a0f] border border-indigo-500 rounded px-1.5 py-0.5 text-white w-16 text-xs font-mono"
                  />
                  <button onClick={() => handleSaveEdit('buttons.count')} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                  <span>{dna.buttons.count ?? 'Sin botones'}</span>
                  <button onClick={() => handleStartEdit('buttons.count', dna.buttons.count)} className="text-gray-500 hover:text-indigo-400">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Disposición:</span>
              <span className="font-mono text-gray-300">{dna.buttons.placement.join(', ') || 'N/A'}</span>
            </div>
          </div>

          {/* Card: Bolsillos / Pockets */}
          <div className="p-4 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <span className="text-xs font-semibold text-gray-300">Bolsillos</span>
              {renderStatusBadge(dna.pockets.status, dna.pockets.confidence)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Cantidad:</span>
              {editingField === 'pockets.count' ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="bg-[#090a0f] border border-indigo-500 rounded px-1.5 py-0.5 text-white w-16 text-xs font-mono"
                  />
                  <button onClick={() => handleSaveEdit('pockets.count')} className="text-emerald-400 hover:text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-mono text-white font-bold">
                  <span>{dna.pockets.count ?? 0}</span>
                  <button onClick={() => handleStartEdit('pockets.count', dna.pockets.count)} className="text-gray-500 hover:text-indigo-400">
                    <Edit3 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Ubicación:</span>
              <span className="font-mono text-gray-300">{dna.pockets.placement.join(', ') || 'Sin bolsillos'}</span>
            </div>
          </div>

          {/* Card: Cierres / Closures */}
          <div className="p-4 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-3">
            <div className="flex items-center justify-between border-b border-[#1e2230] pb-2">
              <span className="text-xs font-semibold text-gray-300">Cierres y Acceso</span>
              {renderStatusBadge(dna.closures.status, dna.closures.confidence)}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Tipo:</span>
              <span className="font-mono text-gray-300">{dna.closures.types.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Ubicación:</span>
              <span className="font-mono text-gray-300">{dna.closures.placements.join(', ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Invariants */}
      {activeTab === 'INVARIANTS' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#8e96aa] pb-1">
            <span>Reglas estructurales extraídas para el validador (HARD gates innegociables)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dna.immutableRules.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-xl bg-[#11131c] border border-[#1e2230] flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">{inv.property}</span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                        inv.severity === 'HARD'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {inv.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{inv.reason || 'Regla derivada de evidencia visual'}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold font-mono text-emerald-400 block">
                    {String(inv.expectedValue)}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    {(inv.confidence * 100).toFixed(0)}% conf
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Visual Evidence */}
      {activeTab === 'EVIDENCE' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dna.evidence.map((ev, idx) => (
              <div
                key={`${ev.referenceId}-${idx}`}
                className="p-3.5 rounded-xl bg-[#11131c] border border-[#1e2230] space-y-2"
              >
                <div className="flex items-center justify-between border-b border-[#1e2230] pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-semibold">
                      {ev.role}
                    </span>
                    <span className="text-xs font-mono text-gray-300 truncate max-w-[160px]">
                      {ev.referenceId}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {(ev.confidence * 100).toFixed(0)}% conf
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block mb-1">Propiedades respaldadas:</span>
                  <div className="flex flex-wrap gap-1">
                    {ev.supports.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded bg-[#090a0f] border border-[#232738] text-[10px] font-mono text-gray-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Conflicts */}
      {activeTab === 'CONFLICTS' && (
        <div className="space-y-3">
          {dna.conflicts.map((conf, idx) => (
            <div
              key={`${conf.property}-${idx}`}
              className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-bold text-white font-mono">{conf.property}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                  {conf.severity} CONFLICT
                </span>
              </div>
              <p className="text-xs text-rose-200">{conf.notes}</p>
              <div className="space-y-1">
                <span className="text-[11px] text-gray-400 block">Observaciones encontradas:</span>
                <div className="grid grid-cols-2 gap-2">
                  {conf.observations.map((obs, oIdx) => (
                    <div
                      key={oIdx}
                      className="p-2 rounded bg-black/40 border border-rose-500/20 text-xs font-mono"
                    >
                      <span className="text-gray-400 block text-[10px]">{obs.role} ({obs.referenceId}):</span>
                      <span className="text-white font-bold">{String(obs.observedValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Audit Trail */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-3">
          {dna.auditTrail.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 font-mono">
              No existen modificaciones registradas. El DNA se encuentra en su versión base inicial (v1).
            </div>
          ) : (
            <div className="space-y-2">
              {dna.auditTrail.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#11131c] border border-[#1e2230] flex items-center justify-between gap-4 text-xs font-mono"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-400 font-bold">{log.property}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400">{log.reason || 'Modificación manual'}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {new Date(log.createdAt).toLocaleString()} por {log.source}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 line-through">{String(log.previousValue)}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-emerald-400 font-bold">{String(log.newValue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
