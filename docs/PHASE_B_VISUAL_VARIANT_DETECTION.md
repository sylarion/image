# FASE B: VISUAL GARMENT & VARIANT DETECTION — INFORME TÉCNICO

**Proyecto:** Catalog AI (`imagen`)  
**Fecha:** 26 de Septiembre de 2026  
**Fase:** Fase B — Detección Visual de Prendas, Bounding Boxes, Recortes Físicos, Agrupamiento de Producto y Variantes  
**Estado:** COMPLETADO CON ÉXITO (Gates 100% Verificados)

---

## 1. Resumen Ejecutivo de la Fase B

La Fase B aborda el núcleo de inteligencia visual del catálogo: **comprender qué hay dentro de cada fotografía heterogénea y separar la Identidad del Producto de la Identidad de la Variante**.

En la arquitectura anterior diagnosticada en `docs/IMAGE_PIPELINE_AUDIT.md`:
- Si una sola foto contenía 5 vestidos de distinto color, las 5 variantes terminaban recibiendo como referencia la misma foto grupal completa (vía `idx % referenceImages.length`).
- La cobertura de vistas (Frente vs Espalda) se calculaba buscando palabras clave como `"back"` o `"espalda"` en el nombre del archivo.
- No existían recortes físicos de prendas ni análisis cromático por píxel.

Con la Fase B implementada:
1. **Analizador de Escena Multimodal (`GarmentSceneAnalyzer`):** Examina los píxeles reales de cada `SourceImage` para clasificar el tipo de escena (`SINGLE_GARMENT`, `MULTIPLE_VARIANTS`, `GARMENT_ON_MODEL`, `GARMENT_ON_MANNEQUIN`, `DETAIL`) y su rol visual (`FRONT`, `BACK`, `SIDE`, `DETAIL`, `SWATCH`).
2. **Cajas Delimitadoras Normalizadas (`BoundingBox`):** Coordenadas `[0.0, 1.0]` estrictamente validadas para cada prenda detectada, aislando la prenda textil y excluyendo pedestales de maniquí o rostros de modelos.
3. **Recorte Físico Real (`PhysicalGarmentCropper`):** Extrae mediante `sharp` el sub-lienzo exacto de cada prenda en resolución nativa, calculando su SHA-256 y persistiendo el archivo en `ImageStorage`.
4. **Comprobación Cromática por Píxel (`ColorAnalyzer`):** Cuantiza los píxeles de la prenda eliminando fondo blanco de estudio y tonos de piel para confirmar objetivamente el color dominante.
5. **Separación de Identidad (`ProductGroupingService`):**
   - **`ProductIdentity`:** Determinada por moldería y confección (silueta, cuello, mangas, largo, detalles). Si dos vestidos comparten moldería pero difieren en color, son el **mismo producto**. Si uno tiene mangas y otro no, son **productos distintos**.
   - **`VariantIdentity`:** Representa cada colorway (`GarmentVariant`), garantizando que cada variante posea su propio `referenceCrop` físico y nunca la foto grupal completa.
   - **`ReferenceSet`:** Agrupador de vistas (`GarmentReference`) con asignación visual de roles (`FRONT`, `BACK`, `DETAIL`), independiente de nombres de archivo.
6. **Estrategia Progresiva de Segmentación:** Nivel 1 (Bounding Box + Sharp) activo por defecto; interfaz `GarmentSegmenter` preparada para incorporar SAM/SAM2 en la nube cuando sea necesario.
7. **Interfaz de Verificación (`SceneAnalysisInspector`):** Componente UI para inspeccionar detecciones, bounding boxes, recortes, confianza y corregir manualmente roles o colores.

---

## 2. Contratos y Entidades de Dominio (`types/detection.ts`)

