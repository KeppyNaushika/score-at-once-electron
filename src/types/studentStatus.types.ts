// 試験における生徒の受験状態（UI表記）の単一の真実源(SSOT)
// DB保存形式は大文字（electron-src の ExamStudentStatus="PARTICIPATING"|...）で、
// getStudentsForExam が toLowerCase() でこのUI表記へ変換する。
// Prisma(sqlite)は enum 非対応のため、この union が唯一の集約点となる。
export const STUDENT_STATUSES = ["participating", "expected", "absent"] as const

export type StudentStatus = (typeof STUDENT_STATUSES)[number]

export function isStudentStatus(value: unknown): value is StudentStatus {
  return (
    typeof value === "string" &&
    (STUDENT_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * DB保存形式（大文字 PARTICIPATING/EXPECTED/ABSENT）や任意の文字列を
 * UI表記の StudentStatus へ正規化する。不正値は participating にフォールバック。
 * ScoringStatus の toScoringStatus と同じ「境界での型変換」パターン。
 */
export function toStudentStatus(
  value: string | null | undefined
): StudentStatus {
  const normalized = value?.toLowerCase()
  return isStudentStatus(normalized) ? normalized : "participating"
}
