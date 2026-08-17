import type { ExamClassroomWithMemberships } from "@/electron-src/lib/prisma/examClassroom"
import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import { resolveExamClassroomPlacement } from "@/lib/examClassroomPlacement"

/**
 * 書き出し（Excel / 個人成績表）に必要な採番学級情報を、採番学級の行から解く。
 *
 * 採番学級の解決は renderer が単一ソースで担い（`resolveExamClassroomPlacement`）、
 * main へは書き出しに必要な値だけ（学級名・学年・出席番号）を lean な形で渡す。
 * main 側は placement を解決せず、渡された値をそのまま出力に使う（export は型制限の対象外）。
 *
 * **返り値のキーは Student.id**。学級所属（StudentClassroomMembership）は人に紐づくので、
 * 受験者ID（ExamStudent.id）ではない。main 側の引き当ても Student.id で行うこと。
 *
 * 引数は `administeredExamClassroomsQuery` が返す行そのもの。取得はコンポーネントが
 * 持ち、ここは計算だけを持つ（純粋関数なので取得と一緒に走らせない）。
 */
export function toStudentExportPlacements(
  administeredClassrooms: ExamClassroomWithMemberships[]
): Record<string, StudentExportPlacement> {
  const placementByStudent = resolveExamClassroomPlacement(
    administeredClassrooms
  )

  return Object.fromEntries(
    Object.entries(placementByStudent).map(([studentId, placement]) => [
      studentId,
      {
        grade: placement.classroom?.grade ?? null,
        className: placement.classroom?.name ?? null,
        attendanceNumber: placement.attendanceNumber,
      },
    ])
  )
}
