/**
 * OBJECT SEGMENTATION PREPROCESSING
 *
 * Two-stage pipeline that isolates the main object from a raw camera frame
 * before the image is used as a training sample:
 *
 *   Stage 1 – COCO-SSD detection   : tight bounding-box crop for 80 common objects.
 *                                     Runs first when the model is loaded.
 *   Stage 2 – Saliency-based crop  : gradient-magnitude heatmap weighted by
 *                                     proximity to frame center. Used when COCO-SSD
 *                                     finds nothing or has low confidence.
 *   Fallback – Center 65% crop     : always works; removes peripheral background
 *                                     when saliency also returns no clear region.
 *
 * The output `blob` replaces `sample.blob`, so the training worker and feature
 * extractor need zero changes — they read `s.blob` and now receive the crop.
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd'

export type CropMethod = 'cocoSsd' | 'saliency' | 'center'

export interface CropInfo {
  method: CropMethod
  confidence: number  // 0–1, indicates how certain the crop is
  label?: string      // COCO class name (only set when method === 'cocoSsd')
  /** Normalized [x, y, w, h] in 0-1 range relative to the source canvas.
   *  Only present when method === 'cocoSsd'. Used by the UI bbox overlay. */
  bbox?: [number, number, number, number]
}

export interface CropResult {
  blob: Blob           // ready for training — replaces the original sample blob
  imageData: ImageData // same crop as ImageData, for quality analysis
  thumbnail: string    // data URL for UI preview grid
  cropInfo: CropInfo
}

// ── Singleton COCO-SSD model ──────────────────────────────────────────────────
// Loaded once and reused across all captures in a session.

let _model: cocoSsd.ObjectDetection | null = null
let _loadPromise: Promise<cocoSsd.ObjectDetection> | null = null

/**
 * Eagerly loads the COCO-SSD model.
 * Call on CapturePage mount so the first capture has no extra delay.
 */
export async function preloadDetector(): Promise<void> {
  if (_model) return
  if (!_loadPromise) {
    _loadPromise = cocoSsd.load({ base: 'mobilenet_v2' })
  }
  _model = await _loadPromise
}

