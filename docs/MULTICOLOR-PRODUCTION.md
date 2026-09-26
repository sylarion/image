# Multicolor Production Workflow — Catalog AI

## Concept & Real-World Flow

A single supplier or merchant photograph frequently displays a garment model in **multiple colorways side by side** (e.g., Mono Floreal in Negro, Bordó, Beige, Verde, Azul, Terracota). 

Catalog AI models this reality:
- **1 Input Reference Photograph**
- **1 Common Garment Lock** (Silhouette, embroidery, cut, sleeve length, waist tie, fabric)
- **1 Frozen Model Lock** (Same model, face, skin tone, hair texture and styling throughout)
- **N Color Variant Locks** (Individual color tone and print distribution preserved)
- **2 Production Sets**:
  - `STUDIO_WHITE` (Mercado Libre / E-commerce pure white studio #FFFFFF)
  - `EDITORIAL_CATALOG` (High-end catalog lookbook)
- **4 Canonical Mandatory Shots per Color per Set**:
  - `FRONT` (Frente directo a cámara)
  - `SIDE` (Costado lateral real con cabeza a cámara)
  - `BACK` (Espalda auténtica con cabeza sobre hombro a cámara)
  - `ACTION` (Pose dinámica y diferente con mirada a cámara)

---

## The Production Matrix

```
                          CATÁLOGO PREMIUM              MERCADO LIBRE (STUDIO)
NEGRO                 [FRONT] [SIDE] [BACK] [ACTION]   [FRONT] [SIDE] [BACK] [ACTION]
BORDÓ                 [FRONT] [SIDE] [BACK] [ACTION]   [FRONT] [SIDE] [BACK] [ACTION]
BEIGE                 [FRONT] [SIDE] [BACK] [ACTION]   [FRONT] [SIDE] [BACK] [ACTION]
VERDE                 [FRONT] [SIDE] [BACK] [ACTION]   [FRONT] [SIDE] [BACK] [ACTION]
AZUL                  [FRONT] [SIDE] [BACK] [ACTION]   [FRONT] [SIDE] [BACK] [ACTION]
TERRACOTA             [FRONT] [SIDE] [BACK] [ACTION]   [FRONT] [SIDE] [BACK] [ACTION]
```

**Total Output**: $6 \text{ colors} \times 4 \text{ shots} \times 2 \text{ packages} = 48 \text{ individual high-resolution photographs}$.

---

## File System & Export Naming Standard

Assets are structured systematically for e-commerce and marketing downloads:

```
mono-floreal/
   negro/
      catalog/
         mono-floreal_negro_catalog_front.jpg
         mono-floreal_negro_catalog_side.jpg
         mono-floreal_negro_catalog_back.jpg
         mono-floreal_negro_catalog_action.jpg
      ecommerce/
         mono-floreal_negro_ecommerce_front.jpg
         mono-floreal_negro_ecommerce_side.jpg
         mono-floreal_negro_ecommerce_back.jpg
         mono-floreal_negro_ecommerce_action.jpg
   bordo/
      catalog/
         ...
      ecommerce/
         ...
```

---

## UI Color Navigation Paradigm
To avoid cluttering the studio workspace with 48 unsorted cards:
1. **Garment Summary Header**: Displays garment specs, model identity badge, and total matrix breakdown ($6 \times 4 \times 2 = 48$).
2. **Color Tabs**: Interactive chip selector for switching active variant context (`Negro`, `Bordó`, `Beige`, etc.).
3. **Dual Package Sections**: Cleanly splits the view between **Mercado Libre / E-commerce (Fondo Blanco)** and **Catálogo Premium (Editorial)** with canonical 4-card grids.
