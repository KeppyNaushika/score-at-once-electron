/**
 * 書き出しダイアログで、選んだ学級の生徒を生徒の一覧で選んだ状態にする
 *
 * 名簿と在籍は既存の生徒一覧（`studentListQuery`。在籍を同梱している）から求める。学級の
 * 範囲の規則（main の resolver）は変えず、書き出しに渡す `shared.Student` を増やすだけ。
 */

import { type MembershipPhase, membershipPhase } from "@/lib/membership"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

import type { ArchiveSelectableKind, ExportSelectionState } from "./types"

/**
 * 学級 → その学級の生徒。選んだ時期（アプリ共通の `membershipPhase`: 在籍中・在籍予定・
 * 過去在籍）のどれかに当たる所属をその学級に持つ生徒。時期を1つも選んでいなければ空
 *
 * @param students - 生徒一覧（在籍つき）。並びは一覧の並びのまま使う
 */
export function buildClassroomStudentIndex(
  students: readonly StudentWithMemberships[],
  phases: ReadonlySet<MembershipPhase>
): ReadonlyMap<string, readonly string[]> {
  const studentIdsByClassroom = new Map<string, string[]>()
  if (phases.size === 0) return studentIdsByClassroom
  const today = new Date()
  for (const student of students) {
    const classroomIds = new Set(
      student.memberships
        .filter((membership) => phases.has(membershipPhase(membership, today)))
        .map((membership) => membership.classroomId)
    )
    for (const classroomId of classroomIds) {
      const studentIds = studentIdsByClassroom.get(classroomId) ?? []
      studentIds.push(student.id)
      studentIdsByClassroom.set(classroomId, studentIds)
    }
  }
  return studentIdsByClassroom
}

/**
 * 選んだ学級から入る生徒 → どの学級から入ったか（選んだ学級の順）。自分で選んだ生徒と、
 * 1人ずつ外した生徒は載せない
 */
export function classroomSourcesOfStudents(
  selection: ExportSelectionState,
  classroomStudentIndex: ReadonlyMap<string, readonly string[]>
): ReadonlyMap<string, readonly string[]> {
  const ownStudentIds = new Set(selection.picked.Student)
  const removedStudentIds = new Set(selection.removedClassroomStudentIds)
  const sourcesByStudent = new Map<string, string[]>()
  for (const classroomId of selection.picked.Classroom) {
    for (const studentId of classroomStudentIndex.get(classroomId) ?? []) {
      if (ownStudentIds.has(studentId) || removedStudentIds.has(studentId)) {
        continue
      }
      const classroomIds = sourcesByStudent.get(studentId) ?? []
      classroomIds.push(classroomId)
      sourcesByStudent.set(studentId, classroomIds)
    }
  }
  return sourcesByStudent
}

/**
 * 書き出しに渡す形の選択。選んだ生徒 = 自分で選んだ生徒 ∪（選んだ学級の生徒 − 外した生徒）
 */
export function withClassroomStudents(
  selection: ExportSelectionState,
  classroomStudentIndex: ReadonlyMap<string, readonly string[]>
): ExportSelectionState {
  const sourcesByStudent = classroomSourcesOfStudents(
    selection,
    classroomStudentIndex
  )
  if (sourcesByStudent.size === 0) return selection
  return {
    ...selection,
    picked: {
      ...selection.picked,
      Student: [...selection.picked.Student, ...sourcesByStudent.keys()],
    },
  }
}

/**
 * 生徒の行を自分で付け外ししたときの「1人ずつ外した生徒」。チェックを外した生徒が選んだ
 * 学級の生徒なら足し、チェックを入れた生徒は除く（自分で選び直したら学級からも戻る）
 */
export function updateRemovedClassroomStudents(
  selection: ExportSelectionState,
  classroomStudentIndex: ReadonlyMap<string, readonly string[]>,
  kind: ArchiveSelectableKind,
  studentId: string,
  isChecked: boolean
): ExportSelectionState {
  if (kind !== "Student") return selection
  const remaining = selection.removedClassroomStudentIds.filter(
    (removedId) => removedId !== studentId
  )
  const isClassroomStudent = selection.picked.Classroom.some((classroomId) =>
    (classroomStudentIndex.get(classroomId) ?? []).includes(studentId)
  )
  return {
    ...selection,
    removedClassroomStudentIds:
      !isChecked && isClassroomStudent ? [...remaining, studentId] : remaining,
  }
}
