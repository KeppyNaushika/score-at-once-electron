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
 *
 * - 取り込み先に同じ id の学級があれば、それが同じ学級（byId）。照合はしない
 * - id で一致しなかった学級は、学級名で既存の学級を引く。候補からは、別のアーカイブの学級が
 *   id で取った既存の学級を除く（改名した学級と、同じ旧名で作った新しい学級を1つに結ばない）
 */
export async function preMatchClassrooms(
  importData: ExtractedArchiveData
): Promise<PreMatchingResult> {
  // 所属の行は、同じ名前の学級を人数で見分けるため（数えるのは画面）
  const existingClassrooms = await prisma.classroom.findMany({
    include: { memberships: true },
  })
  const importClassrooms = importData.classesData.classrooms
  const importClassroomIds = new Set(
    importClassrooms.map((importClassroom) => importClassroom.id)
  )

  const byId: MatchedItem[] = []
  const byName: MatchedItem[] = []
  const noMatch: ImportItem[] = []

  const existingById = new Map(
    existingClassrooms.map((classroom) => [classroom.id, classroom])
  )
  // 学級名は unique ではないので、名前で引くと複数当たりうる。候補は
  // humanKeyMatching の決まりで古い順に並び、先頭を既定の結び付け先にする
  const claimableClassrooms = existingClassrooms.filter(
    (classroom) => !importClassroomIds.has(classroom.id)
  )
  const existingByName = groupByHumanKey(
    claimableClassrooms,
    (classroom) => classroom.name
  )

  for (const importClassroom of importClassrooms) {
    const displayLabel = importClassroom.name
    const importClassroomWithMemberships = {
      ...importClassroom,
      memberships: importData.classesData.memberships.filter(
        (membership) => membership.classroomId === importClassroom.id
      ),
    }

    const idMatch = existingById.get(importClassroom.id)
    if (idMatch) {
      byId.push({
        importId: importClassroom.id,
        existingId: idMatch.id,
        importData: importClassroomWithMemberships,
        existingData: idMatch,
        candidates: [{ existingId: idMatch.id, existingData: idMatch }],
        displayLabel,
        matchReason: "同じPCで作成されたデータ",
      })
      continue
    }

    const nameCandidates = existingByName.get(importClassroom.name) ?? []
    if (nameCandidates.length > 0) {
      byName.push({
        importId: importClassroom.id,
        existingId: nameCandidates[0].id,
        importData: importClassroomWithMemberships,
        existingData: nameCandidates[0],
        candidates: nameCandidates.map((candidate) => ({
          existingId: candidate.id,
          existingData: candidate,
        })),
        displayLabel,
        matchReason: describeCandidateCount(
          "学級名が一致",
          nameCandidates.length
        ),
      })
      continue
    }

    noMatch.push({
      importId: importClassroom.id,
      importData: importClassroomWithMemberships,
      displayLabel,
    })
  }

  return {
    byId,
    byName,
    noMatch,
    allExistingItems: claimableClassrooms.map((classroom) => ({
      id: classroom.id,
      existingData: classroom,
    })),
  }
}
