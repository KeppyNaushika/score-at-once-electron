/**
 * 小計項目の「採点マークの色」から、設問ごとに描く色を決める（issue #1543）。
 *
 * 採点画面（07 の個別表示）と結果出力（09）の両方が使うので機能内ではなくここに置く。
 * main は試験の小計点グループ（設問の割り当てつき）をそのまま返し、色の決定は renderer が行う。
 */
import type { ExamSubtotalGroupRow } from "@/queries/subtotal"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"

/**
 * 設問（CropRegion.id）→ 描く色。色の無い設問は入らない。
 *
 * 1つの設問が色のある小計項目2つ以上に属するときは、上にある小計点グループ、
 * その中で上にある小計項目の色を使う。グループの上下は小計点管理の並び
 * （order の昇順、同じ値は作った日時の新しい順）、項目の上下は項目の order
 */
export function buildSubtotalMarkColorByCropRegionId(
  examSubtotalGroups: readonly ExamSubtotalGroupRow[]
): Map<string, string> {
  const subtotalGroupsByPriority = examSubtotalGroups
    .map((examSubtotalGroup) => examSubtotalGroup.subtotalGroup)
    .sort(
      (subtotalGroupA, subtotalGroupB) =>
        subtotalGroupA.order - subtotalGroupB.order ||
        new Date(subtotalGroupB.createdAt).getTime() -
          new Date(subtotalGroupA.createdAt).getTime()
    )

  const markColorByCropRegionId = new Map<string, string>()
  for (const subtotalGroup of subtotalGroupsByPriority) {
    const subtotalsByPriority = [...subtotalGroup.subtotals].sort(
      (subtotalA, subtotalB) => subtotalA.order - subtotalB.order
    )
    for (const subtotal of subtotalsByPriority) {
      if (subtotal.markColor === null) continue
      for (const cropSubtotal of subtotal.cropSubtotals) {
        if (markColorByCropRegionId.has(cropSubtotal.cropRegionId)) continue
        markColorByCropRegionId.set(
          cropSubtotal.cropRegionId,
          subtotal.markColor
        )
      }
    }
  }
  return markColorByCropRegionId
}

/**
 * 1設問を描くときの設定。小計項目の色があれば、採点マークと設問の点数の色だけを差し替える
 * （小計点・合計点・注釈の色は変えない）。色が無いか、試験のスイッチが OFF ならそのまま返す
 */
export function overlaySettingsForCropRegion(
  answerOverlaySettings: AnswerOverlaySettings,
  markColorByCropRegionId: ReadonlyMap<string, string>,
  cropRegionId: string
): AnswerOverlaySettings {
  if (!answerOverlaySettings.subtotalMarkColorEnabled) {
    return answerOverlaySettings
  }
  const markColor = markColorByCropRegionId.get(cropRegionId)
  if (markColor === undefined) return answerOverlaySettings

  const { styles } = answerOverlaySettings
  return {
    ...answerOverlaySettings,
    styles: {
      ...styles,
      mark: { ...styles.mark, color: markColor },
      partial: { ...styles.partial, color: markColor },
    },
  }
}
