'use client';

import React, { useState } from 'react';
import { 
  MODEL_CHOICES 
} from '../models/wizard.types';
import { 
  Check, 
  ArrowRight, 
  ArrowLeft,
  User,
  Layers,
  Sparkles
} from 'lucide-react';

interface ModelStepProps {
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ModelStep({
  selectedModelId,
  onSelectModel,
  onNext,
  onBack,
}: ModelStepProps) {
  const isGhostInitial = selectedModelId === 'model-no-model';
  const [mode, setMode] = useState<'HUMAN' | 'GHOST'>(isGhostInitial ? 'GHOST' : 'HUMAN');

  const humanModels = MODEL_CHOICES.filter((m) => m.type !== 'NO_MODEL');
  const ghostChoice = MODEL_CHOICES.find((m) => m.id === 'model-no-model');

  const handleSelectMode = (newMode: 'HUMAN' | 'GHOST') => {
    setMode(newMode);
    if (newMode === 'GHOST') {
      onSelectModel('model-no-model');
    } else {
      // Default to first human model if currently ghost
      if (selectedModelId === 'model-no-model') {
        onSelectModel('model-female-sofia');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          ¿Cómo querés mostrar la prenda?
        </h2>
        <p className="text-sm text-gray-400">
          Elegí si preferís lucir la prenda con una modelo humana o en maniquí invisible para catálogo técnico.
        </p>
      </div>

      {/* 1. Mode Selector: Con Modelo Humano vs Maniquí Invisible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Option 1: Con Modelo Humano */}
        <div
          onClick={() => handleSelectMode('HUMAN')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 select-none flex items-center gap-3.5 ${
            mode === 'HUMAN'
              ? 'bg-[#151928] border-blue-500 shadow-md ring-1 ring-blue-500/50'
              : 'bg-[#11131c] border-[#1e2230] opacity-75 hover:opacity-100 hover:border-gray-700'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              mode === 'HUMAN' ? 'bg-blue-600 text-white' : 'bg-[#1a1e2c] text-gray-400'
            }`}
          >
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Con Modelo Humano</span>
              {mode === 'HUMAN' && <Check className="w-4 h-4 text-blue-400" />}
            </div>
            <p className="text-xs text-gray-400 truncate">
              Modelos profesionales para darle vida y escala a la prenda
            </p>
          </div>
        </div>

        {/* Option 2: Maniquí Invisible */}
        <div
          onClick={() => handleSelectMode('GHOST')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 select-none flex items-center gap-3.5 ${
            mode === 'GHOST'
              ? 'bg-[#151928] border-blue-500 shadow-md ring-1 ring-blue-500/50'
              : 'bg-[#11131c] border-[#1e2230] opacity-75 hover:opacity-100 hover:border-gray-700'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              mode === 'GHOST' ? 'bg-blue-600 text-white' : 'bg-[#1a1e2c] text-gray-400'
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Maniquí Invisible (Ghost)</span>
              {mode === 'GHOST' && <Check className="w-4 h-4 text-blue-400" />}
            </div>
            <p className="text-xs text-gray-400 truncate">
              Prenda con volumen 3D real sin cuerpo humano visible
            </p>
          </div>
        </div>
      </div>

      {/* 2. Sub-selection depending on Mode */}
      {mode === 'HUMAN' ? (
        <div className="space-y-3 pt-2">
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider block">
            Elegí la modelo para tu producción:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {humanModels.map((m) => {
              const isSelected = selectedModelId === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectModel(m.id)}
                  className={`group p-3.5 rounded-3xl border cursor-pointer transition-all duration-200 select-none flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-[#151928] border-blue-500 shadow-xl ring-1 ring-blue-500/50'
                      : 'bg-[#11131c] border-[#1e2230] opacity-80 hover:opacity-100 hover:border-gray-700'
                  }`}
                >
                  {/* Photo preview */}
                  <div className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-black/60 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.previewUrl}
                      alt={m.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

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
                    <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                      {m.name}
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {m.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Ghost Mannequin Dedicated Highlight Card */
        <div className="pt-2">
          {ghostChoice && (
            <div className="p-6 rounded-3xl bg-[#11131c] border border-blue-500/40 shadow-xl flex flex-col sm:flex-row items-center gap-6">
              <div className="w-full sm:w-48 aspect-[4/5] rounded-2xl overflow-hidden bg-[#090b12] border border-white/10 shrink-0 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ghostChoice.previewUrl}
                  alt={ghostChoice.name}
                  className="w-full h-full object-contain p-2"
                />
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                  <Check className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Modo E-commerce Puro Activo</span>
                </div>
                <h3 className="text-lg font-bold text-white">
                  {ghostChoice.name}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">
                  {ghostChoice.description}
                </p>
                <div className="p-3 rounded-xl bg-[#090a0f] border border-[#1e2230] text-xs text-gray-400 space-y-1">
                  <div className="flex items-center gap-2 text-gray-200 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sin cabezas, extremidades ni distracciones humanas</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-200 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Volumen 3D y cuello interior continuo</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-200 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-400" />
                    <span>Apto para Mercado Libre, catálogo mayorista y fichas técnicas</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
          <span>Revisar resumen</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
