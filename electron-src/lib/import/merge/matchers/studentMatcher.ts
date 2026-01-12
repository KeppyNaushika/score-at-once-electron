/**
 * 生徒マッチングロジック
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
  StudentMatchingMethod,
} from "../../../../../types/projectArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../project-archive/archiveExtractor"
import type { MatchResult, StudentData } from "./types"

/**
 * 生徒データのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合（同じPCでエクスポート/インポートした場合に一致）
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 *    - "none": 二次照合しない（新規として扱う）
 *    - "studentNumber": 学籍番号で照合
 *    - "name": 氏名で照合
 */
export async function matchStudents(
  importData: ExtractedArchiveData,
  method: StudentMatchingMethod
): Promise<MatchResult<StudentData>[]> {
  const results: MatchResult<StudentData>[] = []

  // 既存の生徒を全て取得
  const existingStudents = await prisma.student.findMany()

  for (const importStudent of importData.studentsData.students) {
    let matchedStudent: (typeof existingStudents)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingStudents.find((s) => s.id === importStudent.id)
    if (uuidMatch) {
      matchedStudent = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedStudent && method !== "none") {
      switch (method) {
        case "studentNumber":
          matchedStudent =
            existingStudents.find(
              (s) => s.studentNumber === importStudent.studentNumber
            ) ?? null
          break

        case "name":
          matchedStudent =
            existingStudents.find(
              (s) =>
                s.lastName === importStudent.lastName &&
                s.firstName === importStudent.firstName
            ) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importStudent.id,
        studentNumber: importStudent.studentNumber,
        lastName: importStudent.lastName,
        firstName: importStudent.firstName,
        lastNameKana: importStudent.lastNameKana,
        firstNameKana: importStudent.firstNameKana,
        enrollmentYear: importStudent.enrollmentYear,
        updatedAt: importStudent.updatedAt,
      },
      existingData: matchedStudent
        ? {
            id: matchedStudent.id,
            studentNumber: matchedStudent.studentNumber,
            lastName: matchedStudent.lastName,
            firstName: matchedStudent.firstName,
            lastNameKana: matchedStudent.lastNameKana,
            firstNameKana: matchedStudent.firstNameKana,
            enrollmentYear: matchedStudent.enrollmentYear,
            updatedAt: matchedStudent.updatedAt,
          }
        : null,
      matchType: matchedStudent ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

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
  const existingById = new Map(existingStudents.map((s) => [s.id, s]))
  const existingByStudentNumber = new Map(
    existingStudents.map((s) => [s.studentNumber, s])
  )
  // 氏名は重複がありうるので、最初に見つかったものを使用
  const existingByName = new Map<string, (typeof existingStudents)[0]>()
  for (const s of existingStudents) {
    const key = `${s.lastName}|${s.firstName}`
    if (!existingByName.has(key)) {
      existingByName.set(key, s)
    }
  }

  for (const importStudent of importData.studentsData.students) {
    const displayLabel = `${importStudent.lastName}${importStudent.firstName}（${importStudent.studentNumber}）`
    const importItem: ImportItem = {
      importId: importStudent.id,
      importData: importStudent as unknown as Record<string, unknown>,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importStudent.id)
    if (idMatch) {
      byId.push({
        importId: importStudent.id,
        existingId: idMatch.id,
        importData: importStudent as unknown as Record<string, unknown>,
        existingData: idMatch as unknown as Record<string, unknown>,
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
        importData: importStudent as unknown as Record<string, unknown>,
        existingData: studentNumberMatch as unknown as Record<string, unknown>,
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
        importData: importStudent as unknown as Record<string, unknown>,
        existingData: nameMatch as unknown as Record<string, unknown>,
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
