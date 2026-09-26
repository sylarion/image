# Arquitectura del Sistema — Catalog AI

Este documento detalla los principios de diseño y componentes arquitectónicos de **Catalog AI**.

```
┌────────────────────────────────────────────────────────┐
│                      Client Layer                      │
│   (App Router Pages, Server & Client React Components) │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON
┌──────────────────────────▼─────────────────────────────┐
│                    Route Handlers                      │
│             /api/projects, /api/projects/[id]          │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌────────────────────────────┐
│   Storage Abstraction   │ │     AI Provider Layer      │
│   (IProjectRepository)  │ │ (ImageGenerationProvider)  │
└────────────┬────────────┘ └─────────────┬──────────────┘
             │                            │
             ▼                            ▼
┌─────────────────────────┐ ┌────────────────────────────┐
│ InMemoryProjectRepo     │ │ MockImageGenerationProvider│
│ (Swappable to Postgres) │ │ (Swappable to Fal/Replicate│
└─────────────────────────┘ └────────────────────────────┘
```

---

## 1. Garment Lock (Ficha de Congelamiento de Producto)

### Propósito
El mayor desafío en la generación de imágenes de moda con IA generativa es el "hallucination drift" (la prenda cambia de botones, costuras, trama o largo entre una toma y otra). 

**Garment Lock** actúa como un contrato inmutable de verdad. Antes de enviar solicitudes a los modelos de difusión, extrae y congela:
- Paleta cromática exacta.
- Material y composición textil detectada.
- Patrón / estampado.
- Puntos anatómicos específicos (escote, tiras, puños, botamanga).
- Reglas innegociables (`mustPreserve`).

El usuario tiene la potestad de auditar y afinar esta ficha antes de que se dispare cualquier generación.

---

## 2. Model Lock (Avatar y Fisiología Consistente)

### Propósito
Garantiza que todas las imágenes del catálogo presenten a la misma modelo con los mismos rasgos distintivos:
- Fisiología, proporciones corporales y altura.
- Tono de piel y subtono.
- Color, largo y estilo de cabello.
- Rango de edad aparente.

Esto permite que un catálogo editorial mantenga identidad de marca coherente a lo largo de 10, 20 o 50 tomas diferentes.

---

## 3. ImageGenerationProvider (Abstracción de IA)

La interfaz `ImageGenerationProvider` define los tres métodos fundamentales del ciclo de vida visual:

1. `analyzeGarment(options)`: Convierte imágenes de referencia en un `GarmentLock`.
2. `generateImage(options)`: Sintetiza un activo fotográfico respetando `GarmentLock` + `ModelLock`.
3. `validateImage(url, garment)`: Evalúa la desviación visual del producto generado respecto a la prenda original.

### Mock Provider vs Proveedor Real
En este MVP, `MockImageGenerationProvider` simula la latencia de red, provee muestras fotográficas de alta resolución adaptadas a la categoría de la prenda y calcula scores de validación coherentes. Para conectar un proveedor real sólo se implementa la interfaz sin alterar el código de presentación.

---

## 4. Pipeline de Validación Visual

Cada imagen producida es evaluada automáticamente:
- **Color Score**: Fidelidad del tono y reflectancia.
- **Shape Score**: Silueta, proporciones y caída.
- **Pattern Score**: Alineación de estampas y texturas.
- **Detail Score**: Preservación de cierres, bolsillos y botones.

**Umbrales de decisión**:
- `≥ 90%`: Aprobado automáticamente (`APPROVED`).
- `75% - 89%`: Marcado para revisión del estilista (`VALIDATING`).
- `< 75%`: Rechazado con reporte de anomalía (`REJECTED`).

---

## 5. Matriz de Producción Multicolor y Pose Memory

En la versión actual del motor, la unidad de trabajo se expande para contemplar variantes múltiples de una misma prenda a partir de una única fotografía de referencia:

```
GARMENT
   │
   ├── GarmentLock (Corte, silueta, confección y estampas comunes)
   ├── ModelLock (Misma modelo para toda la producción)
   │
   └── ColorVariants[] (Colores detectados en la fotografía)
          │
          ├── STUDIO_WHITE (Mercado Libre / E-commerce fondo blanco puro)
          │     ├── FRONT (Mirada a cámara)
          │     ├── SIDE (Mirada a cámara)
          │     ├── BACK (Espalda real, mirada sobre hombro a cámara)
          │     └── ACTION (Movimiento dinámico, mirada a cámara)
          │
          └── EDITORIAL_CATALOG (Catálogo Premium ambientado)
                ├── FRONT (Mirada a cámara)
                ├── SIDE (Mirada a cámara)
                ├── BACK (Espalda real, mirada sobre hombro a cámara)
                └── ACTION (Movimiento dinámico, mirada a cámara)
```

### Fórmula de la Matriz:
$$\text{Total} = N_{\text{colores}} \times 4_{\text{vistas}} \times 2_{\text{paquetes}}$$
Ejemplo: 6 variantes de color = 48 fotografías individuales producidas, organizadas por pestañas cromáticas en la interfaz y auditadas por el pipeline de validación visual.

---

## 6. Estrategia de Persistencia Desacoplada

La capa de datos se estructura mediante la interfaz `IProjectRepository`:
- En la fase actual: `InMemoryProjectRepository` almacena el estado en memoria con soporte para reloads en desarrollo y despliegue instantáneo en Vercel.
- En la fase de producción: Se añade `PrismaProjectRepository` o `SupabaseProjectRepository` implementando la misma interfaz sin tocar componentes de frontend.
