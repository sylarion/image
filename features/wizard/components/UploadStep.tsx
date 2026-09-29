'use client';

import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Trash2, 
  Sparkles, 
  ArrowRight, 
  Check, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { MAX_FILE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '@/lib/schemas/project';

interface UploadStepProps {
  onImagesUploaded: (uploadedFiles: { id: string; url: string; name: string }[]) => void;
  isAnalyzing: boolean;
  analyzingMessage: string;
  analysisError?: string;
}

export function UploadStep({
  onImagesUploaded,
  isAnalyzing,
  analyzingMessage,
  analysisError,
}: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<{ id: string; url: string; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    setIsUploading(true);

    const uploadedList: { id: string; url: string; name: string }[] = [...selectedFiles];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_FILE_SIZE_BYTES) {
          setErrorMessage(`"${file.name}" supera el tamaño máximo permitido de 10 MB.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/uploads', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Error al subir ${file.name}`);
        }

        const json = await res.json();
        if (json.success && json.data) {
          uploadedList.push({
            id: json.data.id,
            url: json.data.url,
            name: json.data.originalFilename || file.name,
          });
        }
      }

      setSelectedFiles(uploadedList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir la imagen';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = selectedFiles.filter((_, idx) => idx !== index);
    setSelectedFiles(updated);
  };

  const handleContinue = () => {
    if (selectedFiles.length === 0) return;
    onImagesUploaded(selectedFiles);
  };

  if (isAnalyzing) {
    return (
      <div className="py-16 text-center space-y-6 max-w-md mx-auto animate-fade-in">
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-blue-400">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Analizando tu prenda...
          </h3>
          <p className="text-sm text-gray-400 font-medium">
            {analyzingMessage || 'Revisando detalles de la foto'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          <span>Separando colores y silueta</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Subí una foto de tu prenda o de tu catálogo
        </h2>
        <p className="text-sm text-gray-400">
          Puede ser una prenda sola, en percha, sobre maniquí, modelo o con varios colores juntos.
        </p>
      </div>

      {analysisError && (
        <div role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{analysisError}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFilesSelected(e.dataTransfer.files);
        }}
        className="p-8 sm:p-12 rounded-3xl border-2 border-dashed border-[#232738] hover:border-blue-500/60 bg-[#0d0f17] hover:bg-[#11131c] transition-all cursor-pointer text-center space-y-4 group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
          {isUploading ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : (
            <UploadCloud className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-1">
          <span className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors block">
            {isUploading ? 'Subiendo archivos...' : 'Hacé clic para elegir tu foto o arrastrala acá'}
          </span>
          <p className="text-xs text-gray-400">
            JPG, PNG o WebP hasta 10 MB. Podés seleccionar más de una foto a la vez.
          </p>
        </div>
      </div>

      {/* Selected Photos Preview List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-gray-400 font-medium">
            <span>Fotos listas para analizar ({selectedFiles.length})</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Preparadas
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selectedFiles.map((file, idx) => (
              <div
                key={file.id || idx}
                className="relative group p-2 rounded-2xl bg-[#11131c] border border-[#1e2230] overflow-hidden"
              >
                <div className="aspect-[3/4] w-full rounded-xl overflow-hidden bg-black/60 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(idx);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[11px] text-gray-300 font-medium truncate mt-1.5 px-0.5">
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue CTA */}
      <div className="flex justify-end pt-4 border-t border-[#1e2230]">
        <button
          onClick={handleContinue}
          disabled={selectedFiles.length === 0 || isUploading}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/25 active:scale-98"
        >
          <span>Analizar prenda</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
