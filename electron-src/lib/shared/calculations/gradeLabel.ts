/**
 * パーセンテージ → 成績ラベル判定
 */

/**
 * パーセンテージから成績ラベルを決定（降順マッチ）
 */
export function determineGradeLabel(
  percentage: number | null,
  boundaries: { label: string; minPercentage: unknown; order: number }[]
): string | null {
  if (percentage === null || boundaries.length === 0) return null

  const sorted = [...boundaries].sort(
    (boundaryA, boundaryB) =>
      Number(boundaryB.minPercentage) - Number(boundaryA.minPercentage)
  )

  for (const boundary of sorted) {
    if (percentage >= Number(boundary.minPercentage)) {
      return boundary.label
    }
  }
  return sorted[sorted.length - 1]?.label ?? null
}
