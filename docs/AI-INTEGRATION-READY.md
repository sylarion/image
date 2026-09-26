# AI Integration Ready — Catalog AI

Este documento certifica que la fase de **HARDENING** de Catalog AI se encuentra 100% completada y que la arquitectura está desacoplada, probada y lista para recibir cualquier proveedor real de síntesis y visión artificial (o realizar un benchmark A/B entre varios motores) **sin modificar la capa visual ni los contratos de dominio**.

---

## 1. ¿Qué está preparado? (Hardened & Verified)

1. **ImageAsset Domain Model**:
   - Abstracción unificada `ImageAsset` que reemplaza URLs directas con tipado estricto:
     - `type`: `REFERENCE` | `GENERATED`
     - `source`: `UPLOAD` | `AI` | `MOCK`
     - Metadatos: `width`, `height`, `mimeType`, `createdAt`.
2. **Normalized GenerationRequest**:
   - Contrato agnóstico de generación que encapsula:
     - `garmentLock`: Fuente inmutable de la prenda.
     - `modelLock`: Rasgos y fisionomía fijada.
     - `packageType`: `ECOMMERCE` | `CATALOG`.
     - `shotType`: `FRONT`, `SIDE`, `BACK`, `DETAIL`, `COMMERCIAL`, `ALTERNATIVE`, `DYNAMIC`.
     - `referenceImages`: Conjunto de `ImageAsset`.
3. **Prompt Compiler (`lib/ai/prompt-compiler/index.ts`)**:
   - Transforma el `GenerationRequest` en directivas estructuradas:
     - `PRODUCT CONSTRAINTS`
     - `MODEL CONSTRAINTS`
     - `CAMERA`
     - `POSE`
     - `LIGHTING`
     - `BACKGROUND`
     - `NEGATIVE CONSTRAINTS`
   - **Garantía Verificada**: Los atributos críticos de `garmentLock.mustPreserve` se inyectan sin pérdida de información.
4. **Validation Pipeline Desacoplado (`lib/ai/validation/index.ts`)**:
   - Servicio independiente `validateGeneratedAsset()` que separa la síntesis visual de la auditoría.
   - Umbrales formales:
     - `≥ 90%` → `APPROVED`
     - `75% - 89%` → `REVIEW_REQUIRED`
     - `< 75%` → `REJECTED`
5. **Finite State Machine (`lib/ai/job-state-machine.ts`)**:
   - Estados: `QUEUED` → `GENERATING` → `VALIDATING` → (`APPROVED` | `REVIEW_REQUIRED` | `REJECTED` | `FAILED`).
   - Límite de intentos: `MAX_GENERATION_ATTEMPTS = 3`.
   - Transiciones bloqueadas contra saltos arbitrarios.
6. **Provider Capabilities Metadata**:
   - Metadatos en `ImageGenerationProvider`: `supportsImageReference`, `supportsMultipleReferences`, `supportsSeed`, `supportsNegativePrompt`, `supportsImageToImage`, `maxReferenceCount`.
7. **Storage Boundary (`StorageMode`)**:
   - Soporte explícito de `STORAGE_MODE="mock" | "database"`.
   - `DatabaseProjectRepository` como adapter boundary para PostgreSQL / Supabase / Neon.
8. **Seguridad y Validación de Uploads**:
   - Límites: `MAX_REFERENCE_IMAGES = 6`, `MAX_FILE_SIZE = 10MB`.
   - Validación y sanitización estricta de nombres y tipos MIME (`image/jpeg`, `image/png`, `image/webp`).

---

## 2. ¿Qué continúa siendo Mock?

1. **`MockImageGenerationProvider`**:
   - Simula la síntesis fotográfica sirviendo activos preseleccionados de alta resolución en Unsplash basados en la categoría (`Vestido`, `Mono`, `Remera`, etc.) y el `shotType`.
   - Simula la validación multimodal devolviendo scores coherentes con variaciones sutiles.
2. **`InMemoryProjectRepository`**:
   - El almacenamiento predeterminado sigue siendo en memoria con persistencia en el ciclo de vida del servidor (ideal para testing y demos).

---

## 3. ¿Dónde conectar un proveedor real?

Basta con crear una clase que implemente `ImageGenerationProvider` y registrarla en el factory:

