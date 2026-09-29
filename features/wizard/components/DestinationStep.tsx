'use client';

import React from 'react';
import { 
  DestinationPreset, 
  DestinationPresetViewModel,
  DESTINATION_PRESETS 
} from '../models/wizard.types';
import { 
  Store, 
  ShoppingBag, 
  TrendingUp, 
  Layers, 
  Check, 
  ArrowRight, 
  ArrowLeft 
} from 'lucide-react';

interface DestinationStepProps {
  selectedDestination: DestinationPreset;
  onSelectDestination: (dest: DestinationPreset) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DestinationStep({
  selectedDestination,
  onSelectDestination,
  onNext,
  onBack,
}: DestinationStepProps) {
  const getDestinationIcon = (id: DestinationPreset) => {
    switch (id) {
      case 'MERCADO_LIBRE':
      case 'MAYORISTAS':
        return <Store className="w-5 h-5 text-yellow-400" />;
      case 'TIENDA_ONLINE':
        return <ShoppingBag className="w-5 h-5 text-blue-400" />;
      case 'INSTAGRAM':
        return <TrendingUp className="w-5 h-5 text-pink-400" />;
      case 'CATALOGO':
      default:
        return <Layers className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          ¿Dónde vas a usar las fotos?
        </h2>
        <p className="text-sm text-gray-400">
          Ajustamos automáticamente iluminación, encuadre y proporciones óptimas para cada canal de venta.
        </p>
      </div>

      {/* Destination Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DESTINATION_PRESETS.map((dest) => {
          const isSelected = selectedDestination === dest.id;
          return (
            <div
              key={dest.id}
              onClick={() => onSelectDestination(dest.id)}
              className={`p-5 rounded-3xl border cursor-pointer transition-all duration-200 select-none flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'bg-[#151928] border-blue-500 shadow-xl ring-1 ring-blue-500/50'
                  : 'bg-[#11131c] border-[#1e2230] hover:border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-2xl bg-[#090a0f] border border-[#232738] flex items-center justify-center">
                  {getDestinationIcon(dest.id)}
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-black/60 border border-white/40 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{dest.title}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 text-gray-400 border border-[#232738]">
                    {dest.aspectRatio}
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  {dest.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explicit Feedback Banner for Auto-Applied Settings */}
      <div className="p-4 rounded-2xl bg-[#11131c] border border-blue-500/30 flex items-start gap-3 animate-fade-in">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400">
          <Check className="w-4 h-4" />
        </div>
        <div className="space-y-0.5 text-xs">
          <span className="font-bold text-white block">
            Aplicado automáticamente para {DESTINATION_PRESETS.find((p) => p.id === selectedDestination)?.title}
          </span>
          <p className="text-gray-400 leading-relaxed">
            {selectedDestination === 'MERCADO_LIBRE' && 'Se configuró Fondo Blanco puro reglamentario, encuadre cuadrado 1:1 y tomas Frente, Costado y Espalda.'}
            {selectedDestination === 'TIENDA_ONLINE' && 'Se configuró Estudio Premium con sombras suaves y encuadre 3:4 para catálogo web.'}
            {selectedDestination === 'INSTAGRAM' && 'Se configuró estilo Lifestyle Urbano con luz natural de día y encuadre vertical 4:5.'}
            {selectedDestination === 'CATALOGO' && 'Se configuró dirección de arte Editorial de Moda y encuadre 3:4.'}
            {selectedDestination === 'MAYORISTAS' && 'Se configuró Fondo Blanco comercial y encuadre 1:1 optimizado para mayoristas.'}
          </p>
        </div>
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
          <span>Elegir estilo visual</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
