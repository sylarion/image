# FASE A: REAL IMAGE INGESTION — INFORME DE IMPLEMENTACIÓN

**Proyecto:** Catalog AI (`imagen`)  
**Fecha:** 26 de Septiembre de 2026  
**Fase:** Fase A — Ingesta Real de Imágenes, Transporte Binario y Almacenamiento Persistente  
**Estado:** COMPLETADO CON ÉXITO (Gates 100% Verificados)

---

## 1. Resumen Ejecutivo de la Fase A

La Fase A resuelve de raíz el primer gran problema identificado en `docs/IMAGE_PIPELINE_AUDIT.md`: **la ruptura del transporte binario entre el navegador y el backend**.

Anteriormente, el frontend generaba URLs de tipo `blob:http://localhost:3000/...` que no contenían bytes accesibles por el servidor. Como consecuencia, Gemini recibía texto plano en lugar de imágenes, el validador era ciego y el backend carecía de almacenamiento persistente.

Con la implementación de la Fase A:
1. Las imágenes se envían mediante **`multipart/form-data`** real al nuevo endpoint `POST /api/uploads`.
2. Se normalizan de manera determinística mediante **`sharp`** (rotación EXIF automática, conversión a sRGB, sanitización de metadata, preservación visual y extracción de dimensiones).
3. Se detecta el tipo MIME real mediante **inspección de magic bytes** (JPEG, PNG, WebP), rechazando suplantaciones de extensión.
4. Se calcula el hash **SHA-256** de los bytes normalizados para evitar almacenar duplicados (Deduplicación activa).
5. Se implementa una **abstracción de almacenamiento** (`ImageStorage`) con un proveedor local (`LocalStorageProvider`) en `public/uploads`, desacoplado y listo para migrar a S3/R2/GCS.
6. Se crea la entidad formal de dominio **`SourceImage`**.
7. Se actualiza `POST /api/projects` para recibir `{ sourceImageId }`, resolviendo internamente los metadatos y rechazando de forma estricta cualquier URL de tipo `blob:`.
8. Se corrigen `GeminiGarmentAnalyzer` y `GeminiImageValidator` para resolver los bytes reales y transmitirlos a la API de Gemini como `inline_data` base64.

---

## 2. Arquitectura Implementada

```mermaid
flowchart TD
    subgraph Client["Navegador Cliente (NewProductionWizard)"]
        F[File del Usuario] --> P["URL.createObjectURL(file)<br/>(Preview temporal e instantáneo)"]
        F --> M["FormData('file', file)"]
        M -->|POST /api/uploads| UP["Upload API Handler"]
    end

    subgraph Backend_Ingestion["Backend Ingestion Pipeline"]
        UP --> SEC["Seguridad & Magic Bytes<br/>(JPEG: FF D8 FF / PNG: 89 50 / WebP: RIFF)"]
        SEC --> SHARP["Sharp Normalizer<br/>(rotate EXIF, toColorspace srgb,<br/>strip metadata, extract width/height)"]
        SHARP --> SHA["Cálculo SHA-256"]
        SHA --> DEDUP{"¿Existe SHA-256 en SourceImageRepository?"}
        
        DEDUP -->|SÍ (Duplicado)| RET["Retorna SourceImage Existente"]
        DEDUP -->|NO (Nuevo)| STORE["ImageStorage.put(key, buffer)<br/>(/public/uploads/src-...)"]
        
        STORE --> ENT["Crea entidad SourceImage<br/>(role: UNKNOWN, source: USER_UPLOAD)"]
        ENT --> REPO["SourceImageRepository.save()"]
        REPO --> RET2["Retorna 201 Created + SourceImage"]
    end

    subgraph Project_Creation["Creación de Producción"]
        Client -->|POST /api/projects<br/>{ sourceImageId }| PROJ["POST /api/projects"]
        PROJ --> RESOLVE["SourceImageRepository.getById()"]
        RESOLVE --> ASSET["Construye ImageAsset persistente<br/>(url, width, height, sha256)"]
        ASSET --> GUARDBLOB{"¿Contiene blob:?"}
        GUARDBLOB -->|SÍ| REJ["Rechaza con HTTP 400"]
        GUARDBLOB -->|NO| PROV["Provider.analyzeGarment()"]
    end

    subgraph Multimodal_AI["Integración Multimodal Gemini"]
        PROV --> GEMINI_A["GeminiGarmentAnalyzer"]
        GEMINI_A --> BYTES_A["resolveImageBytes(asset)"]
        BYTES_A --> BASE64_A["inline_data: { mime_type, data: base64 }"]
        BASE64_A --> API_A["Google Gemini 2.5 Flash REST API<br/>(Text Prompt + Image Bytes)"]
        
        PROV --> GEMINI_V["GeminiImageValidator"]
        GEMINI_V --> BYTES_V["resolveImageBytes(generated & reference)"]
        BYTES_V --> BASE64_V["inline_data para cada imagen"]
        BASE64_V --> API_V["Google Gemini Vision Audit<br/>(Píxeles reales analizados)"]
    end
```

