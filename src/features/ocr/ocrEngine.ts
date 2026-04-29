/**
 * OCR ENGINE — Tesseract.js wrapper.
 *
 * Lazy-loads the Tesseract worker on the first call (not at startup).
 * The worker is a singleton reused across calls to avoid initialization cost.
 *
 * Preprocessing pipeline before recognition:
 *   1. Upscale to ≥400px wide (Tesseract needs large enough text to work)
 *   2. Grayscale (reduces noise, speeds up recognition)
 *   3. Contrast boost ×1.5 around midpoint (improves low-contrast labels)
 */

type TesseractWorker = {
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}

let workerPromise: Promise<TesseractWorker> | null = null

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      // PSM 11 = sparse text: finds text regardless of layout — best for labels
      const w = await createWorker('eng', 1, {
        // logger: () => {},  // uncomment to silence Tesseract logs
      })
      await (w as unknown as { setParameters: (p: Record<string, unknown>) => Promise<void> })
        .setParameters({ tessedit_pageseg_mode: '11' })
      return w as unknown as TesseractWorker
    })()
  }
  return workerPromise
}

/**
 * Extract cleaned text from a canvas element.
 * Returns empty string if OCR fails or finds nothing.
 */
export async function extractText(canvas: HTMLCanvasElement): Promise<string> {
  try {
    const processed = preprocess(canvas)
    const worker = await getWorker()
    const result = await worker.recognize(processed)
    return cleanText(result.data.text)
  } catch (err) {
    console.warn('[OCR] Recognition failed:', err)
    return ''
  }
}

/** Upscale + grayscale + contrast boost. Returns a new canvas. */
function preprocess(src: HTMLCanvasElement): HTMLCanvasElement {
  const MIN_SIZE = 400
  const scale = src.width < MIN_SIZE ? MIN_SIZE / src.width : 1
  const w = Math.round(src.width * scale)
  const h = Math.round(src.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    const boosted = Math.max(0, Math.min(255, Math.round((gray - 128) * 1.5 + 128)))
    d[i] = d[i + 1] = d[i + 2] = boosted
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/** Lowercase, strip non-alphanumeric, collapse whitespace. */
function cleanText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
