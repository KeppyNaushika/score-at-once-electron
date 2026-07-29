"use client"

/**
 * 小計点テーブルプレビューコンポーネント
 * ドント方式による列数配分とグループ別表示に対応
 *
 * SubtotalTablePreview: hooks付きラッパー（プレビュー用）
 * SubtotalTableView: 純粋ビュー（プレビュー＋PDF出力共用）
 */
import { Fragment, useMemo } from "react"

import type {
  IndividualReportData,
  SubtotalGroupSelection,
  SubtotalTableColumns,
} from "@/electron-src/lib/export/individual-report/types"
import type { SubtotalScore } from "@/electron-src/lib/shared/types"

import {
  allocateColumnsDHondt,
  filterSubtotalScores,
  groupSubtotalData,
  splitItemsIntoColumns,
} from "./computeReportData"

interface SubtotalTablePreviewProps {
  report: IndividualReportData
  fontScale: number
  subtotalGroupSelection?: SubtotalGroupSelection
  hideUnassignedSubtotals?: boolean
  columns?: SubtotalTableColumns
  showGroupSubtotals?: boolean
  fontSize?: number
}

/** グループごとの表示データ（列配分情報付き） */
interface GroupTableData {
  groupId: string
  groupName: string
  allocatedColumns: number
  columnItems: SubtotalScore[][]
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
 * hooks付きラッパー（プレビュー用）
 */
export function SubtotalTablePreview({
  report,
  fontScale,
  subtotalGroupSelection,
  hideUnassignedSubtotals,
  columns = 1,
  showGroupSubtotals = true,
  fontSize,
}: SubtotalTablePreviewProps) {
  const subtotalScores = useMemo(
    () =>
      filterSubtotalScores(
        report.scoringData.subtotalScores,
        subtotalGroupSelection,
        hideUnassignedSubtotals
      ),
    [report, subtotalGroupSelection, hideUnassignedSubtotals]
  )

  const groupedData = useMemo(
    () => groupSubtotalData(subtotalScores),
    [subtotalScores]
  )

  const isHorizontalLayout = columns >= groupedData.length

  const groupTableDataList = useMemo((): GroupTableData[] => {
    if (groupedData.length === 0) return []

    if (isHorizontalLayout) {
      const allocation = allocateColumnsDHondt(groupedData, columns)
      return groupedData.map((group) => {
        const allocatedColumns = allocation.get(group.groupId) || 1
        const columnItems = splitItemsIntoColumns(group.items, allocatedColumns)
        const maxRows = Math.max(...columnItems.map((column) => column.length))
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
      return groupedData.map((group) => {
        const columnItems = splitItemsIntoColumns(group.items, columns)
        const maxRows = Math.max(...columnItems.map((column) => column.length))
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

  const totalAllocatedColumns = useMemo(() => {
    if (!isHorizontalLayout) return 1
    return groupTableDataList.reduce(
      (sum, groupData) => sum + groupData.allocatedColumns,
      0
    )
  }, [groupTableDataList, isHorizontalLayout])

  if (subtotalScores.length === 0) return null

  const baseFontSize = fontSize ?? 10 * fontScale

  return (
    <SubtotalTableView
      groupTableDataList={groupTableDataList}
      isHorizontalLayout={isHorizontalLayout}
      totalAllocatedColumns={totalAllocatedColumns}
      fontScale={fontScale}
      baseFontSize={baseFontSize}
      showGroupSubtotals={showGroupSubtotals}
    />
  )
}

// ============================
// SubtotalTableView（純粋ビュー）
// ============================

interface SubtotalTableViewProps {
  groupTableDataList: {
    groupId: string
    groupName: string
    allocatedColumns: number
    columnItems: SubtotalScore[][]
    maxRows: number
    totalScore: number
    totalMaxScore: number
  }[]
  isHorizontalLayout: boolean
  totalAllocatedColumns: number
  fontScale: number
  baseFontSize: number
  showGroupSubtotals: boolean
}

/**
 * 純粋ビューコンポーネント（hooks不使用）
 * プレビューとPDF出力の両方で使用
 */
export function SubtotalTableView({
  groupTableDataList,
  isHorizontalLayout,
  totalAllocatedColumns,
  fontScale,
  baseFontSize,
  showGroupSubtotals,
}: SubtotalTableViewProps) {
  if (groupTableDataList.length === 0) return null

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
          const groupWidth = isHorizontalLayout
            ? `${(groupData.allocatedColumns / totalAllocatedColumns) * 100}%`
            : "100%"

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
                  {Array.from({ length: groupData.maxRows }).map(
                    (_, rowIndex) => {
                      const isAlt = rowIndex % 2 === 1
                      const rowStyle: React.CSSProperties = {
                        backgroundColor: isAlt ? "#fafafa" : "transparent",
                      }

                      return (
                        <tr key={rowIndex} style={rowStyle}>
                          {groupData.columnItems.map((colItems, colIndex) => {
                            const subtotalScore = colItems[rowIndex]
                            if (!subtotalScore) {
                              return (
                                <Fragment key={colIndex}>
                                  <td style={cellStyle}></td>
                                  <td style={cellStyle}></td>
                                </Fragment>
                              )
                            }

                            const shortLabel =
                              subtotalScore.subtotalLabel.length > 10
                                ? subtotalScore.subtotalLabel.substring(0, 10) +
                                  "…"
                                : subtotalScore.subtotalLabel

                            return (
                              <Fragment key={colIndex}>
                                <td
                                  style={{ ...cellStyle, textAlign: "left" }}
                                  title={subtotalScore.subtotalLabel}
                                >
                                  {shortLabel}
                                </td>
                                <td
                                  style={{ ...cellStyle, textAlign: "center" }}
                                >
                                  <ScoreDisplay
                                    score={subtotalScore.score}
                                    maxScore={subtotalScore.maxScore}
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
