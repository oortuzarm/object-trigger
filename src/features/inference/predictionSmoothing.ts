/**
 * PREDICTION STABILITY TRACKER
 *
 * Replaces the old vote-based smoother with a streak-based approach:
 *   - A "confirmed" detection requires REQUIRED_STREAK consecutive frames
 *     where (a) the same class wins AND (b) confidence >= MIN_CONFIDENCE.
 *   - A single frame with any other class, or confidence below the floor,
 *     resets the streak. This prevents false positives from background scenes.
 *
 * Two outputs:
 *   getStable()   — only non-null when the streak requirement is met.
 *                   The hook additionally applies the per-class threshold.
 *   getBestGuess() — always returns the current frame's winner (for debug display).
 */

/** Minimum confidence to count toward a streak. Rejects noise / low-signal frames. */
const MIN_CONFIDENCE = 0.5

/** Consecutive frames required before a detection is considered stable. */
export const REQUIRED_STREAK = 6

export class PredictionSmoother {
  private streak = 0
  private streakClassIndex = -1
  private streakConfs: number[] = []

  // Last-frame data — used for the debug best-guess regardless of streak state
  private lastClassIndex = -1
  private lastConfidence = 0
  private lastAllProbs: number[] = []

  push(classIndex: number, confidence: number, allProbs: number[]) {
    this.lastClassIndex = classIndex
    this.lastConfidence = confidence
    this.lastAllProbs = allProbs

    if (confidence >= MIN_CONFIDENCE && classIndex === this.streakClassIndex) {
      // Same class, sufficient confidence → extend streak
      this.streak++
      this.streakConfs.push(confidence)
    } else if (confidence >= MIN_CONFIDENCE) {
      // Different class OR first frame above floor → start new streak
      this.streak = 1
      this.streakClassIndex = classIndex
      this.streakConfs = [confidence]
    } else {
      // Below confidence floor → completely reset streak (frame is unreliable)
      this.streak = 0
      this.streakClassIndex = -1
      this.streakConfs = []
    }
  }

  /**
   * Returns a stable detection only when the streak requirement is met.
   * Returns null while searching (user should see "Buscando objeto...").
   */
  getStable(): { classIndex: number; avgConfidence: number; streak: number } | null {
    if (this.streak >= REQUIRED_STREAK && this.streakClassIndex >= 0) {
      const avg =
        this.streakConfs.reduce((a, b) => a + b, 0) / this.streakConfs.length
      return { classIndex: this.streakClassIndex, avgConfidence: avg, streak: this.streak }
    }
    return null
  }

  /**
   * Returns the current frame's best guess regardless of stability.
   * Used for the debug panel so the user can see what the model is predicting
   * even when no stable detection has been confirmed yet.
   */
  getBestGuess(): {
    classIndex: number
    confidence: number
    streak: number
    allProbs: number[]
  } | null {
    if (this.lastClassIndex < 0) return null
    return {
      classIndex: this.lastClassIndex,
      confidence: this.lastConfidence,
      streak: this.streak,
      allProbs: this.lastAllProbs,
    }
  }

  reset() {
    this.streak = 0
    this.streakClassIndex = -1
    this.streakConfs = []
    this.lastClassIndex = -1
    this.lastConfidence = 0
    this.lastAllProbs = []
  }
}