---

## 3. Contratos y Entidades

### Entidad `SourceImage` (`types/index.ts`)
```typescript
export interface SourceImage {
  id: string;
  originalFilename: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  storageKey: string;
  url: string;
  createdAt: string;
  role: 'UNKNOWN';
  source: 'USER_UPLOAD';
}
```

### Abstracción de Almacenamiento `ImageStorage` (`lib/storage/image-storage.ts`)
```typescript
export interface ImageStorage {
  put(key: string, buffer: Buffer, mimeType: string): Promise<{ storageKey: string; url: string }>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): string;
}
```

### Esquema de Creación de Proyecto (`lib/schemas/project.ts`)
```typescript
export const ProjectImageInputSchema = z.union([
  z.object({
    sourceImageId: z.string().min(1, 'sourceImageId es requerido'),
    order: z.number().int().nonnegative().optional(),
  }),
  ImageAssetSchema,
]);
```
`ImageAssetSchema` valida que la propiedad `url` jamás comience con `blob:`.

---

## 4. Archivos Creados y Modificados

### Archivos Creados
1. `lib/images/normalizer.ts`:
   - Detección de magic bytes (`detectMimeFromMagicBytes`).
   - Normalización determinística vía `sharp` (`rotate()`, `toColorspace('srgb')`, límite de 4096px sin deformación).
   - Cálculo de hash SHA-256 (`computeSha256`).
   - Sanitización de nombres de archivo y límites de seguridad (máximo 10 MB).
2. `lib/storage/image-storage.ts`:
   - Interfaz `ImageStorage`.
   - Implementación `LocalStorageProvider` con guardas anti path-traversal.
   - Función helper `resolveImageBytes(input)` para obtener búfers reales desde almacenamiento, URLs públicas o base64.
3. `lib/storage/source-image.repository.ts`:
   - Repositorio `InMemorySourceImageRepository` con indexación por SHA-256 para deduplicación instantánea.
4. `app/api/uploads/route.ts`:
   - Endpoint `POST /api/uploads` para recepción multipart, normalización, guardado y deduplicación.
5. `tests/phase-a-ingestion.test.ts`:
   - Suite completa con 13 pruebas unitarias y de integración.
6. `docs/PHASE_A_REAL_IMAGE_INGESTION.md`:
   - Documentación técnica y reporte forense de la Fase A.

### Archivos Modificados
1. `types/index.ts`:
   - Declaración de `SourceImage`.
   - Extensión de `ImageAsset` con `sourceImageId`, `sha256`, `storageKey`, `byteSize`.
2. `lib/schemas/project.ts`:
   - Inclusión de `ProjectImageInputSchema`.
   - Regla de rechazo estricta para `blob:` URLs en `ImageAssetSchema`.
3. `app/api/projects/route.ts`:
   - Resolución de `sourceImageId` contra `SourceImageRepository`.
   - Construcción de `ImageAsset` enriquecido con dimensiones y storageKey.
4. `app/api/garments/analyze/route.ts`:
   - Soporte para `ProjectImageInputSchema` y resolución binaria.
5. `lib/ai/gemini-analyzer.ts`:
   - Reemplazo del placeholder de texto plano `[REFERENCE IMAGE URL: ...]` por partes `inline_data` reales con bytes en base64.
6. `lib/ai/gemini-validator.ts`:
   - Inyección multimodal de bytes binarios para la imagen generada y las referencias originales.
7. `features/garments/components/NewProductionWizard.tsx`:
   - Subida automática e incremental de archivos hacia `POST /api/uploads`.
   - Reemplazo transparente del `blob:` de preview por el `sourceImageId` persistente.
   - Deshabilitación del botón de submit mientras hay cargas en curso.
8. `package.json`:
   - Instalación de `sharp`.
   - Actualización del script `test` para correr suites de hardening y de ingesta binaria.

---

## 5. Pruebas Ejecutadas y Gates de Aceptación

