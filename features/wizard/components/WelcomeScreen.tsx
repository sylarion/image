'use client';

import React from 'react';
import { 
  Camera, 
  Sparkles, 
  ArrowRight, 
  Layers, 
  CheckCircle2, 
  Upload, 
  ShoppingBag,
  TrendingUp,
  Store
} from 'lucide-react';

interface WelcomeScreenProps {
  onStartSingleGarment: () => void;
  onStartMultiGarment: () => void;
}

export function WelcomeScreen({
  onStartSingleGarment,
  onStartMultiGarment,
}: WelcomeScreenProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-14 px-4 space-y-10 animate-fade-in">
      {/* Main Pitch */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Asistente de Producción Fotográfica</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Convertí una foto de tu prenda en <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">imágenes listas para vender</span>
        </h1>

        <p className="text-base sm:text-lg text-gray-400 font-normal">
          Subí una foto de percha, maniquí o de tu catálogo actual. Detectamos automáticamente cada color y creamos tu sesión fotográfica en segundos.
        </p>
      </div>

      {/* Single Big Visual Upload Card with Drag & Drop Pitch */}
      <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-[#141724] to-[#0f111a] border border-blue-500/30 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
          <Camera className="w-8 h-8" />
        </div>

        <div className="space-y-2 max-w-lg mx-auto">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Subí una foto de tu prenda o catálogo
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Aceptamos fotos en percha, sobre maniquí, modelo o con varios colores alineados en la misma foto. Nuestro asistente detecta y separa cada variante automáticamente.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onStartSingleGarment}
            className="inline-flex items-center justify-center gap-3 px-9 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base transition-all shadow-xl shadow-blue-600/30 hover:scale-[1.02] active:scale-98"
          >
            <Upload className="w-5 h-5" />
            <span>Subir foto</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400 pt-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Detección automática de colores
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Recorte de maniquí y fondo
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Moldería y detalles protegidos
          </span>
        </div>
      </div>

      {/* Marketplaces Trust Badges */}
      <div className="pt-6 border-t border-[#1a1d28] text-center space-y-3">
        <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
          Formatos listos para publicar en tus canales de venta
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-yellow-400" /> Mercado Libre
          </span>
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-400" /> Tienda Online (Tiendanube / Shopify)
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-pink-400" /> Instagram & Redes
          </span>
        </div>
      </div>
    </div>
  );
}
