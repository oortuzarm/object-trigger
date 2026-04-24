const BINS = 16

function buildHistogram(imageData: ImageData): number[] {
  const hist = new Array(BINS * 3).fill(0)
  const { data } = imageData

  for (let i = 0; i < data.length; i += 4) {
    const rBin = Math.floor((data[i] / 256) * BINS)
    const gBin = Math.floor((data[i + 1] / 256) * BINS)
    const bBin = Math.floor((data[i + 2] / 256) * BINS)
    hist[rBin]++
    hist[BINS + gBin]++
    hist[BINS * 2 + bBin]++
  }

  // Normalize
  const pixels = data.length / 4
  return hist.map((v) => v / pixels)
}

/** Returns similarity 0-1 between two histograms (1 = identical, 0 = totally different) */
function histogramSimilarity(h1: number[], h2: number[]): number {
  let intersection = 0
  for (let i = 0; i < h1.length; i++) {
    intersection += Math.min(h1[i], h2[i])
  }
  return intersection
}

export function compareSamples(a: ImageData, b: ImageData): number {
  const ha = buildHistogram(a)
  const hb = buildHistogram(b)
  return histogramSimilarity(ha, hb)
}

export function isTooSimilar(similarity: number): boolean {
  return similarity > 0.92
}
