"use client"

import { Badge } from "@/components/ui/badge"

import type { RegionInkMeasurementRow } from "./types"

interface AiBlanknessBadgeProps {
  inkMeasurement: RegionInkMeasurementRow | null
}

/**
 * 一覧のマスに出す、インク率で測った白紙の印（AI は関わらない）。
 *
 * - 白紙: 「白紙を無答に」の対象になる印（自分が採点済みなら対象外だが、印は出す）
 * - 境界帯: 白紙か書き込みか際どい。「白紙を無答に」には含めないので、破線で別に示す
 * - 書き込みあり・測れなかった答案には出さない
 */
export function AiBlanknessBadge({ inkMeasurement }: AiBlanknessBadgeProps) {
  switch (inkMeasurement?.blankness) {
    case "blank":
      return (
        <Badge
          variant="outline"
          className="h-4 px-1 text-xs"
          title="インク率で白紙と判定（「白紙を無答に」の対象。採点済みは除く）"
          data-testid="ai-blankness-badge"
          data-blankness="blank"
        >
          白紙
        </Badge>
      )
    case "borderline":
      return (
        <Badge
          variant="outline"
          className="h-4 border-dashed px-1 text-xs text-muted-foreground"
          title="インク率が白紙と書き込みの境界帯（「白紙を無答に」には含めない）"
          data-testid="ai-blankness-badge"
          data-blankness="borderline"
        >
          白紙?
        </Badge>
      )
    default:
      return null
  }
}
