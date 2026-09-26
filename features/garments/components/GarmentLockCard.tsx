'use client';

import React, { useState } from 'react';
import { GarmentLock, ColorVariant } from '@/types';
import { 
  ShieldCheck, 
  Edit3, 
  Check, 
  Plus, 
  X,
  Palette,
  Scissors,
  BookmarkCheck,
  CheckSquare,
  Square,
  Eye
} from 'lucide-react';

interface GarmentLockCardProps {
  garment: GarmentLock;
  onUpdate: (updated: GarmentLock) => void;
}

export function GarmentLockCard({ garment, onUpdate }: GarmentLockCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [prevGarment, setPrevGarment] = useState(garment);
  const [data, setData] = useState<GarmentLock>({
    ...garment,
    colorVariants: garment.colorVariants || [],
    details: garment.details || [],
    mustPreserve: garment.mustPreserve || [],
  });

  // Adjust state during render when prop changes (React recommended pattern for state derived from props)
  if (garment !== prevGarment) {
    setPrevGarment(garment);
    setData({
      ...garment,
      colorVariants: garment.colorVariants || [],
      details: garment.details || [],
      mustPreserve: garment.mustPreserve || [],
    });
  }

  const [newDetail, setNewDetail] = useState('');
  const [newPreserve, setNewPreserve] = useState('');
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#2563EB');

  const handleSave = () => {
    onUpdate(data);
    setIsEditing(false);
  };

  const colorVariants = data.colorVariants || [];
  const details = data.details || [];
  const mustPreserve = data.mustPreserve || [];

  const toggleVariantSelection = (variantId: string) => {
    const updatedVariants = colorVariants.map((v) =>
      v.id === variantId ? { ...v, selected: !v.selected } : v
    );
    const updated = { ...data, colorVariants: updatedVariants };
    setData(updated);
    onUpdate(updated);
  };

  const addColorVariant = () => {
    if (!newColorName.trim()) return;
    const newVariant: ColorVariant = {
      id: `col-${Date.now()}`,
      name: newColorName.trim(),
      detectedColor: newColorName.trim(),
      colorDescription: `Tono ${newColorName.trim()} uniforme preservando estampa botánica original`,
      approximateHex: newColorHex,
      selected: true,
      order: data.colorVariants.length,
    };
    const updated = {
      ...data,
      colorVariants: [...data.colorVariants, newVariant],
    };
    setData(updated);
    onUpdate(updated);
    setNewColorName('');
  };

  const removeColorVariant = (variantId: string) => {
    if (data.colorVariants.length <= 1) return;
    const updated = {
      ...data,
      colorVariants: data.colorVariants.filter((v) => v.id !== variantId),
    };
    setData(updated);
    onUpdate(updated);
  };

  const addDetail = () => {
    if (!newDetail.trim()) return;
    setData((prev) => ({
      ...prev,
      details: [...prev.details, newDetail.trim()],
    }));
    setNewDetail('');
  };

  const removeDetail = (index: number) => {
    setData((prev) => ({
      ...prev,
      details: prev.details.filter((_, i) => i !== index),
    }));
  };

  const addPreserve = () => {
    if (!newPreserve.trim()) return;
    setData((prev) => ({
      ...prev,
      mustPreserve: [...prev.mustPreserve, newPreserve.trim().toLowerCase()],
    }));
    setNewPreserve('');
  };

  const removePreserve = (index: number) => {
    setData((prev) => ({
      ...prev,
      mustPreserve: prev.mustPreserve.filter((_, i) => i !== index),
    }));
  };

  const selectedCount = colorVariants.filter((v) => v.selected).length;

  return (
    <div className="rounded-2xl bg-[#11131a] border border-[#1e2230] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">Garment Lock & Variantes de Color</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                COMPARTIDO
              </span>
            </div>
            <p className="text-xs text-[#8e96aa]">
              El diseño, moldería y confección son idénticos; cada variante de color genera sus 4 vistas independientes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            isEditing
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-[#161923] hover:bg-[#1e2230] text-gray-300 border border-[#232736]'
          }`}
        >
          {isEditing ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Ficha</span>
            </>
          ) : (
            <>
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Atributos</span>
            </>
          )}
        </button>
      </div>

      {/* REFERENCE COVERAGE PANEL */}
      <div className="p-3.5 rounded-xl bg-[#090a0f] border border-[#1e2230] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <Eye className="w-4 h-4 text-blue-400" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">Cobertura de Referencia:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            Frente: {garment.coverage?.front === 'VERIFIED' ? '✓ Verificado' : '~ Inferido'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
            garment.coverage?.side === 'VERIFIED'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
              : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
          }`}>
            Costado: {garment.coverage?.side === 'VERIFIED' ? '✓ Verificado' : '~ Inferido'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${
            garment.coverage?.back === 'VERIFIED'
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
              : 'bg-rose-950/40 text-rose-400 border-rose-800/40'
          }`}>
            Espalda: {garment.coverage?.back === 'VERIFIED' ? '✓ Verificado' : '? Sin ref. (AI Inferred)'}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-950/40 text-amber-400 border border-amber-800/40">
            Detalles: {garment.coverage?.details === 'VERIFIED' ? '✓ Verificados' : '~ Parcial'}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            Colores: {garment.coverage?.colors === 'VERIFIED' ? '✓ Verificados' : '~ Inferidos'}
          </span>
        </div>
      </div>

      {/* COLOR VARIANTS LOCK (Visual detection grid) */}
      <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1e2230] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <Palette className="w-4 h-4 text-purple-400" />
            <span>Variantes de Color Detectadas ({selectedCount}/{colorVariants.length} activas)</span>
          </div>
          <span className="text-[11px] text-[#8e96aa]">
            Evidencia visual tonal y recorte fotográfico congelados
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
          {colorVariants.map((variant) => (
            <div
              key={variant.id}
              onClick={() => toggleVariantSelection(variant.id)}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                variant.selected
                  ? 'bg-[#161923] border-blue-500/60 shadow-sm'
                  : 'bg-[#0f1118] border-[#1e2230] opacity-50'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className="flex items-center gap-1.5">
                  {variant.referenceCrop ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={variant.referenceCrop}
                      alt={variant.name}
                      className="w-5 h-5 rounded-full object-cover border border-white/30 shadow-inner"
                      title="Recorte de referencia tonal original"
                    />
                  ) : (
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shadow-inner"
                      style={{ backgroundColor: variant.approximateHex }}
                    />
                  )}
                  {variant.confidence && (
                    <span className="text-[9px] font-mono text-gray-400 font-semibold">
                      {variant.confidence}%
                    </span>
                  )}
                </div>
                {variant.selected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-gray-500" />
                )}
              </div>

              <div>
                <span className="text-xs font-medium text-white block truncate">{variant.name}</span>
                <span className="text-[10px] text-[#8e96aa] block truncate">{variant.detectedColor}</span>
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeColorVariant(variant.id);
                  }}
                  className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 self-end"
                >
                  Eliminar
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Add Color Variant inline */}
        {isEditing && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1e2230]">
            <input
              type="text"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Nombre del nuevo color (ej. Mostaza)..."
              className="px-3 py-1.5 text-xs rounded-lg bg-[#161923] border border-[#232736] text-white"
            />
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              className="w-8 h-8 rounded border border-[#232736] cursor-pointer bg-transparent"
              title="Color referencial"
            />
            <button
              type="button"
              onClick={addColorVariant}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Color</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Structural Details */}
        <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1e2230] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <Scissors className="w-4 h-4 text-blue-400" />
            <span>Moldería y Confección Inmutable</span>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Composición / Textil:</span>
              <p className="text-gray-200 font-medium">{data.material}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Estampado / Trama:</span>
              <p className="text-gray-200 font-medium">{data.pattern}</p>
            </div>

            <div className="pt-1">
              <span className="text-gray-400 block mb-1">Detalles de construcción:</span>
              <div className="flex flex-wrap gap-1.5">
                {details.map((detail, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#161923] border border-[#232736] text-gray-300 text-xs"
                  >
                    <span>{detail}</span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => removeDetail(idx)}
                        className="text-gray-500 hover:text-rose-400 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>

              {isEditing && (
                <div className="flex gap-1.5 pt-2">
                  <input
                    type="text"
                    value={newDetail}
                    onChange={(e) => setNewDetail(e.target.value)}
                    placeholder="Agregar detalle de moldería..."
                    className="w-full px-2 py-1 text-xs rounded bg-[#161923] border border-[#232736] text-white"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDetail())}
                  />
                  <button
                    type="button"
                    onClick={addDetail}
                    className="px-2 py-1 bg-blue-600 rounded text-white text-xs hover:bg-blue-500"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Must Preserve Attributes */}
        <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1e2230] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <BookmarkCheck className="w-4 h-4 text-emerald-400" />
            <span>Preservación Estricta (Contrato de Prenda)</span>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] text-[#8e96aa]">
              Propiedades inalterables que la IA respetará en todas las variantes y vistas:
            </p>

            <div className="flex flex-wrap gap-1.5">
              {mustPreserve.map((rule, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-mono"
                >
                  <span>✓ {rule}</span>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => removePreserve(idx)}
                      className="text-emerald-500 hover:text-rose-400 ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {isEditing && (
              <div className="flex gap-1.5 pt-2">
                <input
                  type="text"
                  value={newPreserve}
                  onChange={(e) => setNewPreserve(e.target.value)}
                  placeholder="Ej. largo de botamanga, bolsillos..."
                  className="w-full px-2 py-1 text-xs rounded bg-[#161923] border border-[#232736] text-white"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPreserve())}
                />
                <button
                  type="button"
                  onClick={addPreserve}
                  className="px-2 py-1 bg-emerald-600 rounded text-white text-xs hover:bg-emerald-500"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
