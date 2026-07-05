import type { StudentClassInfo } from "@/types/electron/examClassApi"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

// 生徒データの型 = Prisma拡張(StudentWithMemberships: scalars + memberships+classroom)に
// 試験別の計算フィールド（Prismaに存在しない導出値）を付与した view-model。
// getStudentsForExam の戻り値（examApi.d.ts）と同じ形。
export type Student = StudentWithMemberships & {
  /** ExamClass(administered=true)から取得した学級情報 */
  examClassInfo?: StudentClassInfo | null
  status: ExamStudentStatus
  customOrder?: number | null
  answerSheetCount: number
}
