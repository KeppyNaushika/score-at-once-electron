import type { StudentExportPlacement } from "@/electron-src/lib/shared/types"
import { resolveExamClassroomPlacement } from "@/lib/examClassroomPlacement"

/**
 * 書き出し（Excel / 個人成績表）に必要な採番学級情報を renderer 側で解決して返す。
 *
 * 採番学級の解決は renderer が単一ソースで担い（`resolveExamClassroomPlacement`）、
 * main へは書き出しに必要な値だけ（学級名・学年・出席番号）を lean な形で渡す。
 * main 側は placement を解決せず、渡された値をそのまま出力に使う（export は型制限の対象外）。
 */
export async function loadStudentExportPlacements(
  examId: string
): Promise<Record<string, StudentExportPlacement>> {
  const administeredClassrooms =
    await window.electronAPI.examClassroom.getAdministered(examId)
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