```typescript
export interface BoundingBox {
  x: number;      // Normalizado 0.0 a 1.0
  y: number;      // Normalizado 0.0 a 1.0
  width: number;  // Normalizado 0.0 a 1.0
  height: number; // Normalizado 0.0 a 1.0
}

export interface DetectedGarment {
  detectionId: string;
  boundingBox: BoundingBox;
  confidence: number;
  probableCategory: string;
  dominantColor: {
    name: string;
    hex: string;
    confidence: number;
  };
  orientation: 'FRONT' | 'BACK' | 'SIDE' | 'UNKNOWN';
  visualSignature?: GarmentVisualSignature;
  sameProductGroup?: string;
}

export interface GarmentCrop {
  id: string;
  sourceImageId: string;
  detectionId: string;
  storageKey: string;
  url: string;
  width: number;
  height: number;
  sha256: string;
  boundingBox: BoundingBox;
}

export interface GarmentVariant {
  id: string;
  productGroupId: string;
  color: {
    canonicalName: string;
    observedName: string;
    hex: string;
    confidence: number;
  };
  referenceCrops: string[];
  sourceImageIds: string[];
}

export interface GarmentReference {
  id: string;
  productGroupId: string;
  variantId?: string;
  role: 'FRONT' | 'BACK' | 'SIDE' | 'DETAIL' | 'SWATCH' | 'UNKNOWN';
  sourceImageId: string;
  cropId?: string;
  confidence: number;
}

export interface ProductGroup {
  id: string;
  name: string;
  category: string;
  variants: GarmentVariant[];
  references: GarmentReference[];
  visualSignature: GarmentVisualSignature;
  confidence: number;
}
```

---

## 3. Diagrama Mermaid de la Fase B

```mermaid
flowchart TD
    subgraph Ingestion["SourceImage de Fase A"]
        A["SourceImage (bytes normalizados)"]
    end

    subgraph Scene_Analysis["B1: Análisis de Escena Multimodal"]
        A --> B["GarmentSceneAnalyzer<br/>(Gemini Vision 2.5 Flash / Mock)"]
        B --> C["Clasificación de Escena y Rol Visual<br/>(FRONT, BACK, SIDE, DETAIL, MULTI_VIEW)"]
        B --> D["Detección de Objetos: N BoundingBoxes [0.0 - 1.0]"]
    end

    subgraph Crop_And_Color["B2 & B3 & B9: Recorte Físico y Color por Píxel"]
        D --> E["validateAndClampBoundingBox()<br/>(Asegura 0..1 y dimensiones positivas)"]
        E --> F["PhysicalGarmentCropper<br/>(sharp.extract() nativo)"]
        F --> G["GarmentCrop físico guardado en ImageStorage<br/>(/uploads/crop-...)"]
        
        G --> H["ColorAnalyzer (Pixel-Level)<br/>- Filtro de fondo blanco (>240 RGB)<br/>- Filtro de piel de modelo / maniquí<br/>- Clustering ponderado en zona núcleo"]
        H --> I["Color Dominante Validado (HEX + Canónico)"]
    end

    subgraph Grouping["B4, B5, B6: Separación de Identidad"]
        I --> J["ProductGroupingService"]
        J --> K{"¿Mismo Molde y Confección?<br/>(silueta, escote, mangas)"}
        
        K -->|SÍ| L["Mismo ProductGroup"]
        K -->|NO| M["Nuevo ProductGroup"]
        
        L --> N{"¿Mismo Color?"}
        N -->|SÍ (ej. frente y espalda)| O["Misma GarmentVariant<br/>(agrega crop complementario)"]
        N -->|NO (ej. rojo vs negro)| P["Nueva GarmentVariant<br/>(crop exclusivo para este color)"]
        
        L --> Q["ReferenceSet: Asignación de Roles Visuales<br/>(FRONT -> Crop1, BACK -> Crop2, DETAIL -> Crop3)"]
    end

    subgraph Output["Salida Estructurada de Fase B"]
        P --> R["SceneAnalysisPipelineResult"]
        O --> R
        Q --> R
        R --> S["SceneAnalysisInspector (UI de Verificación y Corrección)"]
    end
```

---

## 4. Archivos Creados y Modificados

