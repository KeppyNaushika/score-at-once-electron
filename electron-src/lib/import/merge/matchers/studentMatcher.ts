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

  // 既存データをID別、学籍番号別、氏名別にインデックス化
  const existingById = new Map(
    existingStudents.map((student) => [student.id, student])
  )
  const existingByStudentNumber = new Map(
    existingStudents.map((student) => [student.studentNumber, student])
  )
  // 氏名は重複がありうるので、最初に見つかったものを使用
  const existingByName = new Map<string, (typeof existingStudents)[0]>()
  for (const student of existingStudents) {
    const key = `${student.lastName}|${student.firstName}`
    if (!existingByName.has(key)) {
      existingByName.set(key, student)
    }
  }

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
    const studentNumberMatch = existingByStudentNumber.get(
      importStudent.studentNumber
    )
    if (studentNumberMatch) {
      byStudentNumber.push({
        importId: importStudent.id,
        existingId: studentNumberMatch.id,
        importData: importStudent,
        existingData: studentNumberMatch,
        displayLabel,
        matchReason: "学籍番号が一致",
      })
      continue
    }

    // 氏名照合（ID、学籍番号不一致の場合のみ）
    const nameKey = `${importStudent.lastName}|${importStudent.firstName}`
    const nameMatch = existingByName.get(nameKey)
    if (nameMatch) {
      byName.push({
        importId: importStudent.id,
        existingId: nameMatch.id,
        importData: importStudent,
        existingData: nameMatch,
        displayLabel,
        matchReason: "氏名が一致",
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
