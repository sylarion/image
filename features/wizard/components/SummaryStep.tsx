'use client';

import React from 'react';
import { 
  DestinationPreset, 
  StylePreset, 
  ProductChoiceViewModel, 
  ShotChoiceViewModel 
} from '../models/wizard.types';
import { 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  RotateCw,
  Coins,
  ShieldCheck,
  Zap,
  Award
} from 'lucide-react';
import { ProductionConfigurationValidator } from '../engine/decision-engine';
import { GenerationCostQuote, QualityProfile } from '@/lib/pricing/types';

export type QuoteStatus = 'QUOTE_LOADING' | 'QUOTE_READY' | 'QUOTE_UNAVAILABLE';

interface SummaryStepProps {
  products: ProductChoiceViewModel[];
  shots: ShotChoiceViewModel[];
  destination: DestinationPreset;
  style: StylePreset;
  modelId?: string;
  modelName: string;
  qualityProfile: QualityProfile;
  onQualityChange: (quality: QualityProfile) => void;
  quote: GenerationCostQuote | null;
  quoteStatus: QuoteStatus;
  quoteError?: string | null;
  onRetryQuote: () => void;
  qualityTierRates?: Record<QualityProfile, number>;
  onConfirm: () => void;
  onBack: () => void;
  isCreating: boolean;
}

