/**
 * 生徒マッチングロジック
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
} from "../../../../../src/types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import { describeCandidateCount, groupByHumanKey } from "../../humanKeyMatching"

/**
 * 生徒の事前照合
 *
 * - 取り込み先に同じ id の生徒がいれば、それが同じ生徒（byId）。照合はしない
 * - id で一致しなかった生徒は、学籍番号と氏名の両方で既存の生徒を引く。両方で当たれば
 *   byStudentNumber と byName の両方に載る（どちらで結ぶかは紐づけ方法と人の判断で決まる）
 * - 候補からは、別のアーカイブの生徒が id で取った既存の生徒を除く（改番した生徒 X が id で
 *   B に結ばれるとき、B の旧番号を持つ新入生 Y まで B に結んではいけない）
 */
export async function preMatchStudents(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingStudents = await prisma.student.findMany({
    include: { memberships: { include: { classroom: true } } },
  })
  const importStudents = importData.studentsData.students
  const importStudentIds = new Set(
    importStudents.map((importStudent) => importStudent.id)
  )

  const byId: MatchedItem[] = []
  const byStudentNumber: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(
    existingStudents.map((student) => [student.id, student])
  )
  // 学籍番号も氏名も unique ではないので、どちらも複数当たりうる。候補は
  // humanKeyMatching の決まりで古い順に並び、先頭を既定の結び付け先にする
  const claimableStudents = existingStudents.filter(
    (student) => !importStudentIds.has(student.id)
  )
  const existingByStudentNumber = groupByHumanKey(
    claimableStudents,
    (student) => student.studentNumber
  )
  const existingByName = groupByHumanKey(
    claimableStudents,
    (student) => `${student.lastName}|${student.firstName}`
  )

  // アーカイブ上の所属学級（画面で見分ける材料）
  const archiveClassroomById = new Map(
    importData.classesData.classrooms.map((classroom) => [
      classroom.id,
      classroom,
    ])
  )

  for (const importStudent of importStudents) {
    const displayLabel = `${importStudent.lastName}${importStudent.firstName}（${importStudent.studentNumber}）`
    const importStudentWithMemberships = {
      ...importStudent,
      memberships: importData.classesData.memberships
        .filter((membership) => membership.studentId === importStudent.id)
        .map((membership) => ({
          ...membership,
          classroom: archiveClassroomById.get(membership.classroomId) ?? null,
        })),
    }

    const idMatch = existingById.get(importStudent.id)
    if (idMatch) {
      byId.push({
        importId: importStudent.id,
        existingId: idMatch.id,
        importData: importStudentWithMemberships,
        existingData: idMatch,
        candidates: [{ existingId: idMatch.id, existingData: idMatch }],
        displayLabel,
        matchReason: "同じPCで作成されたデータ",
      })
      continue
    }

    const matchedItemOf = (
      candidates: typeof existingStudents,
      reason: string
    ): MatchedItem => ({
      importId: importStudent.id,
      existingId: candidates[0].id,
      importData: importStudentWithMemberships,
      existingData: candidates[0],
      candidates: candidates.map((candidate) => ({
        existingId: candidate.id,
        existingData: candidate,
      })),
      displayLabel,
      matchReason: describeCandidateCount(reason, candidates.length),
    })

    const studentNumberCandidates =
      existingByStudentNumber.get(importStudent.studentNumber) ?? []
    const nameCandidates =
      existingByName.get(
        `${importStudent.lastName}|${importStudent.firstName}`
      ) ?? []

    if (studentNumberCandidates.length > 0) {
      byStudentNumber.push(
        matchedItemOf(studentNumberCandidates, "学籍番号が一致")
      )
    }
    if (nameCandidates.length > 0) {
      byName.push(matchedItemOf(nameCandidates, "氏名が一致"))
    }
    if (studentNumberCandidates.length === 0 && nameCandidates.length === 0) {
      noMatch.push({
        importId: importStudent.id,
        importData: importStudentWithMemberships,
        displayLabel,
      })
    }
  }

  return {
    byId,
    byStudentNumber,
    byName,
    noMatch,
    allExistingItems: claimableStudents.map((student) => ({
      id: student.id,
      existingData: student,
    })),
  }
}
