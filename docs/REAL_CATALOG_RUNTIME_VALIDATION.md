# Real catalog runtime validation

Fecha: 2026-09-28. Estado: NO APROBADO para generación real.

## Auditoría antes de modificar

El checkout contenía cambios previos extensos, conservados durante esta tarea. No se creó una arquitectura alternativa.

| Etapa | Implementación existente |
|---|---|
| Multipart, SourceImage | app/api/uploads/route.ts; lib/images/normalizer.ts; lib/storage/source-image.repository.ts |
| Bytes y almacenamiento | lib/storage/image-storage.ts |
| Scene analysis | lib/vision/scene-analyzer.ts |
| Orquestación y AnalysisRun | lib/vision/index.ts; lib/storage/analysis-run.repository.ts |
| Crops físicos | lib/vision/cropper.ts |
| Color RGB/HEX/LAB | lib/vision/color-analyzer.ts |
| Observaciones, grupos, variantes, referencias | lib/vision/grouping.ts; types/detection.ts |
| DNA, evidence, invariantes, conflictos, versiones | lib/dna/*; types/dna.ts |
| Adaptador | features/wizard/models/wizard.types.ts |
| Confirmación y colores | features/wizard/components/DetectedProductsStep.tsx |
| Navegación, presets y validación | features/wizard/engine/decision-engine.ts; VisualProductionWizard.tsx |
| Resumen | features/wizard/components/SummaryStep.tsx |
| Creación de producción | app/api/projects/route.ts |
| Ejecución anterior | app/api/projects/[id]/generate-all/route.ts |
| Inspector | app/admin/inspector/page.tsx; SceneAnalysisInspector.tsx |

## Runtime y proveedor real

El usuario confirmó que no dispone de GEMINI_API_KEY. No había .env.local. Se retiró del .env.example una credencial preexistente: si era válida debe revocarse y reemplazarse. No se utilizó. .env.local está ignorado por Git.

Configuración requerida, sin secretos en código:

```dotenv
AI_MODE=real
ANALYSIS_PROVIDER=gemini
ANALYSIS_MODEL=gemini-2.5-flash
VALIDATION_PROVIDER=gemini
VALIDATION_MODEL=gemini-2.5-flash
GEMINI_API_KEY=
```

RuntimeAIStatus sólo contiene nombres de proveedores/modelos y booleanos de configuración. El inspector es de desarrollo; en producción responde 404 hasta contar con autenticación administrativa. /api/engine-status ya no expone proveedores.

## Hallazgos críticos iniciales

1. REAL sin clave podía ejecutar detecciones ficticias.
2. Fallas de Gemini podían convertirse en resultados prefabricados por filename/hash, incluso con la foto de aceptación.
3. DNA también tenía fallback simulado.
4. AnalysisRun no se guardaba en RUNNING; las fallas podían etiquetarse como MOCK/fallback aunque no se hubiera ejecutado tal proveedor.
5. El wizard enviaba imágenes a un segundo análisis al crear el proyecto, perdiendo IDs, selección, nombres, tomas, destino y modelo.
6. generate-all reconstruía una matriz fija de cuatro tomas por cada uno de dos estilos, en lugar del resumen del usuario.
7. El botón de color faltante copiaba un crop existente y fabricaba una variante sin evidencia.
8. El API público de análisis devolvía toda la estructura interna.
9. El inspector iniciaba análisis al abrirlo.
10. SourceImage, AnalysisRun y proyectos se almacenaban sólo en memoria.

## Cambios y trazabilidad

Se conserva el pipeline original y se añade lib/production/selection.ts como validador de selección y constructor de jobs para la ruta de proyectos existente. La nueva selección no solicita otro análisis.

AnalysisRun registra RUNNING antes de invocar el proveedor y COMPLETED/FAILED al terminar. Las detecciones, crops, observaciones y variantes incluyen analysisRunId. Los IDs de detección se distinguen entre corridas. Los crops persisten bytes extraídos con Sharp. Cada observación mantiene detectionId, cropId, sourceImageId y color numérico. GarmentVariant mantiene referencias a observaciones, crops y fuentes. El DNA se conserva por grupo.

El adaptador produce tarjetas con crop real, nombre y selección. El endpoint público devuelve los view models y el identificador opaco del análisis, no DNA, confidence, bounding boxes o credenciales. El inspector conserva el trace técnico y la selección final.

Las correcciones de nombre de prenda y color se envían con IDs de variante; el nombre semántico del usuario no cambia el HEX técnico. El backend valida que IDs y crops pertenezcan al análisis, rechaza IDs inexistentes, selecciones vacías, duplicados y conteos inconsistentes.

Summary = suma de variantes seleccionadas × tomas seleccionadas. Los jobs se crean QUEUED con destino/estilo/modelo preservados. Guardar jobs no significa haber generado imágenes. El trace conserva expectedJobs, actualJobs y los jobs.

Los registros locales se guardan en .catalog-data mediante escrituras temporales y rename. Esta solución cubre el runtime local de un host; no reemplaza una base compartida para despliegues de múltiples instancias.

## Foto de aceptación

El usuario eligió tests/fixtures/real-catalog-five-variants.png. Inspección visual: cinco prendas superiores estampadas (una sobre maniquí y cuatro colgadas); también hay un pantalón negro visible. El test real no debe forzar cinco detecciones totales si Gemini identifica correctamente el pantalón como otro producto. Hay que verificar las cinco variantes del producto superior sin descartar otras prendas físicas visibles.

## Pruebas

- UNIT MOCK TEST: npm test. Incluye tests anteriores y tests/runtime-integrity.test.ts.
- La prueba nueva empieza con bytes de la fotografía, usa multipart real y crops físicos; el proveedor se simula explícitamente. No constituye aceptación real.
- Contrato de transporte simulado: verifica inline_data idéntico a bytes almacenados, prompt por prenda, JSON Zod y rechazo de errores sin fallback.
- REAL sin clave conserva mode REAL, status FAILED, fallbackUsed false y cero detecciones inventadas.
- Integridad: detección → crop → observación → variante → tarjeta; correcciones persistidas; selección de 3 colores × 4 tomas = 12 jobs por la ruta real de proyectos.
- REAL PROVIDER CONTRACT TEST: pendiente, falta credencial.
- REAL BROWSER E2E: pendiente, falta credencial. Una navegación de navegador o un flujo mock no puede declararlo aprobado.

## Procedimiento manual pendiente

1. Configurar localmente una nueva clave y los valores REAL indicados.
2. Abrir /productions/new, subir la fotografía y analizar.
3. Inspeccionar /admin/inspector: REAL, proveedor/modelo correctos, fallback false, todas las detecciones y crops reales.
4. Verificar visualmente cada crop, las cinco prendas superiores y la separación del pantalón si fue detectado.
5. Corregir identidad de prenda y un nombre de color; deseleccionar variantes hasta elegir tres.
6. Elegir cuatro tomas. Aplicar destino, revisar sus defaults y ajustar nuevamente las tomas si cambian.
7. Elegir estilo/modelo, volver atrás y confirmar conservación de selección.
8. Summary debe mostrar 3 × 4 = 12. Crear producción y verificar doce jobs del mismo análisis, sin variantes excluidas.
9. No aprobar la generación real mientras no se complete esta aceptación.

## Validación final

Ejecutada sobre el árbol estable el 2026-09-28:

- `npm test`: PASS. Incluye ingesta, detección, crops, DNA, identidad, correcciones del wizard, 3 × 4 = 12 jobs e integridad de runtime.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS.

El comando `npm run test:real` está separado de la suite mock y actualmente informa `BLOCKED` sin una clave local; no se confunde con una prueba aprobada.

## Limitaciones

Sin clave no se puede comprobar precisión real de Gemini, segmentación visual de crops, reconciliación cromática en esta escena, ni recorrido real completo en navegador. Los cálculos de color de crops estampados pueden contaminarse con fondo o prendas solapadas y requieren revisión real. Los endpoints heredados y la integración de generación deben mantener las mismas garantías antes de habilitar ejecución comercial. No se afirma soporte de despliegue multi-host ni aprobación de fotos generadas.

READY FOR REAL GENERATION: NO
