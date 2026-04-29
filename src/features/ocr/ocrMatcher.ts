import type { ObjectClass } from '@/types/class.types'

export interface OcrMatch {
  classId: string
  matchedKeyword: string
}

/**
 * Match cleaned OCR text against per-class keyword lists.
 * Prefers longer keyword matches (more specific = stronger signal).
 * Returns null if no keyword from any class is found in the text.
 */
export function matchKeywords(text: string, classes: ObjectClass[]): OcrMatch | null {
  if (!text) return null

  let best: OcrMatch | null = null
  let bestLen = 0

  for (const cls of classes) {
    const keywords = cls.keywords ?? []
    for (const kw of keywords) {
      const normalized = kw.toLowerCase().trim()
      if (!normalized) continue
      if (text.includes(normalized) && normalized.length > bestLen) {
        best = { classId: cls.id, matchedKeyword: normalized }
        bestLen = normalized.length
      }
    }
  }

  return best
}
