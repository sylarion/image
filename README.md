# Catalog AI — Fashion Photography Automation Platform

**Catalog AI** es una plataforma web profesional para automatizar la creación de fotografías de prendas de vestir de alta costura y retail. Permite a marcas y diseñadores producir sets completos de e-commerce y catálogos editoriales manteniendo **estricta consistencia en la prenda ("Garment Lock") y en la modelo ("Model Lock")**.

---

## 💎 Características Principales

1. **Garment Lock**:
   - Extracción de atributos críticos (color, textil, trama, bolsillos, detalles estructurales, y reglas de preservación innegociables).
   - Ficha técnica interactiva editable antes de lanzar la síntesis.
2. **Model Lock**:
   - Selección de modelos consistentes (fisionomía, tono de piel, tipo de cuerpo, estilo de cabello).
   - Garantiza que todas las fotos pertenezcan a la misma sesión fotográfica.
3. **Paquetes de Producción Dual**:
   - **E-commerce**: Fondo blanco puro, iluminación uniforme, vistas frente, perfil, espalda y detalle de costura.
   - **Catálogo Premium**: Poses dinámicas comerciales, escenarios de campaña y atmósfera editorial.
4. **Pipeline de Validación Visual**:
   - Score de consistencia porcentual desglosado (Color, Forma, Estampado, Detalles).
   - Auditoría de umbral (≥90% Aprobado automático, 75-89% Requiere revisión).
5. **Arquitectura Desacoplada**:
   - Proveedores de IA abstractos (`ImageGenerationProvider`) con implementación inicial mock de cero dependencias externas.
   - Capa de repositorio (`ProjectRepository`) lista para conectar bases de datos PostgreSQL/Supabase.

---

## 🛠️ Stack Tecnológico

- **Next.js 16+** (App Router, Server Components y Route Handlers)
- **React 19**
- **TypeScript** (Strict mode)
- **Tailwind CSS v4** con estética editorial oscura (Dark Studio Mode)
- **Lucide Icons**
- **Zod** para validación estricta de esquemas

---

## 🚀 Inicio Rápido (Local)

1. Clonar el repositorio:
   ```bash
   git clone <repo-url>
   cd image
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Abrir en el navegador: [http://localhost:3000](http://localhost:3000)

---

## 📦 Construcción y Despliegue en Vercel

### Compilación local
```bash
npm run build
npm run start
```

### Despliegue en Vercel
La aplicación está 100% optimizada para desplegarse sin configuración adicional en **Vercel**:
1. Conectar el repositorio de GitHub en el dashboard de Vercel.
2. Framework Preset: **Next.js**.
3. No se requieren variables de entorno obligatorias para ejecutar la demo con el proveedor mock.

---

## 🔌 Cómo incorporar un proveedor real de IA

El sistema utiliza el patrón **Provider Strategy**. Para añadir un nuevo motor (por ejemplo Fal.ai, Replicate, Stable Diffusion o Midjourney API):

1. Crear un archivo que implemente la interfaz `ImageGenerationProvider`:
   ```typescript
   // lib/ai/fal-provider.ts
   import { ImageGenerationProvider, AnalyzeGarmentOptions, GenerateImageOptions } from './provider.interface';
   import { GarmentLock, GarmentValidationResult } from '@/types';

   export class FalAIProvider implements ImageGenerationProvider {
     readonly id = 'fal-ai';
     readonly name = 'Fal.ai Flux LoRA Engine';

     async analyzeGarment(options: AnalyzeGarmentOptions): Promise<GarmentLock> {
       // Llamada a modelo VLM (GPT-4o / Claude 3.5 Sonnet / Gemini Vision)
     }

     async generateImage(options: GenerateImageOptions): Promise<{ outputUrl: string }> {
       // Llamada a Flux / SDXL con IP-Adapter o LoRA de la prenda
     }

     async validateImage(generatedUrl: string, garment: GarmentLock): Promise<GarmentValidationResult> {
       // Comparación de embeddings visuales CLIP o análisis de consistencia
     }
   }
   ```

2. Registrarlo en `lib/ai/index.ts`:
   ```typescript
   import { FalAIProvider } from './fal-provider';
   // Cambiar la instancia en el factory según la variable de entorno AI_PROVIDER
   ```

Ni los componentes de UI ni las rutas de la API requerirán modificación alguna.
