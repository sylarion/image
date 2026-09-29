# CATALOG AI — REDISEÑO DEL FLUJO MULTI-PRENDA Y RECONCILIACIÓN DE VARIANTES

> **Fecha:** 28 de Septiembre de 2026  
> **Fase:** Rediseño Conceptual y Arquitectónico del Wizard Multi-Prenda  
> **Estado:** Implementado, Verificado y Aprobado por Tests de Integración (`npm test`, `npx tsc`, `npm run build`)

---

## 1. Causa Raíz y Diagnóstico

### El Defecto Conceptual Detectado
Al subir una fotografía de catálogo con múltiples prendas del mismo modelo en distintos colores (ej. maniquí con prenda celeste + 4 prendas colgadas en crudo, verde agua, negro y beige):
1. **Premadurez en la conclusión:** La aplicación intentaba responder inmediatamente *"¿Qué prenda es?"* antes de haber resuelto:
   - ¿Cuántas prendas físicas visibles existen?
   - ¿Cuáles corresponden al mismo modelo?
   - ¿Cuántas variantes de color hay?
2. **Falsas afirmaciones de éxito:** La interfaz mostraba el cartel prematuro `¡Prenda identificada con éxito!`, asignando `"Mono 1"` / `"Mono"` aunque la detección visual no había resuelto adecuadamente la multiplicidad de la escena.
3. **Parche técnico en la UI:** Para compensar fallos de análisis, se mostraba permanentemente un bloque invasivo con controles nativos de archivo (`<input type="file">`), obligando al usuario a subsanar manualmente lo que la IA debió haber segmentado desde el inicio.

---

## 2. Nueva Arquitectura en 3 Pasos + Sanity Check

Se separaron estrictamente cuatro responsabilidades que antes se mezclaban en una única inferencia:

