/**
 * OCR ENGINE — Tesseract.js wrapper.
 *
 * Preprocessing pipeline before recognition:
 *   1. Upscale to >=400px wide
 *   2. Grayscale + contrast boost x1.5
 *
 * cleanText pipeline (also exported for ocrMatcher keyword normalization):
 *   NFD decompose -> strip combining diacritics (U+0300..U+036F) -> lowercase -> alphanum+space -> trim
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
      const w = await createWorker('eng', 1, {})
      await (w as unknown as { setParameters: (p: Record<string, unknown>) => Promise<void> })
        .setParameters({ tessedit_pageseg_mode: '11' })
      return w as unknown as TesseractWorker
    })()
  }
  return workerPromise
}

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

/**
 * Normalize text: remove diacritics, lowercase, keep only alphanum+space.
 * Uses an explicit code-point loop to strip U+0300..U+036F after NFD decomposition,
 * avoiding regex character-class encoding issues across environments.
 */
export function cleanText(raw: string): string {
  const decomposed = raw.normalize('NFD')
  let stripped = ''
  for (let i = 0; i < decomposed.length; i++) {
    const code = decomposed.charCodeAt(i)
    // Skip combining diacritical marks (U+0300 through U+036F)
    if (code >= 0x0300 && code <= 0x036f) continue
    stripped += decomposed[i]
  }
  return stripped
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
