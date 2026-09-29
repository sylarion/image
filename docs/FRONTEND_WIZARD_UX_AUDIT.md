# Auditoría UX Funcional: Frontend Visual Wizard (Catalog AI)

## 1. Diagnóstico de Fricciones & Pasos Redundantes

### Fricción 1: Pantalla Inicial con Decisión Falsa
- **Problema:** En el flujo inicial se ofrecían dos opciones: *"Subir una prenda"* vs *"Foto con varios colores"*.
- **Impacto UX:** El backend (Fase B) ya contiene `GarmentSceneAnalyzer` que detecta si la foto es `SINGLE_GARMENT` o `MULTIPLE_VARIANTS` sin intervención humana. Obligar al usuario a categorizar su foto antes de subirla es una decisión redundante y genera parálisis de decisión.
- **Solución:** Reemplazar por un único CTA central: **"Subir foto de mi prenda"** con subtítulo explicativo de que el sistema detecta prendas individuales o variantes automáticamente.

### Fricción 2: 9 Pasos Percibidos como Formulario Largo
- **Problema:** Tener 9 pasos en el stepper (`UPLOAD` → `PRODUCTS` → `SHOTS` → `DESTINATION` → `STYLE` → `MODEL` → `SUMMARY` → `GENERATION` → `RESULTS`) genera fatiga cognitiva, dando la sensación de configurar un software complejo.
- **Impacto UX:** El usuario percibe un proceso interminable.
- **Solución:** Consolidar la experiencia en **4 Macro-Etapas Visuales**:
  1. **SUBIR**: Carga de foto con análisis amigable silencioso.
  2. **ELEGIR**: Confirmación de prendas/colores y tomas deseadas (Frente, Costado, Espalda, etc.).
  3. **PREPARAR**: Destino (Mercado Libre, Shopify), estilo y modelo (con preselección inteligente).
  4. **CREAR**: Resumen de impacto, generación progresiva y resultados comerciales.

### Fricción 3: Opciones Desconectadas de los Presets de Destino
- **Problema:** Si el usuario elige *Mercado Libre*, la plataforma exige fondo blanco estricto y formato cuadrado. Exigirle luego seleccionar *Fondo Blanco* manualmente en el paso siguiente es un clic innecesario.
- **Solución:** **Automatización Proactiva (Smart Presets)**: Al seleccionar el canal (ej. *Mercado Libre*), el sistema preconfigura automáticamente el estilo (*Fondo Blanco*), la relación de aspecto (*1:1*) y las tomas recomendadas (*Frente, Costado, Espalda*), permitiendo avanzar de inmediato con un solo clic.

### Fricción 4: Paso de Modelo Innecesario cuando se Elige "Maniquí Invisible"
- **Problema:** Si el usuario no desea modelos humanos (Ghost Mannequin / Producto solo), no tiene sentido mostrar un catálogo de rostros humanos.
- **Solución:** **Progressive Disclosure Condicional**: Si se elige "Maniquí invisible", el sub-selector de rostros/modelos humanos se oculta automáticamente.

### Fricción 5: Pérdida de Estado al Volver Atrás
- **Problema:** En asistentes mal diseñados, pulsar "Volver" reinicia formularios o deselecciona colores.
- **Solución:** El estado vive en el orquestador principal (`VisualProductionWizard`). Navegar hacia atrás o adelante preserva intactas las selecciones de prendas, colores, tomas y destinos.

### Fricción 6: Manejo de Errores con Lenguaje Técnicamente Opaco
- **Problema:** Mostrar errores como `"VLM network error"` o `"MIME type not supported"`.
- **Solución:** **Microcopy Accionable**:
  - Foto borrosa: *"La foto tiene baja resolución. Probá subiendo una imagen más nítida o con mejor iluminación."*
  - Sin prendas: *"No encontramos prendas reconocibles en esta imagen. Asegurate de que la prenda esté visible en plano general."*

---

## 2. Comparativa: Current Flow vs. Optimized Flow

| Dimensión | Current Flow (9 Pasos) | Optimized Flow (4 Macro-Etapas) |
|---|---|---|
| **Pantalla Inicial** | 2 cards + selector manual de modo | 1 CTA central + detección automática |
| **Etapas Visibles** | 9 pasos rígidos en stepper | 4 etapas claras: Subir → Elegir → Preparar → Crear |
| **Clics Happy Path** | 9 - 11 clics | **4 clics** (Subir → Confirmar Colores → Elegir Canal → Crear) |
| **Corrección de Colores** | Bounding boxes técnicos en admin | Botón visual "Son el mismo modelo" / edición de nombre simple |
| **Selección de Estilo** | Manual obligatorio | Automatizado por el canal elegido (Mercado Libre → Fondo Blanco) |
| **Selector de Modelo** | Siempre visible | Condicional (se oculta en Maniquí Invisible) |
| **Mobile Experience** | Stepper horizontal truncado | Stepper compacto 1/4 con CTA sticky |

---

## 3. Wireframes Textuales

### Desktop Layout (Optimized)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ CatalogAI                 [1. Subir] > [2. Elegir] > [3. Preparar] > [4. Crear]│
├────────────────────────────────────────┬───────────────────────────────┤
│                                        │  LIVE PREVIEW (Fijo)          │
│  Macro-Etapa Activa: 2. ELEGIR         │ ┌───────────────────────────┐ │
│  "Encontramos 1 modelo en 5 colores"   │ │ [Foto / Crop Prenda]      │ │
│                                        │ └───────────────────────────┘ │
│  Colores detectados:                   │  • Vestido Solero             │
│  [✓ Negro] [✓ Rojo] [✓ Verde] [ ] Azul │  • 3 colores activos          │
│                                        │  • Mercado Libre (Fondo Bco.) │
│  ¿Qué fotos querés crear?              │                               │
│  [✓ Frente] [✓ Costado] [✓ Espalda]    │                               │
│                                        │                               │
│  [ ← Volver ]       [ Siguiente: Preparar → ]                          │
└────────────────────────────────────────┴───────────────────────────────┘
```

### Mobile Layout (Optimized)
```text
┌───────────────────────────────┐
│ CatalogAI           Paso 2/4  │
├───────────────────────────────┤
│ [ Mini Preview Prenda ]       │
├───────────────────────────────┤
│ ¿Qué colores querés producir? │
│ [✓ Negro] [✓ Rojo] [✓ Verde]  │
├───────────────────────────────┤
│ Tomas recomendadas:           │
│ [✓ Frente] [✓ Costado]        │
├───────────────────────────────┤
│ [ CTA Sticky: Continuar ]     │
└───────────────────────────────┘
```

---

## 4. Guía de Microcopy Amigable

- **En lugar de:** `"Scene analysis in progress (VLM 2.5 Flash)"`
  → **Usar:** *"Analizando tu prenda... Separando colores y detalles"*
- **En lugar de:** `"ProductGroup conflict detected"`
  → **Usar:** *"¿Estas fotos corresponden al mismo modelo en distintos colores?"*
- **En lugar de:** `"Confidence score: 0.94 - verified"`
  → **Usar:** *"Prenda identificada con éxito"*
- **En lugar de:** `"FLUX Pro VTO batch job started"`
  → **Usar:** *"Creando tu catálogo fotográfico..."*
