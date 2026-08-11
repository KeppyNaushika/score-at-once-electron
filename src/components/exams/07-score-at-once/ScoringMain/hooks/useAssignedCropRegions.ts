import { useCallback, useEffect, useMemo, useState } from "react"

import type { CropRegionWithExamPage } from "@/components/exams/07-score-at-once/types"
import type { CropRegionAssignmentSummary } from "@/types/scoreDecision.types"

interface UseAssignedCropRegionsParams {
  examId: string
  userId: string | undefined
  cropRegions: CropRegionWithExamPage[]
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
  const [assignments, setAssignments] = useState<CropRegionAssignmentSummary[]>(
    []
  )
  const [canManage, setCanManage] = useState(false)
  const [memberCount, setMemberCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!examId || !userId) return
    try {
      const result = await window.electronAPI.getCropRegionAssignments(
        examId,
        userId
      )
      setAssignments(result.assignments)
      setCanManage(result.canManage)
      setMemberCount(result.memberCount)
    } catch (error) {
      console.error("Failed to fetch crop region assignments:", error)
    }
  }, [examId, userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectableCropRegions = useMemo(() => {
    if (assignments.length === 0 || canManage || !userId) return cropRegions

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
    refresh,
    /** 担当割当によって設問が絞られている（採点者に理由を伝えるため） */
    isFiltered: selectableCropRegions.length < cropRegions.length,
  }
}
