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
 */
export async function preMatchStudents(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingStudents = await prisma.student.findMany()

  const byId: MatchedItem[] = []
  const byStudentNumber: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  // 既存データをID別、学籍番号別、氏名別にインデックス化。
  // 学籍番号も氏名も unique ではないので、どちらも複数当たりうる。候補は
  // humanKeyMatching の決まりで古い順に並び、先頭を候補として見せる。
  // 何件あったかは matchReason に載せる（利用者はこの画面で結び付け先を決めるので、
  // 「同じ学籍番号がもう1人いる」ことを知らないまま確定させてはいけない）
  const existingById = new Map(
    existingStudents.map((student) => [student.id, student])
  )
  const existingByStudentNumber = groupByHumanKey(
    existingStudents,
    (student) => student.studentNumber
  )
  const existingByName = groupByHumanKey(
    existingStudents,
    (student) => `${student.lastName}|${student.firstName}`
  )

  for (const importStudent of importData.studentsData.students) {
    const displayLabel = `${importStudent.lastName}${importStudent.firstName}（${importStudent.studentNumber}）`
    const importItem: ImportItem = {
      importId: importStudent.id,
      importData: importStudent,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importStudent.id)
    if (idMatch) {
      byId.push({
        importId: importStudent.id,
        existingId: idMatch.id,
        importData: importStudent,
        existingData: idMatch,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 学籍番号照合（ID不一致の場合のみ）
    const studentNumberCandidates =
      existingByStudentNumber.get(importStudent.studentNumber) ?? []
    const studentNumberMatch = studentNumberCandidates[0]
    if (studentNumberMatch) {
      byStudentNumber.push({
        importId: importStudent.id,
        existingId: studentNumberMatch.id,
        importData: importStudent,
        existingData: studentNumberMatch,
        displayLabel,
        matchReason: describeCandidateCount(
          "学籍番号が一致",
          studentNumberCandidates.length
        ),
      })
      continue
    }

    // 氏名照合（ID、学籍番号不一致の場合のみ）
    const nameKey = `${importStudent.lastName}|${importStudent.firstName}`
    const nameCandidates = existingByName.get(nameKey) ?? []
    const nameMatch = nameCandidates[0]
    if (nameMatch) {
      byName.push({
        importId: importStudent.id,
        existingId: nameMatch.id,
        importData: importStudent,
        existingData: nameMatch,
        displayLabel,
        matchReason: describeCandidateCount(
          "氏名が一致",
          nameCandidates.length
        ),
      })
      continue
    }

    // どれにも一致しない
    noMatch.push(importItem)
  }

  return {
    byId,
    byStudentNumber,
    byName,
    noMatch,
  }
}
