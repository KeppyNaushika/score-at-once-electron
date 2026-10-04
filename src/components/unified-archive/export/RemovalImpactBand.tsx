"use client"

import { AlertCircle, Lock } from "lucide-react"

import { archiveTableLabel } from "../archiveTableLabels"
import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import type { useRemovalImpact } from "./hooks/useRemovalImpact"

interface RemovalImpactBandProps {
  /** 今いる行を外したときの影響。当てていない・引いている間は null */
  impact: ReturnType<typeof useRemovalImpact>
  catalog: ArchiveEntityCatalog
}

/**
 * チェック一覧の上に常に置く帯。チェックの入った行に当てると、その行を外したときに一緒に
 * 書き出されなくなる採点・答案などの件数を出す（一覧に並ぶ実体は赤枠で示す）。
 * 読み上げは置き場所（aria-live）の側で受ける
 */
export function RemovalImpactBand({ impact, catalog }: RemovalImpactBandProps) {
  if (impact === null) {
    return (
      <p className="rounded-lg border border-transparent px-3 py-2 text-xs text-muted-foreground">
        チェックの入った行に当てると、外したときに一緒に外れるものを赤枠で示します
      </p>
    )
  }

  const activeLabel = archiveEntityLabel(
    catalog,
    impact.activeEntity.kind,
    impact.activeEntity.entityId
  )

  if (impact.kind === "forcedExcluded") {
    const gradeNames = impact.gradeIds
      .map((gradeId) => `『${archiveEntityLabel(catalog, "Grade", gradeId)}』`)
      .join("")
    return (
      <p className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <Lock aria-hidden className="size-4 shrink-0" />「{activeLabel}
        」は外せません: 成績算出{gradeNames}が使う
      </p>
    )
  }

  const lostEntityCount = impact.lostEntityKeys.size
  const lostParts = [
    ...(lostEntityCount > 0 ? [`赤枠の${lostEntityCount}件`] : []),
    ...impact.lostRowCounts.map(
      ([table, lostCount]) =>
        `${archiveTableLabel(table)} ${lostCount.toLocaleString()}件`
    ),
  ]

  return (
    <p className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle aria-hidden className="size-4 shrink-0" />
      {lostParts.length === 0
        ? `「${activeLabel}」を外しても、ほかに外れるものはありません`
        : `「${activeLabel}」を外すと、${lostParts.join("・")}も書き出されなくなります`}
    </p>
  )
}
