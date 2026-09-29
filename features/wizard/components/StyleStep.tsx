'use client';

import React from 'react';
import { 
  StylePreset, 
  DestinationPreset,
  STYLE_PRESETS 
} from '../models/wizard.types';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft,
  Sparkles 
} from 'lucide-react';

interface StyleStepProps {
  selectedStyle: StylePreset;
  destination?: DestinationPreset;
  onSelectStyle: (style: StylePreset) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StyleStep({
  selectedStyle,
  destination,
  onSelectStyle,
  onNext,
  onBack,
}: StyleStepProps) {
  const isMercadoLibreDeviation = destination === 'MERCADO_LIBRE' && selectedStyle !== 'FONDO_BLANCO';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Elegí el estilo de fondo
        </h2>
        <p className="text-sm text-gray-400">
          Podés optar por fondo blanco puro reglamentario o ambientación de estudio editorial.
        </p>
      </div>

      {isMercadoLibreDeviation && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 animate-fade-in">
          <span className="text-amber-400 font-bold shrink-0 mt-0.5">⚠️</span>
          <div className="text-xs text-amber-200 space-y-0.5">
            <span className="font-bold block">Cambiaste la recomendación para Mercado Libre</span>
            <p className="text-amber-300/80 leading-relaxed">
              Mercado Libre exige Fondo Blanco puro (#FFFFFF) para publicaciones de catálogo. Podés continuar con este estilo, pero tené en cuenta los requisitos del marketplace.
            </p>
          </div>
        </div>
      )}

      {/* Style Cards with Large Visual Previews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STYLE_PRESETS.map((st) => {
          const isSelected = selectedStyle === st.id;
          return (
            <div
              key={st.id}
              onClick={() => onSelectStyle(st.id)}
              className={`group p-4 rounded-3xl border cursor-pointer transition-all duration-200 select-none flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'bg-[#151928] border-blue-500 shadow-xl ring-1 ring-blue-500/50'
                  : 'bg-[#11131c] border-[#1e2230] opacity-80 hover:opacity-100 hover:border-gray-700'
              }`}
            >
              {/* Preview image */}
              <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-black/60 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={st.previewUrl}
                  alt={st.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Badge if present */}
                {st.badge && (
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-blue-600/90 text-white text-[10px] font-semibold backdrop-blur-md">
                    {st.badge}
                  </div>
                )}

                <div
                  className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-black/60 border border-white/40 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  {st.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {st.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#1e2230]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#232738] hover:bg-[#161925] text-gray-300 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-98"
        >
          <span>Elegir modelo</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
