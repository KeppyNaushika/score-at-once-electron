/**
 * ヘッダー記入欄レイアウト計算
 *
 * HeaderFieldDefinition[] → ComputedHeaderField[] への変換を行う。
 * フィールドを order 順に左から配置し、マス目のセル幅を計算する。
 * hfill 要素は固定幅要素の残り幅を均等配分して伸縮する。
 * label 要素はボックスなしのテキスト表示用。
 */

import type { GlobalSettings } from "@/types/answerSheetDefinition.types"
import type { ComputedHeaderField } from "@/types/answerSheetLayout.types"

export function computeHeaderFieldLayout(
  settings: GlobalSettings,
  contentLeft: number,
  headerTopY: number,
  contentRight?: number
): { fields: ComputedHeaderField[]; totalHeightMm: number } {
  const { headerFields } = settings
  if (headerFields.length === 0) {
    return { fields: [], totalHeightMm: 0 }
  }

  const sorted = [...headerFields].sort((a, b) => a.order - b.order)
  const gap = 2 // フィールド間のギャップ (mm)

  // hfill の幅を計算: 全幅から固定要素とギャップを引いた残りを均等配分
  const hfillCount = sorted.filter(
    (f) => (f.type ?? "field") === "hfill"
  ).length
  let hfillWidth = 0

  if (hfillCount > 0 && contentRight != null) {
    const totalAvailableWidth = contentRight - contentLeft
    const fixedWidth = sorted.reduce((sum, f) => {
      if ((f.type ?? "field") === "hfill") return sum
      return sum + f.widthMm
    }, 0)
    const totalGaps = (sorted.length - 1) * gap
    const remainingWidth = Math.max(
      0,
      totalAvailableWidth - fixedWidth - totalGaps
    )
    hfillWidth = remainingWidth / hfillCount
  }

  let currentX = contentLeft

  const fields: ComputedHeaderField[] = sorted.map((field) => {
    const fieldType = field.type ?? "field"
    const effectiveWidth = fieldType === "hfill" ? hfillWidth : field.widthMm

    const computed: ComputedHeaderField = {
      fieldId: field.id,
      type: fieldType,
      label: field.label,
      x: currentX,
      y: headerTopY,
      width: effectiveWidth,
      height: field.heightMm,
      gridCount: fieldType === "field" ? field.gridCount : 0,
      lineStyle: field.lineStyle,
      lineWidth: field.lineWidth,
      gridCellWidthMm:
        fieldType === "field" && field.gridCount > 0
          ? field.widthMm / field.gridCount
          : undefined,
      fontSize: fieldType === "label" ? (field.fontSize ?? 5) : undefined,
    }
    currentX += effectiveWidth + gap
    return computed
  })

  // hfill は高さ 0 として扱わない: field/label の最大高さを使う
  const nonHfillFields = sorted.filter((f) => (f.type ?? "field") !== "hfill")
  const totalHeightMm =
    nonHfillFields.length > 0
      ? Math.max(...nonHfillFields.map((f) => f.heightMm))
      : 0

  return { fields, totalHeightMm }
}