### 1. Suite de Pruebas Automatizadas (`npm test`)
```bash
> tsx tests/hardening.test.ts && tsx tests/phase-a-ingestion.test.ts

Suite Hardening:
✓ Front-only correctly yields UNKNOWN for BACK
✓ Hard gates strictly reject failures regardless of overallScore
✓ ShotContracts and ProductionPoseHistory directives properly compiled
✓ All 4 shots require gaze CAMERA
✓ Zod schema successfully validates GenerationRequest (5/5 suites)

Suite Phase A Real Image Ingestion:
1. Testing JPG upload & normalization...
   ✓ JPG recognized by magic bytes, normalized and hashed.
2. Testing PNG upload & normalization...
   ✓ PNG recognized by magic bytes, normalized and hashed.
3. Testing WebP upload & normalization...
   ✓ WebP recognized by magic bytes, normalized and hashed.
4. Testing rejection of invalid MIME / fake file...
   ✓ Non-image files correctly rejected via magic byte inspection.
5. Testing rejection of oversized files (>10MB)...
   ✓ Files > 10MB strictly rejected before processing.
6. Testing accurate dimension extraction...
   ✓ Dimensions correctly extracted: 640x480.
7. Testing EXIF auto-rotate with sharp...
   ✓ EXIF auto-rotate pipeline successfully executed.
8. Testing SHA-256 deduplication...
   ✓ Deduplication successfully identified duplicate file via SHA-256.
9. Testing persistent storage retrieval...
   ✓ Storage write, get and resolveImageBytes passed.
10. Testing Project creation from SourceImage ID inputs...
   ✓ CreateProjectSchema validates sourceImageId input successfully.
11. Testing strict rejection of blob: URLs...
   ✓ blob: URLs strictly rejected across schemas and resolvers.
12. Testing Gemini analyzer multimodal byte payload...
   ✓ Gemini analyzer payload formats real inline_data bytes (no text URLs).
13. Testing Gemini validator multimodal byte payload...
   ✓ Gemini validator payload successfully resolves generated image bytes.

🎉 ALL PHASE A REAL INGESTION TESTS PASSED! (13/13 suites)
TOTAL: 18/18 suites pasando exitosamente.
```

### 2. Comprobación Estricta de Tipos TypeScript (`npx tsc --noEmit`)
- **Resultado:** Código de salida `0` (Zero errores de compilación).

### 3. Compilación de Producción Next.js (`npm run build`)
- **Resultado:** Código de salida `0`. Todas las rutas estáticas y dinámicas (incluyendo `/api/uploads`) compiladas correctamente con Turbopack.

### 4. Verificación de Formato y Diff (`git diff --check`)
- **Resultado:** Código de salida `0`. Sin espacios en blanco residuales ni conflictos de formato.

---

## 6. Diferencias con Respecto a `IMAGE_PIPELINE_AUDIT.md`

| Aspecto | Diagnóstico en Auditoría (`IMAGE_PIPELINE_AUDIT.md`) | Estado Actual Post Fase A |
| :--- | :--- | :--- |
| **Ingesta de Imágenes** | Se usaban `URL.createObjectURL(file)` efímeras que morían en el cliente. | Upload real `multipart/form-data` hacia `POST /api/uploads`. |
| **Almacenamiento** | Inexistente. Las imágenes no se guardaban en ningún lado en el servidor. | Almacenamiento persistente en `public/uploads` gestionado por `LocalStorageProvider`. |
| **Normalización** | Cero normalización ni sanitización. | `sharp` normaliza a sRGB, rota por EXIF y extrae dimensiones seguras. |
| **Seguridad de Archivos**| Se confiaba ciegamente en `file.type`. | Inspección estricta de Magic Bytes; rechazo de binarios corruptos o maliciosos. |
| **Deduplicación** | Ninguna. Dos subidas iguales creaban dos assets idénticos. | Detección por SHA-256 de los bytes normalizados; reutilización de `SourceImage`. |
| **Entidad de Origen** | No existía. Solo existía un `ImageAsset` plano sin metadata de archivo. | Entidad `SourceImage` fuertemente tipada con `sha256`, `byteSize`, `storageKey`. |
| **Gemini Analyzer** | Inyectaba texto plano `[REFERENCE IMAGE URL: ...]`. | Lee bytes reales de disco y los transmite como `inline_data` base64. |
| **Gemini Validator** | Solo enviaba texto; no adjuntaba imágenes para validar. | Resuelve bytes de la imagen generada y de las referencias y los envía como `inline_data`. |

---

## 7. Limitaciones Restantes y Preparación para Fase B

En cumplimiento estricto con las restricciones de la Fase A, **no se implementó**:
- Clasificación visual de roles (`role` permanece como `'UNKNOWN'`).
- Creación de `REFERENCE_SET` ni clasificación automática de ángulos (Frente vs Espalda).
- Detección de prendas, SAM, segmentación ni Bounding Boxes.
- Ficha técnica estructural `GARMENT_DNA`.
- Cambios en el motor FLUX de Fal.ai.
- Ciclo de auto-regeneración.

Con los cimientos binarios 100% estabilizados y verificados, el sistema está listo para abordar la **Fase B: Detección y Segmentación de Variantes**.
