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
  /** 「すべて表示」。true なら担当で絞らない */
  showAll: boolean
}

/**
 * 採点担当にもとづいて「その人が選べる設問集合」を決める。
 *
 * 担当は権限ではなく選択肢の定義なので、バックエンドで採点を拒否はしない。
 * 絞り込みの規則（docs/scoring-scope-and-permissions-design.md §2-2・§3-2）:
 * - **役割では決めない。** OWNER でも自分の割り当てで絞る。OWNER の特権は割り当てを
 *   変えられることで、絞り込みを無視することではない（学年で2人の OWNER が分担する
 *   ときに、素通りさせると割り当てが無意味になる）。全体を見たいときは「すべて表示」
 * - 担当が0人の設問は全員担当（割当漏れで誰も採点できない状態を作らない）
 */
export function useAssignedCropRegions({
  examId,
  userId,
  cropRegions,
  showAll,
}: UseAssignedCropRegionsParams) {
  const { data } = useQuery({
    ...cropRegionAssignmentsQuery(examId, userId),
    enabled: Boolean(examId),
  })
  const assignments = data?.assignments ?? EMPTY_ASSIGNMENTS
  const memberCount = data?.memberCount ?? 0
  /** 採点を確定できるか（試験のオーナー）。担当の絞り込みには使わない */
  const canDecideScores = data?.canManage ?? false

  /** 自分の担当で絞った設問（「すべて表示」に関わらず、担当の範囲を数えるのに使う） */
  const assignedCropRegions = useMemo(() => {
    if (assignments.length === 0) return cropRegions

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
  }, [assignments, cropRegions, userId])

  const selectableCropRegions = showAll ? cropRegions : assignedCropRegions

  return {
    selectableCropRegions,
    /**
     * 試験のメンバー数。1以下なら協調採点ではないので、重い裁定サマリを
     * 引く必要がない（競合は構造的にゼロ）。
     */
    memberCount,
    canDecideScores,
    /** 担当割当によって設問が絞られている（採点者に理由を伝えるため） */
    isFiltered: selectableCropRegions.length < cropRegions.length,
    /** 自分の担当の設問の数（「すべて表示」中でも、担当の範囲を伝えるため） */
    assignedCropRegionCount: assignedCropRegions.length,
  }
}
