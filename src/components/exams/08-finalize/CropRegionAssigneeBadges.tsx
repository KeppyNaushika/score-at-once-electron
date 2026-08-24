"use client"

import { Badge } from "@/components/ui/badge"
import type { AssignedGrader } from "@/types/scoreDecision.types"

interface CropRegionAssigneeBadgesProps {
  /** この設問の担当（0人なら全員担当 — 割当漏れで採点不能にしないため） */
  assignees: ReadonlyArray<AssignedGrader>
  /** この設問の分母（答案がある受験者数）。バッジに `3/40` として添える */
  totalStudents: number
}

/**
 * 設問1つの採点担当バッジ。**読むだけ**。
 *
 * 割当を直す口は「3. 領域情報」の採点担当タブ（設問 × 採点者の対応表）1か所だけに
 * 置いてある。08 は食い違いを裁く画面なので、ここでは「誰の採点を突き合わせて
 * いるか」と「その人がどこまで採点したか」を読むためだけに出す。
 */
export function CropRegionAssigneeBadges({
  assignees,
  totalStudents,
}: CropRegionAssigneeBadgesProps) {
  if (assignees.length === 0) {
    return <span className="text-xs text-gray-400">担当なし（全員）</span>
  }

  return (
    <>
      {assignees.map((assignee) => (
        <Badge
          key={assignee.userId}
          variant="outline"
          className="gap-1 font-normal"
        >
          {assignee.userName}
          <span className="text-gray-500">
            {assignee.scoredCount}/{totalStudents}
          </span>
        </Badge>
      ))}
    </>
  )
}
