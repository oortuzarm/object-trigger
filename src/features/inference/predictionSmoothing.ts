const WINDOW_SIZE = 5

export class PredictionSmoother {
  private history: Array<{ classIndex: number; confidence: number }> = []

  push(classIndex: number, confidence: number) {
    this.history.push({ classIndex, confidence })
    if (this.history.length > WINDOW_SIZE) this.history.shift()
  }

  getSmoothed(): { classIndex: number; confidence: number } | null {
    if (this.history.length === 0) return null

    // Count votes per class
    const votes = new Map<number, number[]>()
    for (const h of this.history) {
      if (!votes.has(h.classIndex)) votes.set(h.classIndex, [])
      votes.get(h.classIndex)!.push(h.confidence)
    }

    // Pick class with most votes, break ties by avg confidence
    let bestClass = -1
    let bestScore = -1
    for (const [cls, confs] of votes) {
      const score = confs.length * (confs.reduce((a, b) => a + b, 0) / confs.length)
      if (score > bestScore) {
        bestScore = score
        bestClass = cls
      }
    }

    const confs = votes.get(bestClass) ?? []
    const avgConf = confs.reduce((a, b) => a + b, 0) / confs.length
    return { classIndex: bestClass, confidence: avgConf }
  }

  reset() {
    this.history = []
  }
}
