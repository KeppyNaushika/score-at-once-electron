import type {
  ConflictWarning,
  QuestionWarning,
  ScoringValidationResult,
} from "@/types/exportValidation.types"
import type { ExamDecisionSummary } from "@/types/scoreDecision.types"

import type { ScoringData } from "../types"

/**
 * 裁定サマリから「対処が必要」な食い違いだけを取り出す。
 *
 * 確定後に新提案が入っただけのセル（reason="stale"）は確定値がそのまま出力される
 * ので出力前警告には出さない。値が出ないのは競合だけ。
 */
export function buildConflictWarnings(
  summary: ExamDecisionSummary,
  selectedExamStudentIds: string[] = []
): ConflictWarning[] {
  const selected = new Set(selectedExamStudentIds)
  return summary.questions.flatMap((question) =>
    question.cells
      .filter((cell) => cell.reason === "conflict")
      .filter((cell) => selected.size === 0 || selected.has(cell.examStudentId))
      .map((cell) => ({
        ...cell,
        questionLabel: question.questionLabel,
        maxScore: question.maxScore,
      }))
  )
}

/** 設問ごとの集計を積み上げるための可変バケット */
type WarningBucket = Map<string, QuestionWarning>

const pushWarning = (
  bucket: WarningBucket,
  cropRegionId: string,
  questionLabel: string,
  studentName: string
): void => {
  const existing = bucket.get(cropRegionId)
  if (existing) {
    existing.count += 1
    existing.studentNames.push(studentName)
    return
  }
  bucket.set(cropRegionId, {
    cropRegionId,
    questionLabel,
    count: 1,
    studentNames: [studentName],
  })
}

/**
 * 採点データを検証して警告を生成する。
 *
 * - noScoringData: 採点データが存在しない（status=unscored, score=null）
 * - ungraded: 未採点（status=unscored, score≠null）
 * - missingPartialScore: 部分点・保留で値が未入力（status=partial|pending, score=null）
 * - conflicted: 採点者間の食い違い（呼び出し元が裁定サマリから渡す）
 *
 * 先の3つは採点途中なら正常に出るため、設問ごとに集約して件数で示す。
 */
export function validateScoringData(
  scoringData: ScoringData[],
  conflicted: ConflictWarning[] = [],
  conflictCheckError?: string
): ScoringValidationResult {
  const noScoringData: WarningBucket = new Map()
  const ungraded: WarningBucket = new Map()
  const missingPartialScore: WarningBucket = new Map()

  for (const studentData of scoringData) {
    for (const score of studentData.scores) {
      if (!score.status || score.status === "unscored") {
        pushWarning(
          score.score === null ? noScoringData : ungraded,
          score.questionId,
          score.questionLabel,
          studentData.studentName
        )
      }

      // 部分点・保留で値が入力されていない（0点は有効な値なので除外）
      if (
        (score.status === "partial" || score.status === "pending") &&
        score.score === null
      ) {
        pushWarning(
          missingPartialScore,
          score.questionId,
          score.questionLabel,
          studentData.studentName
        )
      }
    }
  }

  const warnings = {
    noScoringData: [...noScoringData.values()],
    ungraded: [...ungraded.values()],
    missingPartialScore: [...missingPartialScore.values()],
    conflicted,
  }

  return {
    // 検査に失敗した場合も必ずモーダルを開く。空の conflicted を
    // 「食い違いなし」として黙って通すと、伝えるべき事実が消える。
    hasWarnings:
      conflictCheckError !== undefined ||
      warnings.noScoringData.length > 0 ||
      warnings.ungraded.length > 0 ||
      warnings.missingPartialScore.length > 0 ||
      warnings.conflicted.length > 0,
    actionRequiredCount: conflicted.length,
    conflictCheckError,
    conflictScoreImpact: conflicted.reduce(
      (total, conflict) => total + conflict.scoreImpact,
      0
    ),
    warnings,
  }
}
