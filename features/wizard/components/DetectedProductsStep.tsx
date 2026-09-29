'use client';

import React, { useState } from 'react';
import { 
  ProductChoiceViewModel, 
  ColorChoiceViewModel, 
  UserConfirmedGarmentIdentity 
} from '../models/wizard.types';
import { 
  Check, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  Edit2,
  Tag,
  AlertCircle,
  Plus,
  UploadCloud,
  X,
  Layers
} from 'lucide-react';

const GARMENT_TYPES = [
  'Vestido',
  'Mono',
  'Remera',
  'Camisa',
  'Blusa',
  'Pantalón',
  'Short',
  'Pollera',
  'Campera',
  'Sweater',
  'Conjunto',
  'Otro',
] as const;

interface DetectedProductsStepProps {
  products: ProductChoiceViewModel[];
  onToggleColor: (productId: string, colorId: string) => void;
  onUpdateIdentity: (productId: string, identity: UserConfirmedGarmentIdentity) => void;
  onUpdateColorName?: (productId: string, colorId: string, newColorName: string) => void;
  onAddVariant?: (productId: string, variant: { name: string; file: File }) => void;
  onNext: () => void;
  onBack: () => void;
}

export function DetectedProductsStep({
  products,
  onToggleColor,
  onUpdateIdentity,
  onUpdateColorName,
  onAddVariant,
  onNext,
  onBack,
}: DetectedProductsStepProps) {
  const [editingCustomType, setEditingCustomType] = useState<Record<string, boolean>>({});
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [tempColorName, setTempColorName] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Scene Review confirmation state per product group
  const [confirmedSameModel, setConfirmedSameModel] = useState<Record<string, boolean>>({});

  // Clean Modal for adding missing variant
  const [activeAddModalProduct, setActiveAddModalProduct] = useState<string | null>(null);
  const [modalColorName, setModalColorName] = useState('');
  const [modalColorFile, setModalColorFile] = useState<File | null>(null);
  const [modalFilePreview, setModalFilePreview] = useState<string | null>(null);

  const selectedColorsCount = products.reduce(
    (acc, p) => acc + p.colors.filter((c) => c.selected).length,
    0
  );

  const totalColors = products.reduce((acc, p) => acc + p.colors.length, 0);
  const isSingleProductSingleColor = products.length === 1 && totalColors === 1;

  // Header copy: Natural & commercial, not technical
  const getHeaderTitle = () => {
    if (products.length > 1) {
      return `Encontramos ${products.length} modelos distintos`;
    }
    if (totalColors > 1) {
      return `Encontramos este modelo en ${totalColors} colores`;
    }
    return 'Encontramos esta prenda';
  };

  const handleNameChange = (productId: string, newName: string) => {
    setValidationError(null);
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const currentIdentity = prod.confirmedIdentity || {
      productGroupId: prod.id,
      aiSuggestedName: prod.title,
      aiSuggestedCategory: prod.category,
      confirmedName: prod.title,
      confirmedCategory: prod.category,
      source: 'AI_CONFIRMED',
      confirmedAt: new Date().toISOString(),
    };

    const isChanged = newName.trim() !== currentIdentity.aiSuggestedName.trim();

    onUpdateIdentity(productId, {
      ...currentIdentity,
      confirmedName: newName,
      source: isChanged ? 'USER_CORRECTED' : 'AI_CONFIRMED',
      confirmedAt: new Date().toISOString(),
    });
  };

  const handleCategoryChange = (productId: string, newCategory: string) => {
    setValidationError(null);
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const currentIdentity = prod.confirmedIdentity || {
      productGroupId: prod.id,
      aiSuggestedName: prod.title,
      aiSuggestedCategory: prod.category,
      confirmedName: prod.title,
      confirmedCategory: prod.category,
      source: 'AI_CONFIRMED',
      confirmedAt: new Date().toISOString(),
    };

    if (newCategory === 'Otro') {
      setEditingCustomType((prev) => ({ ...prev, [productId]: true }));
    } else {
      setEditingCustomType((prev) => ({ ...prev, [productId]: false }));
    }

    const isChanged = newCategory !== currentIdentity.aiSuggestedCategory;

    onUpdateIdentity(productId, {
      ...currentIdentity,
      confirmedCategory: newCategory,
      source: isChanged ? 'USER_CORRECTED' : 'AI_CONFIRMED',
      confirmedAt: new Date().toISOString(),
    });
  };

  const openAddModal = (productId: string) => {
    setActiveAddModalProduct(productId);
    setModalColorName('');
    setModalColorFile(null);
    setModalFilePreview(null);
    setValidationError(null);
  };

  const closeAddModal = () => {
    setActiveAddModalProduct(null);
    setModalColorName('');
    setModalColorFile(null);
    setModalFilePreview(null);
  };

  const handleModalFileSelect = (file: File | null) => {
    setModalColorFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setModalFilePreview(url);
    } else {
      setModalFilePreview(null);
    }
  };

  const handleModalSubmit = () => {
    if (!activeAddModalProduct) return;
    if (!modalColorName.trim()) {
      setValidationError('Ingresá el nombre del color que falta.');
      return;
    }
    if (!modalColorFile) {
      setValidationError('Subí una foto del color que falta.');
      return;
    }
    if (onAddVariant) {
      onAddVariant(activeAddModalProduct, {
        name: modalColorName.trim(),
        file: modalColorFile,
      });
      closeAddModal();
      setValidationError(null);
    }
  };

  const handleContinue = () => {
    for (const prod of products) {
      const name = prod.confirmedIdentity?.confirmedName || prod.title;
      if (!name || name.trim().length === 0) {
        setValidationError('Decinos qué prenda es para continuar.');
        return;
      }
    }

    if (totalColors > 1 && selectedColorsCount === 0) {
      setValidationError('Elegí al menos un color para producir.');
      return;
    }

    setValidationError(null);
    onNext();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Step Header: Professional, not premature */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Prendas listas para revisar</span>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight">
          {getHeaderTitle()}
        </h2>
        <p className="text-sm text-gray-400">
          Revisá los colores detectados y confirmá los datos de tu prenda para la producción.
        </p>
      </div>

      {validationError && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main Products List */}
      <div className="space-y-6">
        {products.map((product) => {
          const identity = product.confirmedIdentity || {
            productGroupId: product.id,
            aiSuggestedName: product.title,
            aiSuggestedCategory: product.category,
            confirmedName: product.title,
            confirmedCategory: product.category,
            source: 'AI_CONFIRMED',
            confirmedAt: new Date().toISOString(),
          };

          const isCustomType = editingCustomType[product.id] || (
            !GARMENT_TYPES.includes(identity.confirmedCategory as any) &&
            identity.confirmedCategory !== ''
          );

          const isMultipleVariants = product.colors.length > 1;
          const isSameModelChoice = confirmedSameModel[product.id] !== false;

          return (
            <div
              key={product.id}
              className="p-5 sm:p-6 rounded-3xl bg-[#11131c] border border-[#1e2230] space-y-6"
            >
              {/* 1. SCENE REVIEW: Auditoría / Verificación de agrupación (Compacto y de revisión) */}
              {isMultipleVariants && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-[#090b12] border border-[#1e2230] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-gray-300">
                        Revisión de escena: {product.colors.length} prendas detectadas en la foto
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmedSameModel((prev) => ({ ...prev, [product.id]: true }))}
                        className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                          isSameModelChoice
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-[#141724] text-gray-400 border border-[#232738] hover:text-white'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>Sí, son el mismo modelo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmedSameModel((prev) => ({ ...prev, [product.id]: false }))}
                        className={`px-3 py-1 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                          !isSameModelChoice
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-[#141724] text-gray-400 border border-[#232738] hover:text-white'
                        }`}
                      >
                        <span>Son productos distintos</span>
                      </button>
                    </div>
                  </div>

                  {/* Compact horizontal strip of detected crops */}
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                    {product.colors.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#141724] border border-[#232738] shrink-0"
                      >
                        <div className="w-7 h-9 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0">
                          {c.cropUrl ? (
                            <img
                              src={c.cropUrl}
                              alt={c.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: c.hex }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pr-1">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-xs font-medium text-gray-200">
                            {c.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. VARIANT SELECTION: ¿Qué colores querés producir? (Bloque de Acción Principal) */}
              {!isSingleProductSingleColor && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-white tracking-tight block">
                        ¿Qué colores querés producir?
                      </span>
                      <span className="text-xs text-gray-400">
                        Elegí qué variantes mandar a producción o agregá las que falten.
                      </span>
                    </div>
                    <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                      {product.colors.filter((c) => c.selected).length} de {product.colors.length} seleccionados
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {product.colors.map((color) => {
                      const isSelected = color.selected;
                      return (
                        <div
                          key={color.id}
                          onClick={() => onToggleColor(product.id, color.id)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 select-none flex flex-col justify-between space-y-3 ${
                            isSelected
                              ? 'bg-[#151928] border-blue-500 shadow-md ring-1 ring-blue-500/50'
                              : 'bg-[#0a0c12] border-[#1e2230] opacity-60 hover:opacity-100 hover:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
                                style={{ backgroundColor: color.hex }}
                              />
                              <span className="text-xs font-semibold text-gray-200 truncate">
                                {color.name}
                              </span>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ml-1 ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'border-gray-600 bg-black/40'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>

                          {/* Real Crop Preview */}
                          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[#090a0f] border border-white/5 relative">
                            {color.cropUrl ? (
                              <img
                                src={color.cropUrl}
                                alt={color.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{ backgroundColor: color.hex }}
                              />
                            )}
                          </div>

                          {/* Color Name & Inline Renaming */}
                          <div className="space-y-1 pt-1 border-t border-white/5">
                            {editingColorId === color.id ? (
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={tempColorName}
                                  onChange={(e) => setTempColorName(e.target.value)}
                                  placeholder="Nombre de color"
                                  className="w-full px-2 py-1 rounded bg-[#090a0f] border border-blue-500 text-xs text-white outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (tempColorName.trim().length > 0 && onUpdateColorName) {
                                        onUpdateColorName(product.id, color.id, tempColorName.trim());
                                      }
                                      setEditingColorId(null);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (tempColorName.trim().length > 0 && onUpdateColorName) {
                                      onUpdateColorName(product.id, color.id, tempColorName.trim());
                                    }
                                    setEditingColorId(null);
                                  }}
                                  className="p-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white shrink-0"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-inner"
                                    style={{ backgroundColor: color.hex }}
                                  />
                                  <span className="text-xs font-bold text-white truncate">
                                    {color.name}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingColorId(color.id);
                                    setTempColorName(color.name);
                                  }}
                                  title="Corregir nombre de color"
                                  className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {color.isUserCorrected && editingColorId !== color.id && (
                              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                                <Check className="w-2.5 h-2.5 shrink-0" />
                                <span>Color personalizado</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Discreet User Recovery Action: + Agregar variante */}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      ¿Falta algún color en la detección?
                    </span>
                    <button
                      type="button"
                      onClick={() => openAddModal(product.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium py-1 px-3 rounded-lg hover:bg-blue-500/10 border border-blue-500/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Agregar variante</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. RECIÉN DESPUÉS: Commercial Garment Identity */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#090a0f] border border-[#1e2230] space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5" />
                  <span>¿Cómo querés llamar a esta prenda?</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  {/* Name field (preloaded with AI suggestion, fully editable) */}
                  <div className="sm:col-span-8 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-400 font-medium block">
                        Nombre comercial
                      </label>
                      {identity.aiSuggestedName && identity.confirmedName !== identity.aiSuggestedName && (
                        <button
                          type="button"
                          onClick={() => handleNameChange(product.id, identity.aiSuggestedName)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        >
                          Usar sugerencia: {identity.aiSuggestedName}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={identity.confirmedName}
                      onChange={(e) => handleNameChange(product.id, e.target.value)}
                      placeholder="Ej. Remera estampada de morley"
                      className="w-full px-4 py-2.5 rounded-xl bg-[#141724] border border-[#232738] focus:border-blue-500 text-sm font-semibold text-white placeholder-gray-500 outline-none transition-all"
                    />
                  </div>

                  {/* Category Type selector */}
                  <div className="sm:col-span-4 space-y-1.5">
                    <label className="text-xs text-gray-400 font-medium block">
                      Tipo de prenda
                    </label>
                    <select
                      value={isCustomType ? 'Otro' : identity.confirmedCategory}
                      onChange={(e) => handleCategoryChange(product.id, e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#141724] border border-[#232738] focus:border-blue-500 text-sm font-medium text-white outline-none cursor-pointer"
                    >
                      {GARMENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Optional free-text field if "Otro" is selected */}
                {isCustomType && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs text-gray-400 font-medium block">
                      Escribí el tipo de prenda
                    </label>
                    <input
                      type="text"
                      value={identity.confirmedCategory === 'Otro' ? '' : identity.confirmedCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateIdentity(product.id, {
                          ...identity,
                          confirmedCategory: val,
                          source: 'USER_CORRECTED',
                          confirmedAt: new Date().toISOString(),
                        });
                      }}
                      placeholder="Ej. Kimono, Chaleco, Poncho..."
                      className="w-full px-4 py-2 rounded-xl bg-[#141724] border border-[#232738] focus:border-blue-500 text-xs text-white placeholder-gray-500 outline-none"
                    />
                  </div>
                )}

                {/* Friendly Microcopy */}
                <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Podés corregirlo. Vamos a usar tu elección como referencia comercial para esta producción.
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clean Modal: Agregar variante faltante */}
      {activeAddModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#11131c] border border-[#232738] rounded-3xl p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2230]">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-white">
                  Agregar color que no detectamos
                </h3>
                <p className="text-xs text-gray-400">
                  Subí una foto del color adicional para sumarlo a este modelo.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dropzone & Preview */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-300 block">
                Foto de la prenda en este color
              </label>
              <div className="relative border-2 border-dashed border-[#232738] hover:border-blue-500/50 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-[#0a0c12]">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleModalFileSelect(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {modalFilePreview ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={modalFilePreview}
                      alt="Preview"
                      className="w-16 h-20 rounded-xl object-cover border border-[#232738]"
                    />
                    <div className="text-left text-xs">
                      <span className="font-semibold text-white block">
                        {modalColorFile?.name}
                      </span>
                      <span className="text-gray-400">
                        Hacé clic para cambiar la foto
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 flex flex-col items-center gap-2 text-gray-400">
                    <UploadCloud className="w-8 h-8 text-blue-400" />
                    <span className="text-xs font-medium text-gray-300">
                      Subí o arrastrá la foto del color
                    </span>
                    <span className="text-[11px] text-gray-500">
                      JPG, PNG o WebP
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Color Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-300 block">
                Nombre del color
              </label>
              <input
                type="text"
                value={modalColorName}
                onChange={(e) => setModalColorName(e.target.value)}
                placeholder="Ej. Verde militar, Rosa viejo, Camel..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#141724] border border-[#232738] focus:border-blue-500 text-sm text-white placeholder-gray-500 outline-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAddModal}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar variante</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pt-4 border-t border-[#1e2230] flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <button
          type="button"
          onClick={handleContinue}
          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 group"
        >
          <span>Continuar</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
