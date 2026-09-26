'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GarmentCategory, ImageAsset } from '@/types';
import { 
  UploadCloud, 
  Trash2, 
  Plus, 
  Sparkles, 
  Info, 
  ArrowRight,
  MoveUp,
  MoveDown,
  Loader2
} from 'lucide-react';
import { MAX_REFERENCE_IMAGES, MAX_FILE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '@/lib/schemas/project';

const CATEGORIES: GarmentCategory[] = [
  'Vestido',
  'Mono',
  'Remera',
  'Camisa',
  'Pantalón',
  'Short',
  'Pollera',
  'Campera',
  'Sweater',
  'Conjunto',
  'Otro',
];

const PRESET_SAMPLE_PHOTOS = [
  {
    name: 'Muestra Lino (Frontal)',
    url: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?auto=format&fit=crop&w=800&q=80',
    mimeType: 'image/jpeg',
  },
  {
    name: 'Muestra Bordado (Detalle)',
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80',
    mimeType: 'image/jpeg',
  },
  {
    name: 'Muestra Seda (Studio)',
    url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    mimeType: 'image/jpeg',
  },
];

export function NewProductionWizard() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('Mono');
  const [sizesInput, setSizesInput] = useState('S, M, L');
  const [images, setImages] = useState<ImageAsset[]>([
    {
      id: 'samp-1',
      type: 'REFERENCE',
      source: 'MOCK',
      name: 'prenda-frente.jpg',
      url: PRESET_SAMPLE_PHOTOS[0].url,
      mimeType: 'image/jpeg',
      order: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'samp-2',
      type: 'REFERENCE',
      source: 'MOCK',
      name: 'prenda-detalle.jpg',
      url: PRESET_SAMPLE_PHOTOS[1].url,
      mimeType: 'image/jpeg',
      order: 1,
      createdAt: new Date().toISOString(),
    }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (images.length + files.length > MAX_REFERENCE_IMAGES) {
      setError(`No podés subir más de ${MAX_REFERENCE_IMAGES} imágenes de referencia.`);
      return;
    }

    const newImgs: ImageAsset[] = [];

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];

      // Validate file size (10MB)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`El archivo ${file.name} supera el límite de 10MB.`);
        return;
      }

      // Validate MIME type
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
        setError(`Formato no permitido en ${file.name}. Solo se aceptan JPG, PNG y WebP.`);
        return;
      }

      newImgs.push({
        id: `up-${Date.now()}-${idx}`,
        type: 'REFERENCE',
        source: 'UPLOAD',
        name: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'), // Sanitized filename
        url: URL.createObjectURL(file),
        mimeType: file.type,
        order: images.length + idx,
        createdAt: new Date().toISOString(),
      });
    }

    setImages((prev) => [...prev, ...newImgs]);
    setError(null);
  };

  const addPresetSample = (sample: typeof PRESET_SAMPLE_PHOTOS[0]) => {
    if (images.length >= MAX_REFERENCE_IMAGES) {
      setError(`Límite máximo de ${MAX_REFERENCE_IMAGES} imágenes alcanzado.`);
      return;
    }

    setImages((prev) => [
      ...prev,
      {
        id: `preset-${Date.now()}`,
        type: 'REFERENCE',
        source: 'MOCK',
        name: sample.name,
        url: sample.url,
        mimeType: sample.mimeType,
        order: prev.length,
        createdAt: new Date().toISOString(),
      }
    ]);
    setError(null);
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === images.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const copy = [...images];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    copy.forEach((img, i) => (img.order = i));
    setImages(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor ingresá el nombre de la prenda');
      return;
    }
    if (images.length === 0) {
      setError('Tenés que subir al menos una fotografía de referencia');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);

      const parsedSizes = sizesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          sizes: parsedSizes.length > 0 ? parsedSizes : ['Único'],
          images,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al procesar el análisis');
      }

      router.push(`/productions/${data.data.id}`);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error inesperado');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <span className="text-xs font-mono uppercase tracking-wider text-blue-400">Paso 1 de 3</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1">Nueva Producción</h1>
        <p className="text-sm text-[#8e96aa] mt-1">
          Subí fotografías reales de tu prenda. El motor de visión artificial extraerá automáticamente los atributos críticos para bloquear la consistencia de tu producto.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="p-6 rounded-2xl bg-[#11131a] border border-[#1e2230] space-y-6">
          <h2 className="text-base font-semibold text-white">Datos de la Prenda</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="garment-name" className="text-xs font-medium text-gray-300">
                Nombre de la prenda <span className="text-rose-400">*</span>
              </label>
              <input
                id="garment-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Mono Floreal, Vestido Victoria..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#090a0f] border border-[#1e2230] text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="garment-category" className="text-xs font-medium text-gray-300">
                Categoría <span className="text-rose-400">*</span>
              </label>
              <select
                id="garment-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#090a0f] border border-[#1e2230] text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-2">
              <label htmlFor="garment-sizes" className="text-xs font-medium text-gray-300">
                Talles disponibles (separados por coma)
              </label>
              <input
                id="garment-sizes"
                type="text"
                value={sizesInput}
                onChange={(e) => setSizesInput(e.target.value)}
                placeholder="Ej. S, M, L o 1, 2, 3, 4"
                className="w-full px-4 py-2.5 rounded-xl bg-[#090a0f] border border-[#1e2230] text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[#11131a] border border-[#1e2230] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Subí fotografías reales de la prenda</h2>
              <p className="text-xs text-[#8e96aa] mt-0.5">
                Cuantas más vistas tengamos, mejor podremos preservar los detalles del producto (Máx. {MAX_REFERENCE_IMAGES} imágenes).
              </p>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-blue-400">
              <Info className="w-4 h-4" />
              <span>Formatos JPG, PNG, WebP (máx. 10MB)</span>
            </div>
          </div>

          <label 
            htmlFor="photo-upload"
            className="flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed border-[#1e2230] hover:border-blue-500/60 rounded-2xl bg-[#090a0f]/50 hover:bg-[#090a0f] transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <UploadCloud className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-white text-center">
              Arrastrá las fotos aquí o hacé click para seleccionar
            </p>
            <p className="text-xs text-[#8e96aa] mt-1 text-center">
              Fotos de frente, espalda, detalles de costura, botamangas o texturas
            </p>
            <input
              id="photo-upload"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <div className="pt-2">
            <span className="text-xs text-gray-400 block mb-2">O agregá fotos de muestra para probar la demo:</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_SAMPLE_PHOTOS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => addPresetSample(sample)}
                  className="px-3 py-1.5 rounded-lg bg-[#161923] hover:bg-[#1e2230] border border-[#232736] text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          {images.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-[#1e2230]">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Fotografías Cargadas ({images.length}/{MAX_REFERENCE_IMAGES})
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {images.map((img, index) => (
                  <div
                    key={img.id}
                    className="group relative rounded-xl border border-[#1e2230] bg-[#090a0f] overflow-hidden"
                  >
                    <div className="aspect-square w-full bg-black/60 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.name || `Referencia ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-white">
                        #{index + 1}
                      </div>
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-blue-600/80 backdrop-blur-sm text-[9px] font-mono text-white">
                        {img.source}
                      </div>
                    </div>

                    <div className="p-2 flex items-center justify-between gap-1 bg-[#11131a]">
                      <span className="text-[11px] text-gray-300 truncate font-mono">
                        {img.name || 'foto.jpg'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30"
                          title="Mover arriba"
                        >
                          <MoveUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(index, 'down')}
                          disabled={index === images.length - 1}
                          className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30"
                          title="Mover abajo"
                        >
                          <MoveDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="p-1 rounded text-gray-400 hover:text-rose-400 hover:bg-rose-950/40"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isAnalyzing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium text-base shadow-xl shadow-blue-600/20 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Analizando producto...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Analizar Prenda y Bloquear Consistencia</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
