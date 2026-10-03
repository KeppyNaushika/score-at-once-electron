/**
 * 個人成績表の割り付け（小計表の列の配分・表示する節）。
 * プレビュー（React）とPDF出力（renderToStaticMarkup）の両方で使用
 */
import type { IndividualReportOptions } from "@/types/individualReport.types"

/**
 * ドント方式で列数を各グループに配分
 */
export function allocateColumnsDHondt(
  groups: { groupId: string; items: { length: number } }[],
  totalColumns: number
): Map<string, number> {
  const allocation = new Map<string, number>()
  if (groups.length === 0) return allocation

  for (const group of groups) {
    allocation.set(group.groupId, 1)
  }

  if (groups.length >= totalColumns) {
    return allocation
  }

  let remainingColumns = totalColumns - groups.length
  while (remainingColumns > 0) {
    let maxQuotient = -1
    let maxGroupId = ""
    for (const group of groups) {
      const currentAllocation = allocation.get(group.groupId)!
      const quotient = group.items.length / (currentAllocation + 1)
      if (quotient > maxQuotient) {
        maxQuotient = quotient
        maxGroupId = group.groupId
      }
    }
    allocation.set(maxGroupId, allocation.get(maxGroupId)! + 1)
    remainingColumns--
  }

  return allocation
}

/**
 * アイテムを指定列数に分割（縦方向に埋める）
 */
export function splitItemsIntoColumns<T>(
  items: T[],
  columnCount: number
): T[][] {
  const result: T[][] = Array.from({ length: columnCount }, () => [])
  const itemsPerColumn = Math.ceil(items.length / columnCount)
  for (let i = 0; i < items.length; i++) {
    const colIndex = Math.floor(i / itemsPerColumn)
    if (colIndex < columnCount) {
      result[colIndex].push(items[i])
    }
  }
  return result
}

/**
 * 表示されるセクションのインデックスを取得
 */
export function getVisibleSectionIndices(
  options: IndividualReportOptions
): number[] {
  const indices: number[] = [0, 1, 2] // ヘッダー、生徒情報、統計サマリーは常に表示
  if (options.showSubtotalTable) indices.push(3)
  if (
    options.statistics.boxPlot.overall ||
    options.statistics.boxPlot.classroom
  )
    indices.push(4)
  if (options.showQuestionTable) indices.push(5)
  if (options.showLearningAdvice) indices.push(6)
  if (options.showComment) indices.push(7)
  if (options.showSignature) indices.push(8)
  return indices
}
