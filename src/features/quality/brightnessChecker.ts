/**
 * Checks image brightness.
 * Returns a score 0-1 where 0 = very dark, 1 = very bright.
 * Optimal range is roughly 0.25-0.85.
 */
export function checkBrightness(imageData: ImageData): number {
  const { data } = imageData
  let total = 0
  const pixels = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
    total += lum
  }

  return total / pixels
}

export function isTooDark(brightnessScore: number): boolean {
  return brightnessScore < 0.2
}

export function isTooBright(brightnessScore: number): boolean {
  return brightnessScore > 0.92
}