### Archivos Creados
1. `types/detection.ts`: Modelos de dominio (`BoundingBox`, `DetectedGarment`, `GarmentCrop`, `GarmentVariant`, `GarmentReference`, `ProductGroup`).
2. `lib/vision/color-analyzer.ts`: Servicio `ColorAnalyzer` para cuantización cromática por píxeles y eliminación de fondos de estudio.
3. `lib/vision/cropper.ts`: Servicio `PhysicalGarmentCropper` y validador `validateAndClampBoundingBox`.
4. `lib/vision/segmenter.interface.ts`: Abstracción `GarmentSegmenter` (preparada para SAM/SAM2).
5. `lib/vision/grouping.ts`: Servicio `ProductGroupingService` y comparador estructural `areGarmentsSameProduct`.
6. `lib/vision/scene-analyzer.ts`: Analizador multimodal `GarmentSceneAnalyzer`.
7. `lib/vision/index.ts`: Coordinador `VisualDetectionPipeline`.
8. `app/api/vision/analyze-scene/route.ts`: Endpoint HTTP `POST /api/vision/analyze-scene`.
9. `features/garments/components/SceneAnalysisInspector.tsx`: Componente React de inspección interactiva.
10. `tests/phase-b-detection.test.ts`: Suite de pruebas unitarias y de integración de Fase B (9 suites).
11. `docs/PHASE_B_VISUAL_VARIANT_DETECTION.md`: Presente informe técnico.

### Archivos Modificados
1. `types/index.ts`: Re-exportación completa de `./detection`.
2. `lib/storage/image-storage.ts`: `resolveImageBytes` actualizado para aceptar `SourceImage` directamente.
3. `package.json`: Script `test` actualizado para incluir la suite de Fase B.

---

## 5. Pruebas Ejecutadas y Casos Obligatorios

Ejecución exitosa de `npm test`:

```bash
> tsx tests/hardening.test.ts && tsx tests/phase-a-ingestion.test.ts && tsx tests/phase-b-detection.test.ts

Suite Hardening: (5/5 suites passing)
Suite Phase A Real Ingestion: (13/13 suites passing)

🧪 Starting Phase B: Visual Garment & Variant Detection Test Suite...

1. Testing Caso 1: 1 photo, 1 red dress -> 1 product, 1 variant...
   ✓ Caso 1 passed: 1 ProductGroup, 1 GarmentVariant.

2. Testing Caso 2: 1 photo with 5 identical dresses in 5 colors...
   ✓ Caso 2 passed: 1 ProductGroup, 5 Variants, 5 distinct physical crops.

3. Testing Caso 3: Front + Back photos of same garment...
   ✓ Caso 3 passed: 1 ProductGroup with FRONT and BACK references.

4. Testing Caso 4: Two structurally different garments -> 2 ProductGroups...
   ✓ Caso 4 passed: Structural differences (sleeves) split into 2 distinct products.

5. Testing Caso 5: Garment on mannequin...
   ✓ Caso 5 passed: Garment on mannequin detected without treating mannequin as garment.

6. Testing Caso 6: Garment on human model...
   ✓ Caso 6 passed: Person not treated as garment; garment isolated correctly.

7. Testing Caso 7: Embroidery detail...
   ✓ Caso 7 passed: Macro embroidery correctly classified as DETAIL.

8. Testing Caso 8: Image with no garments...
   ✓ Caso 8 passed: 0 garments detected, no hallucinated product.

9. Testing Invariants & Robustness...
   ✓ Invariants verified: coordinate bounds, binary bytes, storage, blob rejection, and color accuracy.

🎉 ALL PHASE B DETECTION & GROUPING TESTS PASSED! (9/9 suites)
TOTAL GENERAL: 27/27 suites pasando exitosamente.
```

---

## 6. Verificación de Gates de Aceptación

1. **TypeScript Typecheck (`npx tsc --noEmit`):** Código de salida `0` (Cero errores de tipos).
2. **Build de Producción Next.js (`npm run build`):** Código de salida `0`. Nueva ruta `/api/vision/analyze-scene` generada y optimizada.
3. **Formato y Git Diff (`git diff --check`):** Código de salida `0`. Limpio de espacios en blanco y conflictos.

---

## 7. Preparación para Fase C (Garment DNA)

La salida estructurada de la Fase B (`ProductGroup`, `GarmentVariant`, `GarmentReference`, `GarmentCrop`) proporciona la base idónea para la **Fase C**:
- Cada prenda ahora tiene su recorte físico independiente con píxeles limpios.
- La **Fase C** podrá procesar estos recortes individuales para extraer la ficha técnica inmutable **`GARMENT_DNA`**:
  - `button_count` y posición de botones
  - tipo y profundidad del cuello
  - mangas y puños
  - costuras, bolsillos y cierres
  - patrones y reglas geométricas de preservación estricta.