export function SummaryStep({
  products,
  shots,
  destination,
  style,
  modelId = 'model-female-sofia',
  modelName,
  qualityProfile,
  onQualityChange,
  quote,
  quoteStatus,
  quoteError,
  onRetryQuote,
  qualityTierRates,
  onConfirm,
  onBack,
  isCreating,
}: SummaryStepProps) {
  const selectedColors = products.flatMap((p) => p.colors.filter((c) => c.selected));
  const selectedShots = shots.filter((s) => s.selected);
  const totalPhotos = selectedColors.length * selectedShots.length;

  const validation = ProductionConfigurationValidator.validate({
    products,
    shots,
    destination,
    style,
    modelId,
  });

  const getDestinationLabel = (d: DestinationPreset) => {
    switch (d) {
      case 'MERCADO_LIBRE': return 'Mercado Libre';
      case 'TIENDA_ONLINE': return 'Tienda Online';
      case 'CATALOGO': return 'Catálogo Mayorista';
      case 'INSTAGRAM': return 'Instagram & Redes';
      case 'MAYORISTAS': return 'Mayoristas Unidos';
    }
  };

  const getStyleLabel = (s: StylePreset) => {
    switch (s) {
      case 'FONDO_BLANCO': return 'Fondo Blanco Puro';
      case 'ESTUDIO_PREMIUM': return 'Estudio Premium';
      case 'EDITORIAL': return 'Editorial de Moda';
      case 'LIFESTYLE': return 'Lifestyle Urbano';
    }
  };

  const isFreeApi = quote?.estimatedGenerationCostUsd === 0 && (quote?.estimatedValidationCostUsd ?? 0) === 0;

  const formatCost = (usd: number | null | undefined) => {
    if (usd === null || usd === undefined) return '--';
    if (isFreeApi) return 'Sin costo de API';
    return `USD ${usd.toFixed(2)}`;
  };

  const getTierEstimate = (tier: QualityProfile): string => {
    if (!qualityTierRates) return '';
    const rate = qualityTierRates[tier];
    if (rate === 0) return 'Sin costo de API';
    const total = (rate * totalPhotos).toFixed(2);
    return `USD ${total}`;
  };

  // Determine CTA label
  const getCtaLabel = () => {
    if (isCreating) return 'Iniciando producción...';
    if (quoteStatus === 'QUOTE_LOADING') return 'Calculando cotización...';
    if (quoteStatus === 'QUOTE_UNAVAILABLE') return 'Cotización no disponible';
    if (isFreeApi) return `Generar ${totalPhotos} imágenes · Sin costo de API`;
    if (quote?.estimatedTotalCostUsd !== null && quote?.estimatedTotalCostUsd !== undefined) {
      return `Generar ${totalPhotos} imágenes · USD ${quote.estimatedTotalCostUsd.toFixed(2)}`;
    }
    return `Generar ${totalPhotos} imágenes`;
  };

  const canConfirm = !isCreating && validation.isValid && quoteStatus === 'QUOTE_READY';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Tu producción está lista
        </h2>
        <p className="text-sm text-gray-400">
          Revisá el resumen final y la cotización de generación antes de iniciar.
        </p>
      </div>

      {/* Validation Callouts */}
      <div className="space-y-3">
        {validation.autoNotice && (
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center gap-2.5 text-xs text-blue-300">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>{validation.autoNotice}</span>
          </div>
        )}

        {validation.warnings.map((warn, i) => (
          <div key={i} className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{warn}</span>
          </div>
        ))}

        {validation.errors.map((err, i) => (
          <div key={i} className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{err}</span>
          </div>
        ))}

        {/* Quote Unavailable Callout */}
        {quoteStatus === 'QUOTE_UNAVAILABLE' && (
          <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-3 text-xs text-red-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-semibold text-red-100">No pudimos calcular el costo de esta producción.</p>
                <p className="text-red-300/80">{quoteError || 'Verificá tu conexión o intentá nuevamente.'}</p>
              </div>
            </div>
            <button
              onClick={onRetryQuote}
              className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Reintentar</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Key metrics & Quality selection */}
        <div className="md:col-span-2 space-y-6">
          <div className="p-6 rounded-3xl bg-[#11131c] border border-[#1e2230] space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-[#1e2230]">
              <div>
                <span className="text-xs text-gray-400 block">Colores activos</span>
                <span className="text-2xl font-extrabold text-white">{selectedColors.length}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Fotos por color</span>
                <span className="text-2xl font-extrabold text-white">{selectedShots.length}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Canal principal</span>
                <span className="text-sm font-bold text-blue-400 block mt-1">
                  {getDestinationLabel(destination)}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block">Estilo visual</span>
                <span className="text-sm font-bold text-indigo-400 block mt-1">
                  {getStyleLabel(style)}
                </span>
              </div>
            </div>

            {/* Quality Profile Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Nivel de calidad de render
                </span>
                <span className="text-[11px] text-gray-400">
                  Seleccioná el balance ideal de costo y detalle
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Draft Option */}
                <button
                  type="button"
                  onClick={() => onQualityChange('draft')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    qualityProfile === 'draft'
                      ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10'
                      : 'bg-[#090a0f] border-[#232738] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Borrador
                    </span>
                    <span className="text-[11px] font-semibold text-gray-300">
                      {getTierEstimate('draft')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">Rápido para validaciones internas y bocetos.</p>
                </button>

                {/* Standard Option (Default) */}
                <button
                  type="button"
                  onClick={() => onQualityChange('standard')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    qualityProfile === 'standard'
                      ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10'
                      : 'bg-[#090a0f] border-[#232738] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-blue-400" />
                      Estándar
                    </span>
                    <span className="text-[11px] font-semibold text-gray-300">
                      {getTierEstimate('standard')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">Excelente fidelidad para e-commerce y catálogos.</p>
                </button>

                {/* Final Option */}
                <button
                  type="button"
                  onClick={() => onQualityChange('final')}
                  className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                    qualityProfile === 'final'
                      ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10'
                      : 'bg-[#090a0f] border-[#232738] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Alta fidelidad
                    </span>
                    <span className="text-[11px] font-semibold text-gray-300">
                      {getTierEstimate('final')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">Máxima resolución para campañas y banners gigantes.</p>
                </button>
              </div>
            </div>

            {/* Colorways list */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Variantes de color que se generarán ({selectedColors.length})
              </span>

              <div className="flex flex-wrap gap-2.5">
                {selectedColors.map((c) => (
                  <div
                    key={c.id}
                    className="px-3 py-1.5 rounded-xl bg-[#090a0f] border border-[#232738] flex items-center gap-2 text-xs"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="font-semibold text-white">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected angles */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Ángulos incluidos para cada color
              </span>

              <div className="flex flex-wrap gap-2">
                {selectedShots.map((s) => (
                  <span
                    key={s.id}
                    className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium"
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Pre-Generation Cost Quote & Confirmation */}
        <div className="p-6 rounded-3xl bg-gradient-to-b from-[#151928] to-[#0f111a] border border-blue-500/30 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                <Coins className="w-4 h-4" />
                <span>Resumen de producción</span>
              </div>
              {quoteStatus === 'QUOTE_LOADING' && (
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <RotateCw className="w-3 h-3 animate-spin text-blue-400" />
                  Cotizando...
                </span>
              )}
            </div>

            {/* Image calculation breakdown */}
            <div className="p-4 rounded-2xl bg-[#0a0c14] border border-[#1e2230] space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="text-gray-400">Variantes seleccionadas:</span>
                <span className="font-bold text-white">{selectedColors.length} colores</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="text-gray-400">Fotos por variante:</span>
                <span className="font-bold text-white">× {selectedShots.length} tomas</span>
              </div>
              <div className="pt-2 border-t border-[#1e2230] flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">Total a generar:</span>
                <span className="text-lg font-black text-white">{totalPhotos} imágenes</span>
              </div>
            </div>

            {/* Cost Quote Box */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/30 to-indigo-950/20 border border-blue-500/20 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-300 block">
                Costo estimado
              </span>

              {quoteStatus === 'QUOTE_LOADING' ? (
                <div className="py-3 flex items-center gap-2 text-sm text-gray-400">
                  <RotateCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Calculando tarifa de generación...</span>
                </div>
              ) : quoteStatus === 'QUOTE_UNAVAILABLE' ? (
                <div className="py-2 text-xs text-red-300">
                  <span>No disponible temporalmente</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tracking-tight">
                      {isFreeApi ? 'Sin costo de API' : `USD ${quote?.estimatedTotalCostUsd?.toFixed(2) ?? '0.00'}`}
                    </span>
                  </div>
                  {isFreeApi ? (
                    <p className="text-[11px] text-emerald-400">
                      Costo de API: USD 0.00 (motor local / demostración)
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      {quote?.estimatedCostPerImageUsd !== null && (
                        <span>~USD {quote?.estimatedCostPerImageUsd?.toFixed(2)} por imagen</span>
                      )}
                      {Boolean(quote?.estimatedValidationCostUsd && quote.estimatedValidationCostUsd > 0) && (
                        <span> · incluye validación de fidelidad</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              <p className="text-[10px] text-gray-400 pt-1 border-t border-white/5 leading-relaxed">
                El importe es estimado y puede variar ligeramente según el procesamiento final.
              </p>
            </div>

            <div className="space-y-2 pt-1 text-xs text-gray-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Modelo: {modelName}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Moldería y ADN original protegidos</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="space-y-2">
            <button
              onClick={onConfirm}
              disabled={!canConfirm}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-sm sm:text-base transition-all shadow-xl shadow-blue-600/30 hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2"
            >
              <span>{getCtaLabel()}</span>
              {!isCreating && quoteStatus === 'QUOTE_READY' && <ArrowRight className="w-5 h-5" />}
              {(isCreating || quoteStatus === 'QUOTE_LOADING') && (
                <RotateCw className="w-4 h-4 animate-spin" />
              )}
            </button>

            {!canConfirm && quoteStatus === 'QUOTE_UNAVAILABLE' && (
              <p className="text-[11px] text-red-400 text-center">
                Es obligatorio contar con una cotización válida antes de generar.
              </p>
            )}
          </div>
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
      </div>
    </div>
  );
}
