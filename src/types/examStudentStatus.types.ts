// 試験における生徒の受験状態（ExamStudent.status）の単一の真実源(SSOT)
// DB も小文字で保存する（QuestionScore.status と同じ規約）。
// Prisma(sqlite)は enum 非対応のため、この union が唯一の集約点となる。
import { defineStringUnion } from "./stringUnion"

export const EXAM_STUDENT_STATUSES = [
  "participating",
  "expected",
  "absent",
] as const

export type ExamStudentStatus = (typeof EXAM_STUDENT_STATUSES)[number]

/**
 * 型ガード `isExamStudentStatus` と境界コンバータ `toExamStudentStatus`
 * （想定外値は受験 participating）。
 */
export const { is: isExamStudentStatus, to: toExamStudentStatus } =
  defineStringUnion(EXAM_STUDENT_STATUSES, "participating")
