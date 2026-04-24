/**
 * Detects image blur using Laplacian variance.
 * Returns a score 0-1 where 1 = sharp, 0 = very blurry.
 */
export function detectBlur(imageData: ImageData): number {
  const { data, width, height } = imageData

  // Laplacian kernel: [0,1,0, 1,-4,1, 0,1,0]
  let sum = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      const top = ((y - 1) * width + x) * 4
      const bottom = ((y + 1) * width + x) * 4
      const left = (y * width + (x - 1)) * 4
      const right = (y * width + (x + 1)) * 4

      // Use luminance of each pixel
      const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b

      const lap =
        lum(data[top], data[top + 1], data[top + 2]) +
        lum(data[bottom], data[bottom + 1], data[bottom + 2]) +
        lum(data[left], data[left + 1], data[left + 2]) +
        lum(data[right], data[right + 1], data[right + 2]) -
        4 * lum(data[idx], data[idx + 1], data[idx + 2])

      sum += lap * lap
      count++
    }
  }

  const variance = count > 0 ? sum / count : 0
  // Normalize: variance < 100 = blurry, > 1000 = sharp
  const normalized = Math.min(1, variance / 800)
  return normalized
}