```typescript
// lib/ai/fal-provider.ts (Ejemplo de proveedor real)
import { ImageGenerationProvider, ProviderCapabilities, AnalyzeGarmentOptions } from './provider.interface';
import { GenerationRequest, ImageAsset, GarmentLock, GarmentValidationResult } from '@/types';
import { compileGenerationPrompt } from './prompt-compiler';

export class FalAIProvider implements ImageGenerationProvider {
  readonly id = 'fal-ai';
  readonly name = 'Fal.ai Flux Ultra Fashion Engine';

  readonly capabilities: ProviderCapabilities = {
    supportsImageReference: true,
    supportsMultipleReferences: true,
    supportsSeed: true,
    supportsNegativePrompt: true,
    supportsImageToImage: true,
    maxReferenceCount: 4,
  };

  async analyzeGarment(options: AnalyzeGarmentOptions): Promise<GarmentLock> {
    // 1. Enviar referenceImages a GPT-4o / Claude 3.5 Sonnet / Gemini Vision
    // 2. Extraer y devolver el GarmentLock estructurado
  }

  async generateImage(request: GenerationRequest): Promise<ImageAsset> {
    // 1. Compilar directivas agnósticas
    const compiled = compileGenerationPrompt(request);
    // 2. Invocar endpoint del proveedor con compiled.rawCombinedPrompt y referenceImages
    // 3. Devolver ImageAsset con la URL resultante
  }

  async validateImage(generatedAsset: ImageAsset, garment: GarmentLock): Promise<GarmentValidationResult> {
    // 1. Comparar visualmente con un modelo multimodal
    // 2. Devolver scores y array de issues detectados
  }
}
```

Para activarlo, simplemente se añade al factory en [lib/ai/index.ts](file:///c:/Users/Morales/Documents/app/image/lib/ai/index.ts).

---

## 4. Variables de Entorno Necesarias

Plantilla documentada en `.env.example`:

```bash
# Modo de almacenamiento: 'mock' | 'database'
STORAGE_MODE=mock

# Modo de IA: 'mock' | 'fal' | 'replicate' | 'custom'
AI_PROVIDER=mock

# Credenciales de API (a configurar cuando se agregue el proveedor real)
# FAL_KEY=
# REPLICATE_API_TOKEN=
# STABILITY_API_KEY=

# Base de datos (a configurar cuando se active STORAGE_MODE=database)
# DATABASE_URL="postgresql://user:password@host:5432/catalog_ai?sslmode=require"
```

---

## 5. Flujo Completo de una Generación (End-to-End)

```
1. Upload de referencias (JPG/PNG/WebP, máx 10MB)
   ↓
2. POST /api/garments/analyze ──> Provider.analyzeGarment() ──> GarmentLock
   ↓
3. Auditoría visual humana (GarmentLockCard & ModelLockSelector)
   ↓
4. Selección de tomas (E-commerce / Catálogo Premium)
   ↓
5. POST /api/generations ──> GenerationRequest normalizado
   ↓
6. Prompt Compiler (Inyecta PRODUCT CONSTRAINTS, MODEL CONSTRAINTS, SHOT, NEGATIVES)
   ↓
7. Provider.generateImage() (Sintetiza ImageAsset)
   ↓
8. State Machine: QUEUED ──> GENERATING ──> VALIDATING
   ↓
9. validateGeneratedAsset() (Desglosa Color, Forma, Estampa, Detalles)
   ↓
10. State Machine:
    ├── Si score >= 90%  ──> APPROVED
    ├── Si 75% - 89%     ──> REVIEW_REQUIRED
    └── Si < 75%         ──> REJECTED
   ↓
11. POST /api/generations/:id/regenerate (Bounded: max 3 intentos)
```

---

## 6. Riesgos Técnicos y Deuda Pendiente Antes del Benchmark Real

1. **Dual-Model Architecture (Generador vs Validador)**:
   - Para evitar sesgos de confirmación, se recomienda utilizar un motor para síntesis (ej. Flux LoRA / SDXL) y un modelo de visión independiente para validación (ej. Gemini 1.5 Pro / GPT-4o Vision).
2. **Tiempos de Invocación Serverless**:
   - En modelos de difusión pesados con inferencia de 15 a 30 segundos, las Route Handlers de Next.js en Vercel Hobby tienen un timeout de 10s (60s en Pro). Se recomienda implementar webhooks asíncronos cuando se conecte el motor real.
3. **Persistencia en Producción**:
   - `STORAGE_MODE=database` está preparado a nivel de interfaz (`IDatabaseProjectRepository`); al conectar Neon o Supabase bastará proveer el cliente Prisma/Kysely en `DatabaseProjectRepository`.
