/**
 * 学級マッチングロジック
 */

import type {
  ImportItem,
  MatchedItem,
  PreMatchingResult,
} from "../../../../../src/types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"

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
