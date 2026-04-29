/**
 * SIMILARITY SEARCH
 *
 * Compares a query embedding against a set of stored embeddings and returns
 * the best cosine similarity per class, sorted descending.
 *
 * Design decisions:
 *   - Max-similarity aggregation (not average): one good angle is enough to match.
 *   - Both vectors must be L2-normalized (from embeddingEngine.generateEmbedding),
 *     so cosine similarity reduces to a dot product — O(D) with no sqrt needed.
 *   - Similarities are clamped to [0, 1] (negative = unrelated, treat as 0).
 */

import type { StoredEmbeddingRecord } from './embeddingStore'

export interface ClassMatch {
  classId: string
  /** Best cosine similarity across all embeddings for this class (0–1). */
  similarity: number
  /** Total number of stored embeddings for this class. */
  embeddingCount: number
}

/**
 * For each class present in `embeddings`, compute the maximum cosine similarity
 * against the query. Returns results sorted by similarity descending.
 */
export function findBestMatches(
  query: Float32Array,
  embeddings: StoredEmbeddingRecord[]
): ClassMatch[] {
  const bestByCls = new Map<string, number>()
  const countByCls = new Map<string, number>()

  for (const emb of embeddings) {
    const sim = Math.max(0, dotProduct(query, emb.vector))
    const prev = bestByCls.get(emb.classId) ?? -1
    if (sim > prev) bestByCls.set(emb.classId, sim)
    countByCls.set(emb.classId, (countByCls.get(emb.classId) ?? 0) + 1)
  }

  return Array.from(bestByCls.entries())
    .map(([classId, similarity]) => ({
      classId,
      similarity,
      embeddingCount: countByCls.get(classId) ?? 0,
    }))
    .sort((a, b) => b.similarity - a.similarity)
}

/** Dot product of a Float32Array and a number[]. Both must be the same length. */
function dotProduct(a: Float32Array, b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