export function isDetectorReady(): boolean {
  return _model !== null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Detects the primary object in the image and returns a cropped version.
 * Falls back gracefully through saliency → center crop when detection fails.
 *
 * @param imageData  Raw 224×224 ImageData from captureFrame()
 * @param targetSize Final output size in pixels (square). Defaults to 224.
 * @param padding    Extra margin around the detected bbox as a fraction of bbox size.
 */
export async function detectAndCrop(
  imageData: ImageData,
  targetSize = 224,
  padding = 0.14
): Promise<CropResult> {
  const srcCanvas = imageDataToCanvas(imageData)

  // ── Stage 1: COCO-SSD object detection ───────────────────────────────────
  if (_model) {
    try {
      const predictions = await _model.detect(srcCanvas)
      if (predictions.length > 0) {
        const best = predictions.reduce((a, b) => (a.score > b.score ? a : b))
        if (best.score >= 0.4) {
          const [bx, by, bw, bh] = best.bbox
          const W = srcCanvas.width
          const H = srcCanvas.height
          const cropped = squareCropCanvas(srcCanvas, bx, by, bw, bh, padding, targetSize)
          return {
            blob: await canvasToBlob(cropped),
            imageData: canvasToImageData(cropped),
            thumbnail: cropped.toDataURL('image/jpeg', 0.75),
            cropInfo: {
              method: 'cocoSsd',
              confidence: best.score,
              label: best.class,
              bbox: [bx / W, by / H, bw / W, bh / H],
            },
          }
        }
      }
    } catch {
      // COCO-SSD inference error — fall through to saliency
    }
  }

  // ── Stage 2: Saliency-based crop ─────────────────────────────────────────
  return saliencyFallback(srcCanvas, imageData, targetSize, padding)
}

// ── Stage 2 implementation ────────────────────────────────────────────────────

/**
 * Saliency crop: computes per-pixel gradient magnitude (Sobel),
 * weights by proximity to frame center (users tend to center the object),
 * then crops around the centroid of the salient region.
 */
function saliencyFallback(
  srcCanvas: HTMLCanvasElement,
  imageData: ImageData,
  targetSize: number,
  padding: number
): Promise<CropResult> {
  const { width: W, height: H, data } = imageData

  // Convert RGBA to luminance
  const luma = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const o = i * 4
    luma[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }

  // Sobel gradient magnitude
  const grad = new Float32Array(W * H)
  let maxG = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx = luma[y * W + x + 1] - luma[y * W + x - 1]
      const gy = luma[(y + 1) * W + x] - luma[(y - 1) * W + x]
      const g = Math.sqrt(gx * gx + gy * gy)
      grad[y * W + x] = g
      if (g > maxG) maxG = g
    }
  }

  // Weighted centroid: salient pixels weighted by distance-from-center inverse
  const threshold = maxG * 0.25
  let wSum = 0, wxSum = 0, wySum = 0
  let xMin = W, xMax = 0, yMin = H, yMax = 0

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = grad[y * W + x]
      if (g < threshold) continue
      const dx = (x / W - 0.5) * 2
      const dy = (y / H - 0.5) * 2
      // Objects are typically photographed near the center of frame
      const centerBias = Math.exp(-(dx * dx + dy * dy) * 1.5)
      const w = g * centerBias
      wxSum += x * w
      wySum += y * w
      wSum += w
      if (x < xMin) xMin = x
      if (x > xMax) xMax = x
      if (y < yMin) yMin = y
      if (y > yMax) yMax = y
    }
  }

  let out: HTMLCanvasElement
  let method: CropMethod
  let confidence: number

  if (wSum > 0 && xMax > xMin && yMax > yMin) {
    const cx = wxSum / wSum
    const cy = wySum / wSum
    const regionW = xMax - xMin
    const regionH = yMax - yMin
    // Confidence: concentrated salient region → high confidence
    const regionArea = (regionW * regionH) / (W * H)
    confidence = Math.min(0.65, Math.max(0.2, 1 - regionArea * 1.4))

    const side = Math.min(
      Math.max(regionW, regionH) * (1 + padding * 2),
      Math.min(W, H)
    )
    const cropX = Math.max(0, Math.min(cx - side / 2, W - side))
    const cropY = Math.max(0, Math.min(cy - side / 2, H - side))
    const cropSide = Math.min(side, Math.min(W - cropX, H - cropY))

    out = document.createElement('canvas')
    out.width = targetSize
    out.height = targetSize
    out.getContext('2d')!.drawImage(
      srcCanvas, cropX, cropY, cropSide, cropSide, 0, 0, targetSize, targetSize
    )
    method = 'saliency'
  } else {
    // Fallback: take the central 65% of the frame
    const margin = W * 0.175
    out = document.createElement('canvas')
    out.width = targetSize
    out.height = targetSize
    out.getContext('2d')!.drawImage(
      srcCanvas, margin, margin, W - margin * 2, H - margin * 2, 0, 0, targetSize, targetSize
    )
    method = 'center'
    confidence = 0.15
  }

  return canvasToBlob(out).then((blob) => ({
    blob,
    imageData: canvasToImageData(out),
    thumbnail: out.toDataURL('image/jpeg', 0.75),
    cropInfo: { method, confidence },
  }))
}

// ── Canvas utilities ──────────────────────────────────────────────────────────

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = imageData.width
  c.height = imageData.height
  c.getContext('2d')!.putImageData(imageData, 0, 0)
  return c
}

function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
}

function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality))
}

/**
 * Crop src to a padded, square region around a bounding box, then scale to targetSize.
 * Makes the crop square by using the longer bbox dimension as the side.
 */
function squareCropCanvas(
  src: HTMLCanvasElement,
  bx: number, by: number, bw: number, bh: number,
  padding: number, targetSize: number
): HTMLCanvasElement {
  const pad = Math.max(bw, bh) * padding
  let x = bx - pad
  let y = by - pad
  let w = bw + pad * 2
  let h = bh + pad * 2

  // Extend to square using the longer side
  const side = Math.max(w, h)
  x -= (side - w) / 2
  y -= (side - h) / 2
  w = h = side

  // Clamp to canvas bounds
  x = Math.max(0, x)
  y = Math.max(0, y)
  const clamped = Math.min(side, src.width - x, src.height - y)

  const out = document.createElement('canvas')
  out.width = targetSize
  out.height = targetSize
  out.getContext('2d')!.drawImage(src, x, y, clamped, clamped, 0, 0, targetSize, targetSize)
  return out
}
