import type { Classroom } from "@prisma/client"

import type { ExamClassWithClass } from "@/types/electron/examClassApi"

/**
 * 採番学級の解決結果（studentId → 表示学級・出席番号・学級順）。
 *
 * renderer 側で administered 学級から解決する computed な形。採番学級（Prisma `Classroom`）を
 * 同梱し、05 の表示・並び替えや 08 の書き出し placement 生成で共有する。
 */
export interface ExamClassroomPlacement {
  /** 採番順を決める administered 学級（Prisma Classroom を同梱。未所属なら null） */
  classroom: Classroom | null
  attendanceNumber: number | null
  /** ExamClassroom の並び順 */
  order: number | null
}

/**
 * administered 学級（`examClassroom.getAdministered` の戻り値＝DB 構造そのまま）から、
 * 生徒ごとの採番学級・出席番号を renderer 側で解決する。
 *
 * order 昇順で走査し、各生徒が最初にマッチした administered 学級を採番学級とする
 * （first-match-wins）。memberships は `getAdministered` が受験日スナップショットで
 * 絞り込み済み。専用 IPC（旧 `getStudentClassInfo`）を廃し、DB 構造から直接計算することで
 * 重複ロジック・変更未追従を避ける。採番学級は 05/06 の複数箇所で使うため共通化する。
 */
export function resolveExamClassroomPlacement(
  administeredClasses: ExamClassWithClass[]
): Record<string, ExamClassroomPlacement> {
  // getAdministered は createdAt 順で返すため、採番の優先順位（order）で並べ直す
  const orderedClasses = [...administeredClasses].sort(
    (classA, classB) => classA.order - classB.order
  )

  const placementByStudent: Record<string, ExamClassroomPlacement> = {}
  for (const examClass of orderedClasses) {
    // 解決用に include した memberships は出力に含めず、Classroom スカラーを同梱する
    const { memberships: _memberships, ...classroom } = examClass.classroom
    for (const membership of examClass.classroom.memberships) {
      // 既に採番済みの生徒はスキップ（order 優先順位を尊重）
      if (placementByStudent[membership.studentId]) continue
      placementByStudent[membership.studentId] = {
        classroom,
        attendanceNumber: membership.attendanceNumber,
        order: examClass.order,
      }
    }
  }
  return placementByStudent
}
