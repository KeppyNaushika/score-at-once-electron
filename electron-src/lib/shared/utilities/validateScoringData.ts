import type { ScoringData } from "../types/exportTypes"

/**
 * リゾルバの競合一覧を「生徒名 - 設問ラベル」の識別子に変換する
 */
export function buildConflictIdentifiers(
  scoringData: ScoringData[],
  scoreConflicts: Array<{ studentId: string; cropRegionId: string }>
): string[] {
  return scoreConflicts.map((c) => {
    const student = scoringData.find((s) => s.studentId === c.studentId)
    const question = student?.scores.find(
      (q) => q.questionId === c.cropRegionId
    )
    return `${student?.studentName ?? c.studentId} - ${question?.questionLabel ?? c.cropRegionId}`
  })
}

/**
 * 採点データの検証結果
 */
export interface ValidationResult {
  hasWarnings: boolean
  warnings: {
    noScoringData: string[]
    ungraded: string[]
    missingPartialScore: string[]
    /** 複数採点者の値が食い違い、確定もされていない（出力上は未採点扱い） */
    conflicted: string[]
  }
}

/**
 * 採点データを検証して警告を生成する
 *
 * - 🔴 noScoringData: 採点データが存在しない（status=unscored, score=null）
 * - 🟠 ungraded: 未採点（status=unscored, score≠null）
 * - 🟡 missingPartialScore: 部分点・保留で値が未入力（status=partial|hold, score=null）
 * - 🟣 conflicted: 採点の競合（呼び出し元がリゾルバの競合一覧から識別子を渡す）
 */
export function validateScoringData(
  scoringData: ScoringData[],
  conflictIdentifiers: string[] = []
): ValidationResult {
  const warnings = {
    noScoringData: [] as string[],
    ungraded: [] as string[],
    missingPartialScore: [] as string[],
    conflicted: conflictIdentifiers,
  }

  for (const studentData of scoringData) {
    const studentName = studentData.studentName

    for (const score of studentData.scores) {
      const questionLabel = score.questionLabel
      const identifier = `${studentName} - ${questionLabel}`

      // 採点データが存在しない
      if (!score.status || score.status === "unscored") {
        if (score.score === null) {
          warnings.noScoringData.push(identifier)
        } else {
          warnings.ungraded.push(identifier)
        }
      }

      // 部分点・保留で値が入力されていない（0点は有効な値なので除外）
      if (
        (score.status === "partial" || score.status === "hold") &&
        score.score === null
      ) {
        warnings.missingPartialScore.push(identifier)
      }
    }
  }

  return {
    hasWarnings:
      warnings.noScoringData.length > 0 ||
      warnings.ungraded.length > 0 ||
      warnings.missingPartialScore.length > 0 ||
      warnings.conflicted.length > 0,
    warnings,
  }
}
