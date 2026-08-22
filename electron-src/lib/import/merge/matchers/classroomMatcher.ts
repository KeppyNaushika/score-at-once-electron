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
import { describeCandidateCount, groupByHumanKey } from "../../humanKeyMatching"

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
  // 学級名は unique ではないので、名前で引くと複数当たりうる。候補は
  // humanKeyMatching の決まりで古い順に並び、先頭を候補として見せる。
  // 何件あったかは matchReason に載せる（利用者はこの画面で結び付け先を決める）
  const existingByName = groupByHumanKey(
    existingClassrooms,
    (classroom) => classroom.name
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
    const nameCandidates = existingByName.get(importClassroom.name) ?? []
    const nameMatch = nameCandidates[0]
    if (nameMatch) {
      byName.push({
        importId: importClassroom.id,
        existingId: nameMatch.id,
        importData: importClassroom,
        existingData: nameMatch,
        displayLabel,
        matchReason: describeCandidateCount(
          "学級名が一致",
          nameCandidates.length
        ),
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
