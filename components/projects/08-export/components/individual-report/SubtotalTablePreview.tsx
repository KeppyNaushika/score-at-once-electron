"use client"

/**
 * 小計点テーブルプレビューコンポーネント
 * ドント方式による列数配分とグループ別表示に対応
 * - 列数=1: グループを縦に積み重ね（横並びにしない）
 * - 列数>1: グループを横に並べ、ドント方式で列を配分
 */
import type {
  IndividualReportData,
  SubtotalGroupSelection,
  SubtotalTableColumns,
} from "@/electron-src/lib/export/individual-report/types"
import type { SubtotalScore } from "@/electron-src/lib/shared/types/exportTypes"
import { Fragment, useMemo } from "react"

interface SubtotalTablePreviewProps {
  report: IndividualReportData
  fontScale: number
  subtotalGroupSelection?: SubtotalGroupSelection
  hideUnassignedSubtotals?: boolean
  columns?: SubtotalTableColumns
  showGroupSubtotals?: boolean
  /** フォントサイズ（px）。指定がない場合は10 * fontScale */
  fontSize?: number
}

/** グループ化されたデータ構造 */
interface GroupedSubtotals {
  groupId: string
  groupName: string
  items: SubtotalScore[]
  totalScore: number
  totalMaxScore: number
}

/** グループごとの表示データ（列配分情報付き） */
interface GroupTableData {
  groupId: string
  groupName: string
  allocatedColumns: number
  /** 各列のアイテム配列 */
  columnItems: SubtotalScore[][]
  /** 最大行数（列間で揃えるため） */
  maxRows: number
  totalScore: number
  totalMaxScore: number
}

/** 得点/配点の表示コンポーネント */
function ScoreDisplay({
  score,
  maxScore,
  fontSize,
}: {
  score: number | null
  maxScore: number
  fontSize: number
}) {
  return (
    <span>
      {score ?? "-"}
      <span style={{ fontSize: `${fontSize * 0.8}px`, color: "#666" }}>
        {" "}
        / {maxScore}
      </span>
    </span>
  )
}

/**
 * ドント方式で列数を各グループに配分
 */
