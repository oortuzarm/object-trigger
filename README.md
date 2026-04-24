# Object Trigger

Aplicación web profesional de reconocimiento visual de objetos en el navegador. Clasifica objetos en tiempo real con transfer learning local, overlay AR y assets por clase.

## Stack

| Tecnología | Uso |
|---|---|
| Vite + React 18 + TypeScript | UI y build |
| Tailwind CSS | Estilos |
| TensorFlow.js + MobileNet v2 | Transfer learning en navegador |
| IndexedDB (idb) | Persistencia local |
| Web Workers | Entrenamiento sin bloquear UI |
| Zustand | Estado global |
| React Router v6 | Navegación client-side |
| @google/model-viewer | Viewer de modelos .glb |

## Inicio rápido

```bash
cd object-trigger
npm install
npm run dev
# → http://localhost:5173
```

## Flujo de uso

1. **Clases** — crea 2+ clases (ej: "Botella", "Caja")
2. **Captura** — fotografía cada objeto con la guía integrada (mín. 20, recomendado 40 por clase)
3. **Dataset** — verifica calidad, diversidad y balance
4. **Entrenamiento** — entrena el modelo en el navegador (Web Worker)
5. **Configurar** — ajusta overlay, umbral y sube un asset por clase
6. **Reconocer** — activa la cámara y reconoce en tiempo real

## Arquitectura

```
src/
├── features/
│   ├── storage/     # IndexedDB — clases, muestras, modelos, assets, proyectos
│   ├── quality/     # Detección de blur, brillo, diversidad de muestras
│   ├── training/    # MobileNet feature extractor + clasificador FC
│   ├── inference/   # Motor de inferencia + suavizado de predicciones
│   └── assets/      # Gestión de blobs de assets
├── workers/
│   └── training.worker.ts   # Entrenamiento en Web Worker
├── hooks/           # useCamera, useCapture, useTraining, useInference, useClasses
├── components/
│   ├── ui/          # Button, Card, Badge, Modal, Progress, Spinner, Toast
│   ├── layout/      # Layout, Sidebar, TopBar
│   ├── camera/      # CameraView, CaptureGuide
│   ├── overlay/     # DetectionOverlay, DetectionLabel
│   └── assets/      # AssetRenderer + renderers por tipo
├── pages/           # Dashboard, Classes, Capture, Dataset, Training, Configure, Inference, Projects
├── store/           # Zustand global store
└── types/           # Tipos TypeScript centralizados
```

### Módulos independientes

- **storage/** — toda persistencia, sin lógica de negocio
- **quality/** — solo validaciones de calidad de imagen (blur, brillo, diversidad)
- **training/** — extracción de features + clasificador + serialización del modelo
- **inference/** — motor rAF + suavizado rolling-window
- **workers/** — training fuera del hilo principal
- **overlay/** + **assets/** — rendering de AR overlay y assets

## Configuración por clase

```typescript
{
  id: string
  name: string
  color: string           // color del overlay
  confidenceThreshold: number   // 0-1, default 0.7
  showName: boolean       // default true
  showConfidence: boolean // default true (toggle en Configure)
  asset: ClassAsset | null  // 1 asset por clase
}
```

### Assets soportados (1 por clase)

| Tipo | Comportamiento |
|---|---|
| `image` | Imagen centrada sobre la cámara |
| `video` | Video embebido con autoplay/loop/muted configurable |
| `audio` | Reproducción al detectar, sin UI compleja |
| `model3d` | Viewer 3D vía `<model-viewer>` con auto-rotación |
| `url` | Botón CTA que abre el enlace |

## Validaciones de calidad

Cada muestra capturada es analizada automáticamente:

- **Blur** — varianza Laplaciana; score < 0.3 → warning "imagen borrosa"
- **Brillo** — luminancia media; score < 0.2 → warning "poca iluminación"
- **Diversidad** — histograma de color; similitud > 0.92 con la anterior → warning "muy similar"

## Cómo evolucionar a detección real (MediaPipe)

La arquitectura actual usa **clasificación** (imagen completa → clase). Para migrar a **detección real** (bounding boxes + múltiples objetos simultáneos):

### Ruta de migración

1. **Instalar MediaPipe Tasks Vision**
   ```bash
   npm install @mediapipe/tasks-vision
   ```

2. **Reemplazar `inferenceEngine.ts`**
   ```typescript
   import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision'

   const detector = await ObjectDetector.createFromOptions(vision, {
     baseOptions: { modelAssetPath: './model.tflite', delegate: 'GPU' },
     runningMode: 'VIDEO',
   })
   const result = detector.detectForVideo(videoEl, Date.now())
   // result.detections[] → cada uno con boundingBox + categories[]
   ```

3. **Adaptar `DetectionOverlay`** de single-label a array de bounding boxes:
   ```tsx
   {detections.map((d, i) => (
     <BoundingBox key={i} box={d.boundingBox} label={d.categories[0].categoryName} />
   ))}
   ```

4. **Modelo personalizado** — exportar desde Roboflow/TF Object Detection API → `.tflite` → MediaPipe

5. **Lo que NO cambia** — el sistema de assets, el overlay por clase, la configuración, la persistencia. Solo cambia `inferenceEngine.ts`.

## IndexedDB — Schema v1

| Store | Key | Contenido |
|---|---|---|
| `classes` | id | ObjectClass completo |
| `samples` | id | blob + qualityReport + thumbnail |
| `models` | `current-model` | artifacts TF.js + classIds |
| `assets` | blobId | Blob del asset |
| `projects` | id | snapshot de metadatos |
