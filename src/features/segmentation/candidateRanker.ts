/**
 * CANDIDATE RANKER — multi-object selection for inference.
 *
 * Scores each COCO-SSD detection by three independent signals:
 *
 *   centerScore   — Gaussian decay from frame center; rewards objects the user
 *                   is aiming at. Falls to ~0 near edges.
 *   areaScore     — relative bbox area; rewards foreground objects over tiny
 *                   background clutter. Capped at 1.0 (40% frame coverage).
 *   detectorScore — raw COCO confidence. Rewards certain detections.
 *
 * finalScore = 0.45 × centerScore + 0.35 × areaScore + 0.20 × detectorScore
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
  finalScore: number
}

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
 * Rank a list of raw COCO detections by how likely they are the object the
 * user intends to recognize. Returns a descending-sorted array (best first).
 * Empty if no detection passes the minimum filters.
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

    const finalScore =
      0.45 * centerScore +
      0.35 * areaScore +
      0.20 * detectorScore

    results.push({
      detection: det,
      normBbox: [bx / frameW, by / frameH, bw / frameW, bh / frameH],
      centerScore,
      areaScore,
      detectorScore,
      finalScore,
    })
  }

  return results.sort((a, b) => b.finalScore - a.finalScore)
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
