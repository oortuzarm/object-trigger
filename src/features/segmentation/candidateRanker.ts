/**
 * CANDIDATE RANKER — multi-object selection for inference.
 *
 * Scores each COCO-SSD detection by up to five signals:
 *
 *   centerScore     — Gaussian decay from frame center.
 *   areaScore       — relative bbox area; rewards foreground objects.
 *   detectorScore   — raw COCO confidence.
 *   embeddingScore  — cosine similarity to stored embeddings (optional, set by engine).
 *   ocrScore        — OCR keyword match score (optional, set by engine via hint).
 *
 * Initial spatial ranking (no embedding yet):
 *   finalScore = 0.45 × center + 0.35 × area + 0.20 × detector
 *
 * After prescore (embedding + OCR assigned):
 *   rerankAfterPrescore() recomputes with full weights:
 *   finalScore = 0.30 × center + 0.25 × area + 0.15 × detector
 *               + 0.20 × embedding + 0.10 × ocr
 *
 * Hard filters applied before scoring:
 *   • bbox area < 1.5% of frame area  → discarded (too small)
 *   • COCO score < MIN_COCO_SCORE     → discarded (uncertain detection)
 */

export interface RawDetection {
  /** Pixel-space bounding box [x, y, w, h] relative to the source canvas. */
  bbox: [number, number, number, number]
  score: number
  label: string
}

export interface ScoredCandidate {
  detection: RawDetection
  /** Normalized [x, y, w, h] in 0–1 range for UI and tracking. */
  normBbox: [number, number, number, number]
  centerScore: number
  areaScore: number
  detectorScore: number
  /** Cosine similarity to best-matching stored embedding (0 if not yet prescored). */
  embeddingScore: number
  /** OCR hint score for this candidate's best-matching class (0 if no hint or mismatch). */
  ocrScore: number
  /** True once the engine has assigned embeddingScore and ocrScore. */
  prescored: boolean
  finalScore: number
}

// ── Score weights ─────────────────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  /** Used in initial spatial-only ranking (embedding + ocr not yet available). */
  spatial: { center: 0.45, area: 0.35, detector: 0.20 },
  /** Used in rerankAfterPrescore() when embedding + OCR are available. */
  full: { center: 0.30, area: 0.25, detector: 0.15, embedding: 0.20, ocr: 0.10 },
} as const

// ── Constants ─────────────────────────────────────────────────────────────────

/** Discard bboxes whose area is less than this fraction of the frame area. */
const MIN_AREA_FRACTION = 0.015

/** COCO minimum confidence to consider a detection. */
const MIN_COCO_SCORE = 0.35

/**
 * Edge penalty zone — if the bbox center is within this fraction of any edge,
 * the centerScore is multiplied linearly (0 at the very edge, 1 at the zone boundary).
 */
const EDGE_ZONE = 0.08

/** areaScore saturates at this fraction of frame area (= score 1.0). */
const AREA_SATURATION = 0.40

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Rank a list of raw COCO detections by spatial signals only (fast, no embedding).
 * Returns a descending-sorted array (best first).
 * embeddingScore and ocrScore are initialized to 0; prescored to false.
 */
export function rankCandidates(
  detections: RawDetection[],
  frameW: number,
  frameH: number,
): ScoredCandidate[] {
  const frameArea = frameW * frameH
  const results: ScoredCandidate[] = []

  for (const det of detections) {
    if (det.score < MIN_COCO_SCORE) continue

    const [bx, by, bw, bh] = det.bbox
    const area = bw * bh
    if (area / frameArea < MIN_AREA_FRACTION) continue

    // Normalized bbox center
    const cx = (bx + bw / 2) / frameW   // 0–1
    const cy = (by + bh / 2) / frameH   // 0–1

    // Distance from frame center (max ≈ 0.707 at corner)
    const dx = cx - 0.5
    const dy = cy - 0.5
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Soft centerScore: 1.0 at center, ~0 at dist ≥ 0.56 (near edge)
    let centerScore = Math.max(0, 1 - dist * 1.8)

    // Edge penalty: multiply linearly from 0 (at edge) to 1 (at EDGE_ZONE)
    const edgeDist = Math.min(cx, 1 - cx, cy, 1 - cy)
    if (edgeDist < EDGE_ZONE) {
      centerScore *= edgeDist / EDGE_ZONE
    }

    // areaScore: saturates at AREA_SATURATION
    const areaScore = Math.min(1, (area / frameArea) / AREA_SATURATION)

    const detectorScore = det.score

    const w = SCORE_WEIGHTS.spatial
    const finalScore =
      w.center * centerScore +
      w.area * areaScore +
      w.detector * detectorScore

    results.push({
      detection: det,
      normBbox: [bx / frameW, by / frameH, bw / frameW, bh / frameH],
      centerScore,
      areaScore,
      detectorScore,
      embeddingScore: 0,
      ocrScore: 0,
      prescored: false,
      finalScore,
    })
  }

  return results.sort((a, b) => b.finalScore - a.finalScore)
}

/**
 * Recompute finalScore for each candidate using the full 5-signal weights
 * (after the engine has assigned embeddingScore and ocrScore).
 * Returns the same array sorted descending by the new finalScore.
 */
export function rerankAfterPrescore(candidates: ScoredCandidate[]): ScoredCandidate[] {
  const w = SCORE_WEIGHTS.full
  for (const c of candidates) {
    c.finalScore =
      w.center * c.centerScore +
      w.area * c.areaScore +
      w.detector * c.detectorScore +
      w.embedding * c.embeddingScore +
      w.ocr * c.ocrScore
  }
  return candidates.sort((a, b) => b.finalScore - a.finalScore)
}

// ── IoU (for temporal tracking continuity) ────────────────────────────────────

/**
 * Intersection-over-Union of two normalized [x, y, w, h] bboxes.
 * Returns 0–1; 1 means perfect overlap.
 */
export function bboxIoU(
  a: [number, number, number, number],
  b: [number, number, number, number],
): number {
  const ax2 = a[0] + a[2], ay2 = a[1] + a[3]
  const bx2 = b[0] + b[2], by2 = b[1] + b[3]
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a[0], b[0]))
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a[1], b[1]))
  const inter = ix * iy
  const union = a[2] * a[3] + b[2] * b[3] - inter
  return union > 0 ? inter / union : 0
}
