# Auditoría de Hardening Técnica — Catalog AI

Fecha: 25 de Septiembre de 2026
Alcance: Auditoría completa de código, tipos, repositorio, abstracciones de IA y pipeline antes de la integración con proveedores reales.

---

## 1. Resumen Ejecutivo de Hallazgos

| ID | Componente | Severidad | Descripción del Hallazgo | Estado |
|---|---|---|---|---|
| **AUD-01** | `Storage / Persistence` | **CRITICAL** | `InMemoryProjectRepository` se declara como persistente en serverless/Vercel en la doc previa, lo cual es técnicamente falso: una lambda/función serverless pierde memoria en cold starts e instancias paralelas. No existe frontera explícita `StorageMode` ni interfaz de BD. | **A CORREGIR EN FASE 2** |
| **AUD-02** | `Job State Machine` | **CRITICAL** | Las transiciones de estado de `GenerationJob` se ejecutan ad-hoc en Route Handlers sin máquina de estados formal. Se omite el estado obligatorio `REVIEW_REQUIRED`, dejando inconsistencias entre `APPROVED` y `VALIDATING`. | **A CORREGIR EN FASE 8** |
| **AUD-03** | `AI Generation Pipeline` | **HIGH** | `generateImage` y `validateImage` estaban acoplados en el handler de API y no existía `PromptCompiler`. Los prompts no estaban modelados como una capa agnóstica independiente de proveedor ni extraían `mustPreserve`. | **A CORREGIR EN FASE 4 Y 5** |
| **AUD-04** | `Image Assets Modeling` | **HIGH** | `GarmentLock.referenceImages` utilizaba URLs crudas en lugar de un modelo de dominio normalizado `ImageAsset` que distinga fuente (`UPLOAD`, `AI`, `MOCK`) y tipo (`REFERENCE`, `GENERATED`). | **A CORREGIR EN FASE 3** |
| **AUD-05** | `Security / Uploads` | **HIGH** | Falta validación estricta de payloads binarios/imágenes (Magic bytes, tipos permitidos, límite de tamaño y cantidad de referencias) previa al análisis. | **A CORREGIR EN FASE 10** |
| **AUD-06** | `Validation Pipeline` | **MEDIUM** | La validación de imágenes estaba embebida directamente en el provider mock sin un servicio desacoplado `validateGeneratedAsset` que soporte inputs de auditoría y comparación con `mustPreserve`. | **A CORREGIR EN FASE 6** |
| **AUD-07** | `Regeneration Limits` | **MEDIUM** | No existía contrato `RegenerationRequest` ni límite de intentos (`MAX_GENERATION_ATTEMPTS = 3`). | **A CORREGIR EN FASE 7** |
| **AUD-08** | `Provider Capabilities` | **LOW** | `ImageGenerationProvider` no exponía flags de capacidades (`supportsImageReference`, `supportsNegativePrompt`, etc.) para soportar benchmarking A/B de diferentes motores. | **A CORREGIR EN FASE 11** |

---

## 2. Detalle de Correcciones Mandatorias

### AUD-01 (CRITICAL): Persistencia en Serverless (Vercel)
- **Problema**: `InMemoryProjectRepository` es útil exclusivamente para pruebas de desarrollo local y demos efímeras. En Vercel cada invocación puede caer en un worker aislado.
- **Acción**: Introducir explícitamente `StorageMode = "mock" | "database"`, implementar factory de almacenamiento y crear la frontera `DatabaseProjectRepository` como adapter boundary para PostgreSQL/Prisma/Supabase.

### AUD-02 (CRITICAL) & AUD-06 (MEDIUM): Máquina de Estados de Jobs
- **Problema**: `GenerationJob.status` usaba tipos laxos sin validación de transiciones permitidas. Se saltaba a `APPROVED` directamente si el score era ≥ 90%, o quedaba indefinido si requería revisión.
- **Acción**: Estados formales: `QUEUED` → `GENERATING` → `VALIDATING` → (`APPROVED` | `REVIEW_REQUIRED` | `REJECTED` | `FAILED`). Función pura `transitionJobState()` con validación estricta.

### AUD-03 (HIGH) & AUD-04 (HIGH): ImageAsset y Prompt Compiler
- **Problema**: El sistema generaba imágenes basándose en nombres de archivo y strings crudos. Ningún compilador traducía el `GarmentLock` a directivas visuales (Product Constraints, Model Constraints, Camera, Lighting, Negative Constraints).
- **Acción**:
  1. Definir contrato `ImageAsset`.
  2. Implementar `compileGenerationPrompt(request)` garantizando que `mustPreserve` sea inyectado en las directivas de preservación del producto.
