/**
 * OCR MATCHER — fuzzy keyword matching with scored results.
 *
 * Match strategy:
 *   1. Normalize both OCR text and keyword (same pipeline as ocrEngine.cleanText)
 *   2. Exact substring check (rawSim = 1.0, fast path)
 *   3. Sliding-window Levenshtein on N-grams matching the keyword word-count
 *   4. Weight score by keyword length (short keywords = weak signal)
 *   5. Return best match across all classes/keywords
 *
 * scoreOCR formula:  rawSimilarity * lengthWeight  (range 0–1)
 *
 * Length weights:
 *   <4 chars  → 0.30  (very short, high false-positive risk)
 *   4–6 chars → 0.65  (medium confidence)
 *   7+ chars  → 1.00  (long keyword, high specificity)
 *
 * Worked examples:
 *   "monterrey" (9c) exact   → sim 1.00 × 1.00 = 1.00  (exact)
 *   "monterrev" vs "monterrey" → sim 0.78 × 1.00 = 0.78  (fuzzy)
 *   "cafc"      vs "cafe"      → sim 0.75 × 0.65 = 0.49  (weak fuzzy)
 *   "ab"        exact          → sim 1.00 × 0.30 = 0.30  (very weak)
 */

import type { ObjectClass } from '@/types/class.types'
import { cleanText } from './ocrEngine'

export type OcrMatchType = 'exact' | 'fuzzy'

export interface OcrMatch {
  classId: string
  matchedKeyword: string
  matchType: OcrMatchType
  /** rawSimilarity * lengthWeight. Range 0–1. */
  scoreOCR: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum Levenshtein similarity to consider a fuzzy match. */
const FUZZY_MIN_SIM = 0.75

/** Keyword char lengths that define weight tiers. */
const LEN_WEAK = 4
const LEN_MEDIUM = 7

// ── Core algorithms ───────────────────────────────────────────────────────────

/** Iterative Levenshtein with two-row DP (O(min(m,n)) space). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  let curr: number[] = new Array(b.length + 1)

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j] + 1,            // deletion
        prev[j - 1] + cost,     // substitution
      )
    }
    const tmp = prev; prev = curr; curr = tmp  // swap rows
  }

  return prev[b.length]
}

/** Normalized similarity: 1 − (distance / max_length). Range 0–1. */
function stringSim(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

/**
 * Best similarity between normalizedKw and any N-gram window in normalizedText.
 * Returns 1.0 on exact substring match (no Levenshtein needed).
 */
function bestWindowSim(normalizedText: string, normalizedKw: string): number {
  if (normalizedText.includes(normalizedKw)) return 1.0

  const kwWords = normalizedKw.split(' ')
  const kwN = kwWords.length
  const textWords = normalizedText.split(' ')

  let max = 0

  for (let i = 0; i <= textWords.length - kwN; i++) {
    const window = textWords.slice(i, i + kwN).join(' ')
    const s = stringSim(window, normalizedKw)
    if (s > max) max = s
  }

  // Full-text comparison helps with very short OCR output (single word)
  if (textWords.length < kwN * 2) {
    const s = stringSim(normalizedText, normalizedKw)
    if (s > max) max = s
  }

  return max
}

/** Weight by keyword character count (spaces excluded). */
function lengthWeight(normalizedKw: string): number {
  const chars = normalizedKw.replace(/\s/g, '').length
  if (chars < LEN_WEAK) return 0.30
  if (chars < LEN_MEDIUM) return 0.65
  return 1.00
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Match OCR text against all class keyword lists.
 * Returns the single best match by scoreOCR, or null if nothing qualifies.
 */
export function matchKeywords(text: string, classes: ObjectClass[]): OcrMatch | null {
  if (!text) return null

  const normalizedText = cleanText(text)
  if (!normalizedText) return null

  let best: OcrMatch | null = null
  let bestScore = 0

  for (const cls of classes) {
    for (const kw of cls.keywords ?? []) {
      const normalizedKw = cleanText(kw)
      if (!normalizedKw) continue

      const rawSim = bestWindowSim(normalizedText, normalizedKw)
      if (rawSim < FUZZY_MIN_SIM) continue

      const score = rawSim * lengthWeight(normalizedKw)

      if (score > bestScore) {
        bestScore = score
        best = {
          classId: cls.id,
          matchedKeyword: kw,
          matchType: rawSim >= 0.99 ? 'exact' : 'fuzzy',
          scoreOCR: score,
        }
      }
    }
  }

  return best
}
