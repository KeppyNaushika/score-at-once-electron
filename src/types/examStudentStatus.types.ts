// 試験における生徒の受験状態（ExamStudent.status）の単一の真実源(SSOT)
// DB も小文字で保存する（QuestionScore.status と同じ規約）。
// Prisma(sqlite)は enum 非対応のため、この union が唯一の集約点となる。
export const EXAM_STUDENT_STATUSES = [
  "participating",
  "expected",
  "absent",
] as const

export type ExamStudentStatus = (typeof EXAM_STUDENT_STATUSES)[number]

export function isExamStudentStatus(
  value: unknown
): value is ExamStudentStatus {
  return (
    typeof value === "string" &&
    (EXAM_STUDENT_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * DB境界の緩い文字列を ExamStudentStatus へ絞り込む。不正値は participating。
 * ScoringStatus の toScoringStatus と同型の「境界での型変換」（case 変換はしない）。
 */
export function toExamStudentStatus(
  value: string | null | undefined
): ExamStudentStatus {
  return isExamStudentStatus(value) ? value : "participating"
}
