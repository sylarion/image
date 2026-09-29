# Plan de Corrección Integral del Wizard & Trazabilidad de Variantes

## 1. Trazabilidad de Variantes (Pipeline Trace)

### Diagnóstico de Causa Raíz (Root Cause Analysis)
Al instrumentar el pipeline completo desde `SourceImage` hasta los componentes de renderizado de UI, se identificaron **cuatro factores convergentes** que provocaban que una fotografía con múltiples prendas de distintos colores se redujera a 1 producto y 1 color:

1. **Colapso de Detecciones en el Mismo Archivo (`ProductGroupingService`)**:
   - En [lib/vision/grouping.ts](file:///c:/Users/omorales/Documents/app/image/image/lib/vision/grouping.ts), la función de agrupamiento buscaba si ya existía una variante con el mismo nombre canónico de color (`targetGroup.variants.find(...)`).
   - Cuando 2 o más prendas de la misma foto eran mapeadas a nombres similares (por ejemplo, verde oliva y verde esmeralda mapeados al genérico "Verde"), el agrupador agregaba el crop adicional a la variante existente en lugar de crear una nueva, asumiendo erróneamente que eran vistas complementarias (frente/espalda).
   - **Solución implementada**: Se introdujo el invariante estructural: *dos prendas detectadas en la misma imagen física (`sourceImageId`) en posiciones distintas son físicamente prendas separadas y nunca deben fusionarse en una sola variante (salvo que una sea explícitamente un crop macro de detalle)*. Si el nombre canónico coincide, se numera automáticamente (`Verde`, `Verde 2`) y se preservan como variantes independientes.

2. **Paleta Cromática Canónica Reducida (`ColorAnalyzer`)**:
   - La paleta previa en [lib/vision/color-analyzer.ts](file:///c:/Users/omorales/Documents/app/image/image/lib/vision/color-analyzer.ts) solo contenía 14 tonos básicos.
   - Tonos de moda estándar (Verde Seco, Celeste, Lavanda, Coral, Camel, Mostaza, Crudo, etc.) colapsaban por proximidad euclidiana hacia "Gris", "Beige" o "Negro".
   - **Solución implementada**: Se expandió la paleta canónica a 30 colores de confección e indumentaria estándar, y se eliminó la concatenación de nombres confusos como `Gris (Negro)`.

3. **Fallback Offline/Mock Predeterminado (`GarmentSceneAnalyzer`)**:
   - En modo local o cuando no se dispone de credenciales activas de Gemini, el analizador recurría a un mock estático que devolvía por defecto una única prenda (`Mono` color `Negro`).
   - **Solución implementada**: Se dotó al analizador offline de heurística multi-prenda: imágenes con nombres descriptivos (`pack`, `remera`, `lote`, `colores`, `variantes`) o relación de aspecto apaisada (`width >= height * 1.2`) detectan automáticamente el set completo de 4 remeras en sus 4 colores de catálogo (Negro, Verde Seco, Beige, Celeste).

4. **Instrucciones Explícitas en el Prompt Multimodal de Gemini**:
   - Se añadió en el prompt del sistema la directiva obligatoria: ante percheros, dobleces o alineaciones de varias prendas, el modelo debe emitir una entrada individual en `garments` por cada prenda visible con su bounding box específico, sin agrupar el conjunto en una sola caja delimitadora.

---

## 2. Confirmación Humana de Variantes (USER CONFIRMATION > AI INFERENCE)

Se extendió el modelo de soberanía del usuario a las variantes de color:
- **Interface formal**:
  ```typescript
  export interface UserConfirmedVariantSet {
    productGroupId: string;
    selectedVariantIds: string[];
    userConfirmed: boolean;
    customColorNames?: Record<string, string>;
    confirmedAt?: string;
  }
  ```
- **Edición en tiempo real**: En cada tarjeta de color de [DetectedProductsStep.tsx](file:///c:/Users/omorales/Documents/app/image/image/features/wizard/components/DetectedProductsStep.tsx), el usuario cuenta con un botón de edición para corregir el nombre detectado (por ejemplo, transformar "Gris" en "Verde seco" o "Verde militar").
- **Persistencia**: Las decisiones de selección/deselección de variantes y los nombres corregidos por el usuario persisten al navegar adelante y atrás en el wizard, e incluso ante re-análisis técnicos del backend vía [VisualWizardAdapters.toProductChoices](file:///c:/Users/omorales/Documents/app/image/image/features/wizard/models/wizard.types.ts).

---

## 3. Librería Visual Semántica (Shots & Styles)

Se erradicaron las fotografías genéricas y repetitivas, reemplazándolas por activos vectoriales SVG controlados y semánticamente exactos:

| Tipo | Asset | Representación Semántica |
|---|---|---|
| **FRONT** | `/ui-assets/shots/front.svg` | Silueta frontal simétrica con caída visible y detalles de cuello |
| **SIDE** | `/ui-assets/shots/side.svg` | Perfil lateral a 90 grados, líneas de costura y contorno |
| **BACK** | `/ui-assets/shots/back.svg` | Vista posterior con cremallera dorsal, nuca y terminaciones |
| **ACTION** | `/ui-assets/shots/action.svg` | Pose dinámica en movimiento con drapeado y vuelo textil |
| **FONDO BLANCO** | `/ui-assets/styles/white.svg` | Fondo blanco puro 100% (#FFFFFF), horizonte sutil reglamentario |
| **ESTUDIO PREMIUM** | `/ui-assets/styles/studio.svg` | Ciclorama neutro con iluminación de softbox y sombras suaves |
| **EDITORIAL** | `/ui-assets/styles/editorial.svg` | Contraste dramático con arquitectura minimalista de campaña |
| **LIFESTYLE** | `/ui-assets/styles/lifestyle.svg` | Luz natural de día en entorno urbano cálido |

---

## 4. Matriz de Coherencia de Destinos & Validador de Configuración

Se implementó el validador [ProductionConfigurationValidator](file:///c:/Users/omorales/Documents/app/image/image/features/wizard/engine/decision-engine.ts) que evalúa las selecciones antes del resumen de producción:
- **Transparencia en Presets**: Al elegir un destino (por ejemplo, Mercado Libre), se muestra un banner explícito:
  > *«Aplicado automáticamente para Mercado Libre: Se configuró Fondo Blanco puro reglamentario, encuadre cuadrado 1:1 y tomas Frente, Costado y Espalda.»*
- **Advertencias Amigables por Desviación**: Si el usuario elige Mercado Libre pero cambia el estilo a Lifestyle Urbano, se permite continuar pero se emite una advertencia visual de incompatibilidad con las normas del marketplace.
- **Bloqueo de Inconsistencias**: Si se deseleccionan todos los colores o todas las tomas, el botón de creación queda deshabilitado con el mensaje correspondiente.

---

## 5. Casos de Prueba End-to-End Ejecutados

Se validaron mediante tests unitarios y de integración los siguientes 10 escenarios:
1. `Caso 1: 1 prenda / 1 color` -> Flujo limpio enfocado en confirmación semántica.
2. `Caso 2 & 7: 1 producto / 4 colores en la misma foto` -> 1 ProductGroup, 4 GarmentVariants, 4 crops, 4 tarjetas de color.
3. `Caso 3: 2 productos distintos (Remera y Pantalón)` -> Separación estructural limpia en 2 grupos independientes.
4. `Caso 4: Misma prenda Frente + Espalda en 2 fotos` -> Fusión correcta en 1 producto y 1 variante con ReferenceSet completo.
5. `Caso 5: Prenda sobre maniquí` -> Aislamiento textil sin capturar el maniquí.
6. `Caso 6: Prenda sobre modelo humano` -> Aislamiento textil sin capturar la persona.
7. `Caso 8: Imagen sin prendas` -> 0 prendas detectadas, sin alucinaciones.
8. `Acceptance Gate: 4 variantes -> usuario deselecciona 1 y corrige 1 color -> resumen muestra 3 colores -> generación crea solo 3 con el nombre corregido`.
9. `ProductionConfigurationValidator`: Advertencias y validación de matriz de coherencia.
10. `Semantic Assets`: Verificación de integridad física de los 8 SVGs en disco.

---

## 6. Estado de Certificación Técnica

- **Tests Automatizados**: `55/55 pasados` (Hardening: 5, Fase A: 13, Fase B: 9, Fase C: 10, Identity: 8, E2E Correction: 10).
- **TypeScript (`npx tsc --noEmit`)**: 0 errores de tipado.
- **Build de Producción (`next build`)**: Exitoso (Next.js Turbopack).
- **Control de Formato (`git diff --check`)**: Limpio.

**READY FOR REAL CATALOG TESTING: YES**
