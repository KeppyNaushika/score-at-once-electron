import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import { cropRegionAssignmentsQuery } from "@/queries/scoring"
import type { CropRegionAssignmentSummary } from "@/types/scoreDecision.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ASSIGNMENTS: CropRegionAssignmentSummary[] = []

interface UseAssignedCropRegionsParams {
  examId: string
  userId: string
  cropRegions: QuestionAnswerRegionRow[]
}

/**
 * 採点担当にもとづいて「その人が選べる設問集合」を決める。
 *
 * 担当は権限ではなく選択肢の定義なので、バックエンドで採点を拒否はしない。
 * 絞り込みの規則:
 * - 割当が1件も無い試験は全設問（割当を使っていない試験の後方互換）
 * - OWNER は裁定者なので常に全設問
 * - 担当が0人の設問は全員担当（割当漏れで誰も採点できない状態を作らない）
 */
export function useAssignedCropRegions({
  examId,
  userId,
  cropRegions,
}: UseAssignedCropRegionsParams) {
  const { data } = useQuery({
    ...cropRegionAssignmentsQuery(examId, userId),
    enabled: Boolean(examId),
  })
  const assignments = data?.assignments ?? EMPTY_ASSIGNMENTS
  const canManage = data?.canManage ?? false
  const memberCount = data?.memberCount ?? 0

  const selectableCropRegions = useMemo(() => {
    if (assignments.length === 0 || canManage) return cropRegions

    const assigneeIdsByCropRegionId = assignments.reduce((acc, assignment) => {
      const assigneeIds = acc.get(assignment.cropRegionId) ?? new Set<string>()
      assigneeIds.add(assignment.userId)
      acc.set(assignment.cropRegionId, assigneeIds)
      return acc
    }, new Map<string, Set<string>>())

    return cropRegions.filter((cropRegion) => {
      const assigneeIds = assigneeIdsByCropRegionId.get(cropRegion.id)
      if (!assigneeIds || assigneeIds.size === 0) return true
      return assigneeIds.has(userId)
    })
  }, [assignments, canManage, cropRegions, userId])

  return {
    selectableCropRegions,
    /**
     * 試験のメンバー数。1以下なら協調採点ではないので、重い裁定サマリを
     * 引く必要がない（競合は構造的にゼロ）。
     */
    memberCount,
    /** 担当割当によって設問が絞られている（採点者に理由を伝えるため） */
    isFiltered: selectableCropRegions.length < cropRegions.length,
  }
}