```
                  FOTOGRAFÍA ORIGINAL
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PASS 1: DETECCIÓN DE INSTANCIAS FÍSICAS (GarmentInstance)   │
│ - ¿Cuántas prendas físicas visibles hay en la imagen?       │
│ - Bounding box independiente por cada prenda física         │
│ - Directiva explícita a Gemini: NO agrupar prendas por rack │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PASS 2: RECORTES FÍSICOS (Physical Crops con Sharp)         │
│ - sharp.extract() para cada BoundingBox individual          │
│ - Persistencia física de cada recorte en storage binario    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ PASS 3: AGRUPAMIENTO & RECONCILIACIÓN DE VARIANTES (LAB)    │
│ - Estructura moldería/diseño determina ProductGroup         │
│ - Distancia cromática perceptual (Delta E en LAB)           │
│   determina VariantIdentity (ObservedVariant → Variant)     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ SANITY CHECK OBLIGATORIO                                    │
│ - Compara: instances vs crops vs productGroups vs variants  │
│ - Si instances >= 2 y variants === 1:                       │
│   → Dispara VARIANT_RECONCILIATION_CONFLICT                  │
│   → Nunca colapsa silenciosamente a éxito ficticio          │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Especificación de Contratos

### Pass 1: `GarmentInstance`
```typescript
export interface GarmentInstance {
  id: string;
  sourceImageId: string;
  boundingBox: BoundingBox;
  cropId?: string;
  cropUrl?: string;
  confidence: number;
  dominantColor?: {
    name: string;
    hex: string;
    confidence: number;
  };
  orientation?: 'FRONT' | 'BACK' | 'SIDE' | 'UNKNOWN';
  visualSignature?: GarmentVisualSignature;
  probableCategory?: string;
  sameProductGroup?: string;
}
```

### Directiva Multimodal para Gemini (Pass 1)
```
DETECT EVERY PHYSICAL GARMENT VISIBLE IN THE IMAGE.
RETURN ONE BOUNDING BOX PER GARMENT INSTANCE.
DO NOT GROUP GARMENTS BY COLOR.
DO NOT GROUP GARMENTS BY PRODUCT.
DO NOT RETURN ONE BOUNDING BOX FOR AN ENTIRE RACK.
IF FIVE GARMENTS ARE VISIBLE, RETURN FIVE GARMENT INSTANCES.
DO NOT TREAT THE MANNEQUIN OR HUMAN BODY AS A GARMENT.
```

### Pass 2 & 3: Reconciliación Cromática en Espacio LAB
Cada recorte físico preserva sus coordenadas `[L, a, b]` y su color observado `rawHex`. La reconciliación compara mediante CIE76:
- $\Delta E < 10$: Se consolida como la misma variante de color (mismo colorway fotografiado en distintos ángulos o prendas idénticas).
- $\Delta E \ge 10$: Constituyen variantes de color independientes.

### Sanity Check: `SceneSanityChecker`
```typescript
if (instanceCount >= 2 && variantCount === 1) {
  conflicts.push({
    code: 'VARIANT_RECONCILIATION_CONFLICT',
    message: `Conflicto de reconciliación: Se detectaron ${instanceCount} prendas físicas visibles pero el sistema colapsó el resultado a 1 sola variante sin justificación.`,
  });
}
```

---

## 4. Nuevo Flujo del Wizard (Inversión del Orden)

Se eliminó el orden erróneo anterior. El nuevo flujo respeta estrictamente la secuencia cognitiva del usuario:

1. **Subir Foto:**  
   El usuario sube la foto. Se analiza la escena visualmente con estados progresivos (*"Detectando prendas y separando colores..."*).
2. **Revisión de Escena:**  
   Si se detectaron múltiples prendas, se muestra un bloque claro:  
   *“Encontramos varias prendas — Parece ser el mismo modelo en N colores”*  
   con la tira de recortes reales y selector de confirmación (*[✓ Sí, son el mismo modelo]* / *[Son productos distintos]*).
3. **Selección de Variantes:**  
   *“¿Qué colores querés producir?”*  
   Tarjetas interactivas utilizando el recorte físico real (`cropUrl`), indicador de hex, nombre de color y posibilidad de edición inline.
4. **Acción Secundaria para Variantes Faltantes:**  
   Se eliminó el bloque permanente de controles nativos. Se reemplazó por una acción secundaria discreta:  
   `¿Falta algún color en la detección? [+ Agregar variante]`  
   Al hacer clic, abre un modal visual con dropzone y previsualización.
5. **RECIÉN DESPUÉS — Identidad Comercial:**  
   Una vez resueltos los productos y sus variantes, se pregunta:  
   *“¿Cómo querés llamar a esta prenda?”*  
   - Nombre comercial editable (precompletado con la sugerencia de IA, ej. *"Remera de morley estampada"*).  
   - Tipo de prenda (selector desplegable con opción *"Otro"*).  
   - Regla garantizada: `USER CONFIRMATION > AI INFERENCE`.
6. **Elegir Tomas:** Frente, Costado, Espalda, Movimiento / Detalle.
7. **Preparar & Crear:** Configuración de estilo, destino y generación exacta de jobs.

---

## 5. Invariante de Generación

$$\text{Variantes Seleccionadas} \times \text{Tomas Elegidas} = \text{Expected Jobs} = \text{Actual Jobs}$$

- Si el usuario selecciona **3 colores** y elige **4 tomas**:
  $$\text{Jobs backend} = 3 \times 4 = 12 \text{ jobs}$$
  *(Ni 4, ni 16, ni 48).*

---

## 6. Resultados de Validación

| Suite de Tests | Casos | Estado |
|---|---|---|
| `hardening.test.ts` | 5 | ✅ PASS |
| `phase-a-ingestion.test.ts` | 13 | ✅ PASS |
| `phase-b-detection.test.ts` | 9 | ✅ PASS |
| `phase-c-dna.test.ts` | 10 | ✅ PASS |
| `wizard-identity.test.ts` | 8 | ✅ PASS |
| `wizard-e2e-correction.test.ts` | 10 | ✅ PASS |
| `runtime-integrity.test.ts` | 1 | ✅ PASS |
| `real-catalog-runtime.test.ts` | 1 | ✅ PASS |
| `multi-garment-flow-redesign.test.ts` | 9 | ✅ PASS |
| **Total** | **66 casos** | **100% PASS** |

- **Typecheck:** `npx tsc --noEmit` completado con 0 errores.
- **Producción:** `npm run build` compiló estática y dinámicamente con 0 warnings.
- **Git Hygiene:** `git diff --check` limpio sin trailing whitespaces ni conflictos.
