import { detectBlur } from './blurDetector'
import { checkBrightness, isTooDark } from './brightnessChecker'
import { compareSamples, isTooSimilar } from './diversityAnalyzer'
import type { QualityReport } from '@/types/sample.types'

export function analyzeQuality(
  current: ImageData,
  previous?: ImageData
): QualityReport {
  const blurScore = detectBlur(current)
  const brightnessScore = checkBrightness(current)
  const similarityScore = previous ? compareSamples(current, previous) : 0

  const flags: QualityReport['flags'] = []

  if (blurScore < 0.3) flags.push('blur')
  if (isTooDark(brightnessScore)) flags.push('dark')
  if (previous && isTooSimilar(similarityScore)) flags.push('similar')
  if (flags.length === 0) flags.push('ok')

  const overallScore =
    blurScore * 0.4 +
    (1 - Math.abs(brightnessScore - 0.5) * 2) * 0.3 +
    (1 - similarityScore) * 0.3

  return {
    flags,
    blurScore,
    brightnessScore,
    similarityScore,
    overallScore: Math.max(0, Math.min(1, overallScore)),
  }
}
