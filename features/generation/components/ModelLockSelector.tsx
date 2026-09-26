'use client';

import React from 'react';
import { ModelLock } from '@/types';
import { PRESET_MODELS } from '@/lib/constants/models';
import { UserCheck, Check } from 'lucide-react';

interface ModelLockSelectorProps {
  selectedModel: ModelLock;
  onSelectModel: (model: ModelLock) => void;
}

export function ModelLockSelector({ selectedModel, onSelectModel }: ModelLockSelectorProps) {
  return (
    <div className="rounded-2xl bg-[#11131a] border border-[#1e2230] p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e2230] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-purple-400" />
              <span>Model Lock — Modelo Consistente</span>
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
              MISMA MODELO
            </span>
          </div>
          <p className="text-xs text-[#8e96aa] mt-0.5">
            Garantiza que todas las poses, ángulos y planos de la sesión utilicen los rasgos y proporciones de la misma modelo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PRESET_MODELS.map((model) => {
          const isSelected = selectedModel.modelId === model.modelId;

          return (
            <button
              key={model.modelId}
              type="button"
              onClick={() => onSelectModel(model)}
              className={`text-left rounded-xl border p-3.5 transition-all relative overflow-hidden group ${
                isSelected
                  ? 'border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500'
                  : 'border-[#1e2230] bg-[#090a0f] hover:border-gray-700'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center">
                  <Check className="w-3 h-3" />
                </div>
              )}

              <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-black/60 relative mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={model.previewUrl}
                  alt={model.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <span>{model.name}</span>
                  <span className="text-[10px] text-[#8e96aa]">({model.apparentAge})</span>
                </h4>
                <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{model.bodyType}</p>
                <div className="mt-2 text-[10px] text-gray-500 space-y-0.5 font-mono">
                  <div>Cabello: {model.hairColor}</div>
                  <div>Tono: {model.skinTone}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