function allocateColumnsDHondt(
  groups: GroupedSubtotals[],
  totalColumns: number
): Map<string, number> {
  const allocation = new Map<string, number>()

  if (groups.length === 0) return allocation

  // 全グループに最低1列を割り当て
  for (const group of groups) {
    allocation.set(group.groupId, 1)
  }

  // グループ数が列数以上の場合、各グループ1列で終了
  if (groups.length >= totalColumns) {
    return allocation
  }

  // 残りの列をドント方式で割り当て
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
function splitItemsIntoColumns(
  items: SubtotalScore[],
  columnCount: number
): SubtotalScore[][] {
  const result: SubtotalScore[][] = Array.from(
    { length: columnCount },
    () => []
  )
  const itemsPerColumn = Math.ceil(items.length / columnCount)

  for (let i = 0; i < items.length; i++) {
    const colIndex = Math.floor(i / itemsPerColumn)
    if (colIndex < columnCount) {
      result[colIndex].push(items[i])
    }
  }

  return result
}

export function SubtotalTablePreview({
  report,
  fontScale,
  subtotalGroupSelection,
  hideUnassignedSubtotals,
  columns = 1,
  showGroupSubtotals = true,
  fontSize,
}: SubtotalTablePreviewProps) {
  // フィルタリング適用
  const subtotalScores = useMemo(() => {
    let scores = report.scoringData.subtotalScores

    if (
      subtotalGroupSelection?.enabled &&
      subtotalGroupSelection.selectedGroupIds.length > 0
    ) {
      scores = scores.filter((score) =>
        subtotalGroupSelection.selectedGroupIds.includes(score.subtotalGroupId)
      )
    }

    if (hideUnassignedSubtotals) {
      scores = scores.filter((score) => score.hasQuestionAssignments)
    }

    return scores
  }, [report, subtotalGroupSelection, hideUnassignedSubtotals])

  // グループごとにグルーピング
  const groupedData = useMemo((): GroupedSubtotals[] => {
    const groupMap = new Map<string, GroupedSubtotals>()

    for (const score of subtotalScores) {
      const groupId = score.subtotalGroupId
      const existing = groupMap.get(groupId)
      if (existing) {
        existing.items.push(score)
        existing.totalScore += score.score
        existing.totalMaxScore += score.maxScore
      } else {
        groupMap.set(groupId, {
          groupId,
          groupName: score.subtotalGroupName,
          items: [score],
          totalScore: score.score,
          totalMaxScore: score.maxScore,
        })
      }
    }

    return Array.from(groupMap.values())
  }, [subtotalScores])

  // 横並びか縦積みかを決定
  // columns >= グループ数: 横並び（ドント方式で列配分）
  // columns < グループ数: 縦積み（各グループに同じ列数を適用）
  const isHorizontalLayout = columns >= groupedData.length

  // 各グループのテーブルデータを構築
  const groupTableDataList = useMemo((): GroupTableData[] => {
    if (groupedData.length === 0) return []

    if (isHorizontalLayout) {
      // 横並び: ドント方式で列配分
      const allocation = allocateColumnsDHondt(groupedData, columns)

      return groupedData.map((group) => {
        const allocatedColumns = allocation.get(group.groupId) || 1
        const columnItems = splitItemsIntoColumns(group.items, allocatedColumns)
        const maxRows = Math.max(...columnItems.map((col) => col.length))

        return {
          groupId: group.groupId,
          groupName: group.groupName,
          allocatedColumns,
          columnItems,
          maxRows,
          totalScore: group.totalScore,
          totalMaxScore: group.totalMaxScore,
        }
      })
    } else {
      // 縦積み: 各グループに指定された列数を適用
      return groupedData.map((group) => {
        const columnItems = splitItemsIntoColumns(group.items, columns)
        const maxRows = Math.max(...columnItems.map((col) => col.length))

        return {
          groupId: group.groupId,
          groupName: group.groupName,
          allocatedColumns: columns,
          columnItems,
          maxRows,
          totalScore: group.totalScore,
          totalMaxScore: group.totalMaxScore,
        }
      })
    }
  }, [groupedData, columns, isHorizontalLayout])

  // 全グループの合計列数（横並びの場合のみ使用）
  const totalAllocatedColumns = useMemo(() => {
    if (!isHorizontalLayout) return 1
    return groupTableDataList.reduce((sum, g) => sum + g.allocatedColumns, 0)
  }, [groupTableDataList, isHorizontalLayout])

  if (subtotalScores.length === 0) return null

  // フォントサイズ: fontSize prop があればそれを使用、なければ 10 * fontScale
  const baseFontSize = fontSize ?? 10 * fontScale

  const cellStyle: React.CSSProperties = {
    padding: `${1.5 * fontScale}mm ${2 * fontScale}mm`,
    borderBottom: "1px solid #e0e0e0",
    fontSize: `${baseFontSize}px`,
  }

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    borderBottom: "2px solid #ccc",
    textAlign: "center",
  }

  const groupSubtotalStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: "#f0f7ff",
    fontWeight: "bold",
  }

  return (
    <section style={{ marginBottom: "6mm" }}>
      <h2
        style={{
          fontSize: `${14 * fontScale}px`,
          fontWeight: "bold",
          marginBottom: "4mm",
          paddingBottom: "2mm",
          borderBottom: "1px solid #ddd",
        }}
      >
        小計別得点
      </h2>

      <div
        style={{
          display: isHorizontalLayout ? "flex" : "block",
          gap: isHorizontalLayout ? "2mm" : undefined,
        }}
      >
        {groupTableDataList.map((groupData, groupIndex) => {
          // 横並びの場合はグループの幅を列配分比率で計算
          const groupWidth = isHorizontalLayout
            ? `${(groupData.allocatedColumns / totalAllocatedColumns) * 100}%`
            : "100%"

          // 各列の幅を計算（ラベル60%、得点40%を列数で分割）
          const colWidthPercent = 100 / groupData.allocatedColumns
          const labelWidthPercent = colWidthPercent * 0.6
          const scoreWidthPercent = colWidthPercent * 0.4

          return (
            <div
              key={groupData.groupId}
              style={{
                width: groupWidth,
                marginBottom:
                  !isHorizontalLayout &&
                  groupIndex < groupTableDataList.length - 1
                    ? "4mm"
                    : undefined,
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: `${baseFontSize}px`,
                  tableLayout: "fixed",
                }}
              >
                {/* 列幅を明示的に定義 */}
                <colgroup>
                  {Array.from({ length: groupData.allocatedColumns }).map(
                    (_, i) => (
                      <Fragment key={i}>
                        <col style={{ width: `${labelWidthPercent}%` }} />
                        <col style={{ width: `${scoreWidthPercent}%` }} />
                      </Fragment>
                    )
                  )}
                </colgroup>
                {/* ヘッダー: グループ名（全列結合） */}
                <thead>
                  <tr>
                    <th
                      colSpan={groupData.allocatedColumns * 2}
                      style={headerCellStyle}
                    >
                      {groupData.groupName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* 各行をレンダリング */}
                  {Array.from({ length: groupData.maxRows }).map(
                    (_, rowIndex) => {
                      const isAlt = rowIndex % 2 === 1
                      const rowStyle: React.CSSProperties = {
                        backgroundColor: isAlt ? "#fafafa" : "transparent",
                      }

                      return (
                        <tr key={rowIndex} style={rowStyle}>
                          {groupData.columnItems.map((colItems, colIndex) => {
                            const item = colItems[rowIndex]
                            if (!item) {
                              // 空セル
                              return (
                                <Fragment key={colIndex}>
                                  <td style={cellStyle}></td>
                                  <td style={cellStyle}></td>
                                </Fragment>
                              )
                            }

                            const shortLabel =
                              item.subtotalLabel.length > 10
                                ? item.subtotalLabel.substring(0, 10) + "…"
                                : item.subtotalLabel

                            return (
                              <Fragment key={colIndex}>
                                <td
                                  style={{ ...cellStyle, textAlign: "left" }}
                                  title={item.subtotalLabel}
                                >
                                  {shortLabel}
                                </td>
                                <td
                                  style={{ ...cellStyle, textAlign: "center" }}
                                >
                                  <ScoreDisplay
                                    score={item.score}
                                    maxScore={item.maxScore}
                                    fontSize={baseFontSize}
                                  />
                                </td>
                              </Fragment>
                            )
                          })}
                        </tr>
                      )
                    }
                  )}
                  {/* フッター: 小計（全列結合） */}
                  {showGroupSubtotals && (
                    <tr>
                      <td
                        colSpan={groupData.allocatedColumns * 2 - 1}
                        style={{ ...groupSubtotalStyle, textAlign: "right" }}
                      >
                        計
                      </td>
                      <td
                        style={{ ...groupSubtotalStyle, textAlign: "center" }}
                      >
                        <ScoreDisplay
                          score={groupData.totalScore}
                          maxScore={groupData.totalMaxScore}
                          fontSize={baseFontSize}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </section>
  )
}
