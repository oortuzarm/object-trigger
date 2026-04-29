/**
 * DATA AUGMENTATION
 *
 * Generates synthetic training variants for each captured blob.
 * Runs inside the training Web Worker (OffscreenCanvas available, no DOM).
 *
 * Variants produced per original image:
 *   1. Horizontal flip          — object orientation invariance
 *   2. Brightness +35           — brighter lighting condition
 *   3. Brightness -35           — darker / shadowed condition
 *
 * Returns only the augmented blobs (NOT the original).
 * Caller is responsible for including the original alongside these.
 */

const SIZE = 224

/**
 * Given a blob (224×224 JPEG from training capture), returns 3 augmented blobs.
 * Throws on failure so the caller can catch and skip gracefully.
 */
export async function getAugmentedBlobs(blob: Blob): Promise<Blob[]> {
  const bitmap = await createImageBitmap(blob)

  // Decode to pixel buffer once — reused for all variants
  const srcCanvas = new OffscreenCanvas(SIZE, SIZE)
  const srcCtx = srcCanvas.getContext('2d')!
  srcCtx.drawImage(bitmap, 0, 0, SIZE, SIZE)
  bitmap.close()

  const srcData = srcCtx.getImageData(0, 0, SIZE, SIZE)

  return Promise.all([
    hflip(srcCanvas),
    brightnessBlob(srcData, 35),
    brightnessBlob(srcData, -35),
  ])
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blobFromCanvas(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 })
}

/** Mirror along vertical axis. */
async function hflip(src: OffscreenCanvas): Promise<Blob> {
  const out = new OffscreenCanvas(SIZE, SIZE)
  const ctx = out.getContext('2d')!
  ctx.scale(-1, 1)
  ctx.drawImage(src, -SIZE, 0)
  return blobFromCanvas(out)
}

/** Clamp-add delta to each R/G/B channel. Alpha is unchanged. */
async function brightnessBlob(src: ImageData, delta: number): Promise<Blob> {
  const d = new Uint8ClampedArray(src.data)  // copy
  for (let i = 0; i < d.length; i += 4) {
    d[i]     = clamp(d[i]     + delta)
    d[i + 1] = clamp(d[i + 1] + delta)
    d[i + 2] = clamp(d[i + 2] + delta)
  }
  const out = new OffscreenCanvas(SIZE, SIZE)
  out.getContext('2d')!.putImageData(new ImageData(d, SIZE, SIZE), 0, 0)
  return blobFromCanvas(out)
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}
