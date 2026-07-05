/**
 * 学級マッチングロジック
 */

import type {
  ClassroomMatchingMethod,
  ImportItem,
  MatchedItem,
  PreMatchingResult,
} from "../../../../../src/types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { ClassroomData, MatchResult } from "./types"

/**
 * 学級データのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchClassrooms(
  importData: ExtractedArchiveData,
  method: ClassroomMatchingMethod
): Promise<MatchResult<ClassroomData>[]> {
  const results: MatchResult<ClassroomData>[] = []

  const existingClassrooms = await prisma.classroom.findMany()

  for (const importClassroom of importData.classesData.classrooms) {
    let matchedClassroom: (typeof existingClassrooms)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingClassrooms.find(
      (classroom) => classroom.id === importClassroom.id
    )
    if (uuidMatch) {
      matchedClassroom = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedClassroom && method !== "none") {
      switch (method) {
        case "name":
          matchedClassroom =
            existingClassrooms.find(
              (classroom) => classroom.name === importClassroom.name
            ) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importClassroom.id,
        name: importClassroom.name,
        classroomCode: importClassroom.classroomCode,
        grade: importClassroom.grade,
        description: importClassroom.description,
        updatedAt: importClassroom.updatedAt,
      },
      existingData: matchedClassroom
        ? {
            id: matchedClassroom.id,
            name: matchedClassroom.name,
            classroomCode: matchedClassroom.classroomCode,
            grade: matchedClassroom.grade,
            description: matchedClassroom.description,
            updatedAt: matchedClassroom.updatedAt,
          }
        : null,
      matchType: matchedClassroom ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

/**
 * 学級の事前照合
 */
export async function preMatchClassrooms(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingClassrooms = await prisma.classroom.findMany()

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(
    existingClassrooms.map((classroom) => [classroom.id, classroom])
  )
  const existingByName = new Map(
    existingClassrooms.map((classroom) => [classroom.name, classroom])
  )

  for (const importClassroom of importData.classesData.classrooms) {
    const displayLabel = importClassroom.name
    const importItem: ImportItem = {
      importId: importClassroom.id,
      importData: importClassroom,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importClassroom.id)
    if (idMatch) {
      byId.push({
        importId: importClassroom.id,
        existingId: idMatch.id,
        importData: importClassroom,
        existingData: idMatch,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 名前照合
    const nameMatch = existingByName.get(importClassroom.name)
    if (nameMatch) {
      byName.push({
        importId: importClassroom.id,
        existingId: nameMatch.id,
        importData: importClassroom,
        existingData: nameMatch,
        displayLabel,
        matchReason: "学級名が一致",
      })
      continue
    }

    noMatch.push(importItem)
  }

  return {
    byId,
    byName,
    noMatch,
  }
}
