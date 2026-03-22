/**
 * 学級マッチングロジック
 */

import type {
  ClassMatchingMethod,
  ImportItem,
  MatchedItem,
  PreMatchingResult,
} from "../../../../../types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { ClassData, MatchResult } from "./types"

/**
 * 学級データのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchClasses(
  importData: ExtractedArchiveData,
  method: ClassMatchingMethod
): Promise<MatchResult<ClassData>[]> {
  const results: MatchResult<ClassData>[] = []

  const existingClasses = await prisma.class.findMany()

  for (const importClass of importData.classesData.classes) {
    let matchedClass: (typeof existingClasses)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingClasses.find((c) => c.id === importClass.id)
    if (uuidMatch) {
      matchedClass = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedClass && method !== "none") {
      switch (method) {
        case "name":
          matchedClass =
            existingClasses.find((c) => c.name === importClass.name) ?? null
          break
      }
    }

    results.push({
      importData: {
        id: importClass.id,
        name: importClass.name,
        classCode: importClass.classCode,
        grade: importClass.grade,
        description: importClass.description,
        updatedAt: importClass.updatedAt,
      },
      existingData: matchedClass
        ? {
            id: matchedClass.id,
            name: matchedClass.name,
            classCode: matchedClass.classCode,
            grade: matchedClass.grade,
            description: matchedClass.description,
            updatedAt: matchedClass.updatedAt,
          }
        : null,
      matchType: matchedClass ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}

/**
 * 学級の事前照合
 */
export async function preMatchClasses(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  const existingClasses = await prisma.class.findMany()

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(existingClasses.map((c) => [c.id, c]))
  const existingByName = new Map(existingClasses.map((c) => [c.name, c]))

  for (const importClass of importData.classesData.classes) {
    const displayLabel = importClass.name
    const importItem: ImportItem = {
      importId: importClass.id,
      importData: importClass,
      displayLabel,
    }

    // ID照合
    const idMatch = existingById.get(importClass.id)
    if (idMatch) {
      byId.push({
        importId: importClass.id,
        existingId: idMatch.id,
        importData: importClass,
        existingData: idMatch,
        displayLabel,
        matchReason: "同じパソコンで作成されたデータ",
      })
      continue
    }

    // 名前照合
    const nameMatch = existingByName.get(importClass.name)
    if (nameMatch) {
      byName.push({
        importId: importClass.id,
        existingId: nameMatch.id,
        importData: importClass,
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
