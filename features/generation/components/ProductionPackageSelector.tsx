'use client';

import React from 'react';
import { ProductionPackageSelection } from '@/types';
import { ShoppingBag, Sparkles, CheckSquare, Square } from 'lucide-react';

interface ProductionPackageSelectorProps {
  selection: ProductionPackageSelection;
  colorCount: number;
  onChange: (updated: ProductionPackageSelection) => void;
}

export function ProductionPackageSelector({ selection, colorCount, onChange }: ProductionPackageSelectorProps) {
  const toggleStudioWhite = () => {
    onChange({
      ...selection,
      studioWhite: !selection.studioWhite,
    });
  };

  const toggleEditorialCatalog = () => {
    onChange({
      ...selection,
      editorialCatalog: !selection.editorialCatalog,
    });
  };

  const selectBoth = () => {
    onChange({
      studioWhite: true,
      editorialCatalog: true,
    });
  };

  const activeSets = (selection.studioWhite ? 1 : 0) + (selection.editorialCatalog ? 1 : 0);
  const totalPhotos = colorCount * 4 * activeSets;

  return (
    <div className="rounded-2xl bg-[#11131a] border border-[#1e2230] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2230] pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">Sets de Producción Fotográfica</h3>
          <p className="text-xs text-[#8e96aa]">
            Cada set produce las 4 vistas canónicas (Frente, Costado, Espalda, Acción) para cada color activo.
          </p>
        </div>

        <button
          type="button"
          onClick={selectBoth}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-medium transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Activar ambos sets (Catálogo + Mercado Libre)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* MERCADO LIBRE / ECOMMERCE (STUDIO_WHITE) */}
        <div
          className={`rounded-xl border p-5 transition-all ${
            selection.studioWhite
              ? 'border-blue-500/70 bg-blue-950/10 ring-1 ring-blue-500/30'
              : 'border-[#1e2230] bg-[#090a0f] opacity-80'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base tracking-tight">MERCADO LIBRE / E-COMMERCE</h4>
                <span className="text-[11px] text-blue-400 font-mono">Fondo Blanco Puro de Estudio</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleStudioWhite}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                selection.studioWhite
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#161923] text-gray-400 border border-[#232736]'
              }`}
            >
              {selection.studioWhite ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>Activo</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Activar</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-[#8e96aa] mt-3">
            Fotografías limpias con fondo blanco puro y luz uniforme, optimizadas para marketplaces.
          </p>

          <div className="mt-4 p-3 rounded-lg bg-[#090a0f] border border-[#1e2230] text-[11px] text-gray-400 space-y-1">
            <div className="font-semibold text-gray-300">Reglas obligatorias:</div>
            <ul className="list-disc list-inside space-y-0.5 text-[#8e96aa]">
              <li>Fondo blanco puro (#FFFFFF) sin sombras sucias</li>
              <li>Iluminación suave uniforme de alta fidelidad textil</li>
              <li>Sin muebles, sin accesorios distractores</li>
              <li>Producto como protagonista absoluto</li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2230] text-xs text-gray-300 flex items-center justify-between">
            <span>Vistas obligatorias:</span>
            <span className="font-mono text-blue-400">Frente • Costado • Espalda • Acción</span>
          </div>
        </div>

        {/* CATÁLOGO PREMIUM (EDITORIAL_CATALOG) */}
        <div
          className={`rounded-xl border p-5 transition-all ${
            selection.editorialCatalog
              ? 'border-indigo-500/70 bg-indigo-950/10 ring-1 ring-indigo-500/30'
              : 'border-[#1e2230] bg-[#090a0f] opacity-80'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base tracking-tight">CATÁLOGO PREMIUM</h4>
                <span className="text-[11px] text-indigo-400 font-mono">Dirección Artística Editorial</span>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleEditorialCatalog}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                selection.editorialCatalog
                  ? 'bg-indigo-600 text-white'
                  : 'bg-[#161923] text-gray-400 border border-[#232736]'
              }`}
            >
              {selection.editorialCatalog ? (
                <>
                  <CheckSquare className="w-4 h-4" />
                  <span>Activo</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  <span>Activar</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-[#8e96aa] mt-3">
            Fotografía comercial de campaña con ambientación sofisticada para lookbooks y redes.
          </p>

          <div className="mt-4 p-3 rounded-lg bg-[#090a0f] border border-[#1e2230] text-[11px] text-gray-400 space-y-1">
            <div className="font-semibold text-gray-300">Reglas editoriales:</div>
            <ul className="list-disc list-inside space-y-0.5 text-[#8e96aa]">
              <li>Misma prenda y misma modelo en toda la serie</li>
              <li>Escenario elegante que no compite con la prenda</li>
              <li>Iluminación comercial con relieve y profundidad</li>
              <li>Misma dirección artística coherente entre colores</li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2230] text-xs text-gray-300 flex items-center justify-between">
            <span>Vistas obligatorias:</span>
            <span className="font-mono text-indigo-400">Frente • Costado • Espalda • Acción</span>
          </div>
        </div>
      </div>

      {/* Production Matrix Calculation Summary */}
      <div className="p-4 rounded-xl bg-[#090a0f] border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-gray-400 block">Matriz de Producción Estimada:</span>
          <div className="text-white mt-0.5 font-mono">
            {colorCount} colores × 4 vistas canónicas × {activeSets} {activeSets === 1 ? 'set' : 'sets'} = <strong className="text-blue-400 font-bold text-sm">{totalPhotos} fotografías</strong>
          </div>
        </div>
        <div className="text-[11px] text-[#8e96aa] flex items-center gap-2">
          <span>Modelo única bloqueada</span>
          <span>•</span>
          <span>Mirada a cámara obligatoria</span>
        </div>
      </div>
    </div>
  );
}
