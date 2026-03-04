/**
 * ヘッダー記入欄レイアウト計算
 *
 * HeaderFieldDefinition[] → ComputedHeaderField[] への変換を行う。
 * フィールドを order 順に左から配置し、マス目のセル幅を計算する。
 */

import type { GlobalSettings } from "@/types/answerSheetDefinition.types"
import type { ComputedHeaderField } from "@/types/answerSheetLayout.types"

export function computeHeaderFieldLayout(
  settings: GlobalSettings,
  contentLeft: number,
  headerTopY: number
): { fields: ComputedHeaderField[]; totalHeightMm: number } {
  const { headerFields } = settings
  if (headerFields.length === 0) {
    return { fields: [], totalHeightMm: 0 }
  }

  const sorted = [...headerFields].sort((a, b) => a.order - b.order)
  const gap = 2 // フィールド間のギャップ (mm)
  let currentX = contentLeft

  const fields: ComputedHeaderField[] = sorted.map((field) => {
    const computed: ComputedHeaderField = {
      fieldId: field.id,
      label: field.label,
      x: currentX,
      y: headerTopY,
      width: field.widthMm,
      height: field.heightMm,
      gridCount: field.gridCount,
      lineStyle: field.lineStyle,
      lineWidth: field.lineWidth,
      gridCellWidthMm:
        field.gridCount > 0 ? field.widthMm / field.gridCount : undefined,
    }
    currentX += field.widthMm + gap
    return computed
  })

  const totalHeightMm = Math.max(...sorted.map((f) => f.heightMm))

  return { fields, totalHeightMm }
}
