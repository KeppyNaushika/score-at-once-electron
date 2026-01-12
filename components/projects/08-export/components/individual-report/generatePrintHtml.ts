/**
 * 個人成績表の印刷用HTMLを生成
 * プレビューコンポーネントと同じ構造のHTMLを生成し、
 * セクション単位での改ページとページ振り分けに対応
 */
import type {
  AdviceOptions,
  IndividualReportData,
  IndividualReportOptions,
  StatisticsData,
  SubtotalRawScores,
} from "@/electron-src/lib/export/individual-report/types"

import { calculateLearningAdvice } from "../../utils/learningAdviceCalculator"

/** 受験状態フィルタ */
interface BoxPlotIncludeStatuses {
  participating: boolean
  expected: boolean
  absent: boolean
}

/** ページ振り分け情報 */
export interface PageAllocation {
  pageIndex: number
  sectionIndices: number[]
}

/**
 * 複数の個人成績表を結合した印刷用HTMLを生成
 * @param reports 生徒ごとのレポートデータ
 * @param options 表示オプション
 * @param reportsPageAllocations 各レポートのページ振り分け情報（省略時はすべてのセクションを1ページに）
 */
export function generatePrintHtml(
  reports: IndividualReportData[],
  options: IndividualReportOptions,
  reportsPageAllocations?: PageAllocation[][]
): string {
  const fontScale = 1

  // 表示されるセクションのインデックスを計算
  const visibleSectionIndices = getVisibleSectionIndices(options)

  // 各レポートのHTMLを生成
  const reportsHtml = reports
    .map((report, reportIndex) => {
      const pageAllocations = reportsPageAllocations?.[reportIndex]
      const isLastReport = reportIndex === reports.length - 1

      // レポートのHTMLを生成
      const reportHtml = generateSingleReportPrintHtml(
        report,
        options,
        fontScale,
        visibleSectionIndices,
        pageAllocations
      )

      // 最後のレポート以外は改ページを挿入
      return `
        <div class="student-report${isLastReport ? "" : " page-break-after"}">
          ${reportHtml}
        </div>
      `
    })
    .join("")

  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>個人成績表</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 5mm;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: "Noto Sans JP", "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #1a1a1a;
          background: white;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page-break-after {
          page-break-after: always;
        }

        .page-break-before {
          page-break-before: always;
        }

        .report-section {
          page-break-inside: avoid;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        tr {
          page-break-inside: avoid;
        }
      </style>
    </head>
    <body>
      ${reportsHtml}
    </body>
    </html>
  `
}

/**
 * 単一レポートの印刷用HTMLを生成
 */
function generateSingleReportPrintHtml(
  report: IndividualReportData,
  options: IndividualReportOptions,
  fontScale: number,
  visibleSectionIndices: number[],
  pageAllocations?: PageAllocation[]
): string {
  // 学習アドバイスを計算
  const learningAdvice = calculateLearningAdvice(
    report.scoringData.scores,
    report.statistics.questionCorrectRates,
    options.adviceOptions
  )

  // 各ページの先頭セクションを特定
  const pageStartSections = new Set<number>()
  if (pageAllocations && pageAllocations.length > 1) {
    pageAllocations.forEach((page, pageIdx) => {
      if (pageIdx > 0 && page.sectionIndices.length > 0) {
        pageStartSections.add(page.sectionIndices[0])
      }
    })
  }

  // 各セクションを生成
  const sectionsHtml = visibleSectionIndices
    .map((sectionIndex) => {
      const sectionHtml = generateSection(
        sectionIndex,
        report,
        options,
        fontScale,
        learningAdvice
      )
      if (!sectionHtml) return ""

      const pageBreak = pageStartSections.has(sectionIndex)
        ? "page-break-before"
        : ""

      return `<div class="report-section ${pageBreak}">${sectionHtml}</div>`
    })
    .join("")

  return `
    <div class="individual-report-page" style="
      width: 200mm;
      min-height: 287mm;
      padding: 0;
      background-color: white;
      font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
      font-size: ${12 * fontScale}px;
      line-height: 1.5;
      color: #1a1a1a;
      box-sizing: border-box;
    ">
      ${sectionsHtml}
    </div>
  `
}

/**
 * 表示されるセクションのインデックスを取得
 */
function getVisibleSectionIndices(options: IndividualReportOptions): number[] {
  const indices: number[] = [0, 1, 2] // ヘッダー、生徒情報、統計サマリーは常に表示
  if (options.showSubtotalTable) indices.push(3)
  if (options.graphOptions.showBoxPlot) indices.push(4)
  if (options.showQuestionTable) indices.push(5)
  if (options.showLearningAdvice) indices.push(6)
  if (options.showComment) indices.push(7)
  if (options.showSignature) indices.push(8)
  return indices
}

/**
 * セクションのHTMLを生成
 */
function generateSection(
  index: number,
  report: IndividualReportData,
  options: IndividualReportOptions,
  fontScale: number,
  learningAdvice: ReturnType<typeof calculateLearningAdvice>
): string {
  switch (index) {
    case 0:
      return generateHeader(report, fontScale)
    case 1:
      return generateStudentInfo(report, fontScale)
    case 2:
      return generateStatsSummary(report, options, fontScale)
    case 3:
      return generateSubtotalTable(report, options, fontScale)
    case 4:
      return generateBoxPlot(report, options, fontScale)
    case 5:
      return generateQuestionTable(report, options, fontScale)
    case 6:
      return generateLearningAdvice(
        learningAdvice,
        options.adviceOptions,
        fontScale
      )
    case 7:
      return generateCommentSection(fontScale)
    case 8:
      return generateSignatureSection(fontScale)
    default:
      return ""
  }
}

// ヘッダー
function generateHeader(
  report: IndividualReportData,
  fontScale: number
): string {
  const examDate = report.examInfo.examDate
    ? formatDate(report.examInfo.examDate)
    : ""

  return `
    <header style="
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid #333;
    ">
      <div>
        <h1 style="font-size: ${18 * fontScale}px; font-weight: bold; margin: 0;">
          ${escapeHtml(report.examInfo.examName)}
        </h1>
        ${
          report.examInfo.subject
            ? `
          <p style="font-size: ${12 * fontScale}px; color: #666; margin: 2mm 0 0 0;">
            ${escapeHtml(report.examInfo.subject)}
          </p>
        `
            : ""
        }
      </div>
      <div style="text-align: right;">
        ${
          examDate
            ? `
          <p style="font-size: ${12 * fontScale}px; color: #666; margin: 0;">
            ${examDate}
          </p>
        `
            : ""
        }
        <p style="font-size: ${14 * fontScale}px; font-weight: bold; margin: 2mm 0 0 0;">
          個人成績表
        </p>
      </div>
    </header>
  `
}

// 生徒情報
function generateStudentInfo(
  report: IndividualReportData,
  fontScale: number
): string {
  const studentInfo = report.studentInfo
  const classInfo = [
    studentInfo.grade ? `${studentInfo.grade}年` : "",
    studentInfo.className || "",
    studentInfo.attendanceNumber != null
      ? `${studentInfo.attendanceNumber}番`
      : "",
  ]
    .filter(Boolean)
    .join(" ")

  return `
    <section style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6mm;
      padding: 4mm;
      background-color: #f5f5f5;
      border-radius: 2mm;
    ">
      <div>
        <p style="font-size: ${16 * fontScale}px; font-weight: bold; margin: 0;">
          ${escapeHtml(studentInfo.fullName)}
        </p>
        <p style="font-size: ${11 * fontScale}px; color: #666; margin: 1mm 0 0 0;">
          ${escapeHtml(studentInfo.studentNumber)}
        </p>
      </div>
      <div style="text-align: right;">
        <p style="font-size: ${12 * fontScale}px; margin: 0;">
          ${escapeHtml(classInfo)}
        </p>
      </div>
    </section>
  `
}

// 統計サマリー
function generateStatsSummary(
  report: IndividualReportData,
  options: IndividualReportOptions,
  fontScale: number
): string {
  const items: { label: string; value: string }[] = []

  if (options.showScore) {
    items.push({
      label: "得点",
      value: `${report.scoringData.totalScore} / ${report.scoringData.totalMaxScore}`,
    })
  }

  if (options.showAverage !== "none") {
    if (options.showAverage === "class" || options.showAverage === "both") {
      items.push({
        label: "学級平均",
        value: report.statistics.class.average.toFixed(1),
      })
    }
    if (options.showAverage === "overall" || options.showAverage === "both") {
      items.push({
        label: "全体平均",
        value: report.statistics.overall.average.toFixed(1),
      })
    }
  }

  if (options.showDeviation) {
    items.push({
      label: "偏差値",
      value: report.statistics.personal.deviation.toFixed(1),
    })
  }

  if (options.showRank) {
    if (options.rankType === "class" || options.rankType === "both") {
      items.push({
        label: "学級順位",
        value: `${report.statistics.personal.classRank} / ${report.statistics.class.total}`,
      })
    }
    if (options.rankType === "overall" || options.rankType === "both") {
      items.push({
        label: "全体順位",
        value: `${report.statistics.personal.overallRank} / ${report.statistics.overall.total}`,
      })
    }
  }

  if (items.length === 0) return ""

  const itemsHtml = items
    .map(
      (item) => `
    <div style="
      flex: 1;
      padding: 3mm 2mm;
      background-color: #f0f7ff;
      border-radius: 2mm;
      text-align: center;
    ">
      <p style="font-size: ${10 * fontScale}px; color: #666; margin: 0;">
        ${escapeHtml(item.label)}
      </p>
      <p style="font-size: ${16 * fontScale}px; font-weight: bold; margin: 1mm 0 0 0;">
        ${escapeHtml(item.value)}
      </p>
    </div>
  `
    )
    .join("")

  return `
    <section style="
      display: flex;
      gap: 3mm;
      margin-bottom: 6mm;
    ">
      ${itemsHtml}
    </section>
  `
}

// 小計点テーブル（SubtotalTablePreview.tsxと同じロジック）
function generateSubtotalTable(
  report: IndividualReportData,
  options: IndividualReportOptions,
  fontScale: number
): string {
  let subtotalScores = report.scoringData.subtotalScores

  // フィルタリング
  if (
    options.tableSubtotalGroupSelection?.enabled &&
    options.tableSubtotalGroupSelection.selectedGroupIds.length > 0
  ) {
    subtotalScores = subtotalScores.filter((score) =>
      options.tableSubtotalGroupSelection!.selectedGroupIds.includes(
        score.subtotalGroupId
      )
    )
  }

  if (options.hideUnassignedSubtotals) {
    subtotalScores = subtotalScores.filter(
      (score) => score.hasQuestionAssignments
    )
  }

  if (subtotalScores.length === 0) return ""

  const baseFontSize = options.subtotalTableFontSize || 10

  // グループごとにグルーピング
  interface GroupedSubtotals {
    groupId: string
    groupName: string
    items: typeof subtotalScores
    totalScore: number
    totalMaxScore: number
  }

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

  const groups = Array.from(groupMap.values())
  const columns = options.subtotalTableColumns || 1
  const isHorizontalLayout = columns >= groups.length

  // ドント方式で列数を各グループに配分
  const allocateColumnsDHondt = (
    grps: GroupedSubtotals[],
    totalColumns: number
  ): Map<string, number> => {
    const allocation = new Map<string, number>()
    if (grps.length === 0) return allocation
    for (const group of grps) {
      allocation.set(group.groupId, 1)
    }
    if (grps.length >= totalColumns) {
      return allocation
    }
    let remainingColumns = totalColumns - grps.length
    while (remainingColumns > 0) {
      let maxQuotient = -1
      let maxGroupId = ""
      for (const group of grps) {
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

  // アイテムを指定列数に分割（縦方向に埋める）
  const splitItemsIntoColumns = <T>(items: T[], columnCount: number): T[][] => {
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

  // 各グループのテーブルデータを構築
  interface GroupTableData {
    groupId: string
    groupName: string
    allocatedColumns: number
    columnItems: (typeof subtotalScores)[]
    maxRows: number
    totalScore: number
    totalMaxScore: number
  }

  let groupTableDataList: GroupTableData[]
  if (isHorizontalLayout) {
    const allocation = allocateColumnsDHondt(groups, columns)
    groupTableDataList = groups.map((group) => {
      const allocatedColumns = allocation.get(group.groupId) || 1
      const columnItems = splitItemsIntoColumns(group.items, allocatedColumns)
      const maxRows = Math.max(...columnItems.map((col) => col.length), 0)
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
    groupTableDataList = groups.map((group) => {
      const columnItems = splitItemsIntoColumns(group.items, columns)
      const maxRows = Math.max(...columnItems.map((col) => col.length), 0)
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

  const totalAllocatedColumns = isHorizontalLayout
    ? groupTableDataList.reduce((sum, g) => sum + g.allocatedColumns, 0)
    : 1

  // HTMLを生成
  const groupsHtml = groupTableDataList
    .map((groupData, groupIndex) => {
      const groupWidth = isHorizontalLayout
        ? `${(groupData.allocatedColumns / totalAllocatedColumns) * 100}%`
        : "100%"
      const colWidthPercent = 100 / groupData.allocatedColumns
      const labelWidthPercent = colWidthPercent * 0.6
      const scoreWidthPercent = colWidthPercent * 0.4

      // colgroup
      const colgroupHtml = Array.from({ length: groupData.allocatedColumns })
        .map(
          () =>
            `<col style="width: ${labelWidthPercent}%"/><col style="width: ${scoreWidthPercent}%"/>`
        )
        .join("")

      // 行を生成
      const rowsHtml = Array.from({ length: groupData.maxRows })
        .map((_, rowIndex) => {
          const isAlt = rowIndex % 2 === 1
          const bgColor = isAlt ? "#fafafa" : "transparent"
          const cellsHtml = groupData.columnItems
            .map((colItems) => {
              const item = colItems[rowIndex]
              if (!item) {
                return `<td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0;"></td><td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0;"></td>`
              }
              const shortLabel =
                item.subtotalLabel.length > 10
                  ? item.subtotalLabel.substring(0, 10) + "…"
                  : item.subtotalLabel
              return `
                <td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0; text-align: left;">${escapeHtml(shortLabel)}</td>
                <td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0; text-align: center;">
                  ${item.score}<span style="font-size: ${baseFontSize * 0.8}px; color: #666;"> / ${item.maxScore}</span>
                </td>
              `
            })
            .join("")
          return `<tr style="background-color: ${bgColor};">${cellsHtml}</tr>`
        })
        .join("")

      const subtotalRow = options.showGroupSubtotals
        ? `
        <tr>
          <td colspan="${groupData.allocatedColumns * 2 - 1}" style="padding: 1.5mm 2mm; background-color: #f0f7ff; font-weight: bold; text-align: right;">計</td>
          <td style="padding: 1.5mm 2mm; background-color: #f0f7ff; font-weight: bold; text-align: center;">
            ${groupData.totalScore}<span style="font-size: ${baseFontSize * 0.8}px; color: #666;"> / ${groupData.totalMaxScore}</span>
          </td>
        </tr>
      `
        : ""

      return `
        <div style="width: ${groupWidth}; ${!isHorizontalLayout && groupIndex < groupTableDataList.length - 1 ? "margin-bottom: 4mm;" : ""}">
          <table style="width: 100%; border-collapse: collapse; font-size: ${baseFontSize}px; table-layout: fixed;">
            <colgroup>${colgroupHtml}</colgroup>
            <thead>
              <tr>
                <th colspan="${groupData.allocatedColumns * 2}" style="padding: 1.5mm 2mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center;">
                  ${escapeHtml(groupData.groupName)}
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              ${subtotalRow}
            </tbody>
          </table>
        </div>
      `
    })
    .join("")

  return `
    <section style="margin-bottom: 6mm;">
      <h2 style="
        font-size: ${14 * fontScale}px;
        font-weight: bold;
        margin-bottom: 4mm;
        padding-bottom: 2mm;
        border-bottom: 1px solid #ddd;
      ">
        小計別得点
      </h2>
      <div style="display: ${isHorizontalLayout ? "flex" : "block"}; gap: ${isHorizontalLayout ? "2mm" : "0"};">
        ${groupsHtml}
      </div>
    </section>
  `
}

// 箱ひげ図（SVG）
function generateBoxPlot(
  report: IndividualReportData,
  options: IndividualReportOptions,
  fontScale: number
): string {
  // 受験状態フィルタに基づいて統計を再計算（BoxPlotChartと同じロジック）
  const includeStatuses =
    options.boxPlotIncludeStatuses || DEFAULT_INCLUDE_STATUSES
  const computedStats = computeSubtotalStats(
    report.statistics.subtotalRawScores || [],
    report.statistics.subtotalStatistics,
    includeStatuses
  )

  let subtotalStats = computedStats

  // グループ選択でフィルタリング
  if (
    options.boxPlotSubtotalGroupSelection?.enabled &&
    options.boxPlotSubtotalGroupSelection.selectedGroupIds.length > 0
  ) {
    subtotalStats = subtotalStats.filter(
      (s) =>
        !s.subtotalGroupId ||
        options.boxPlotSubtotalGroupSelection!.selectedGroupIds.includes(
          s.subtotalGroupId
        )
    )
  }

  // 未割当小計を非表示
  if (options.hideUnassignedSubtotals) {
    const assignedSubtotalIds = new Set(
      report.scoringData.subtotalScores
        .filter((s) => s.hasQuestionAssignments)
        .map((s) => s.subtotalId)
    )
    subtotalStats = subtotalStats.filter((s) =>
      assignedSubtotalIds.has(s.subtotalId)
    )
  }

  if (subtotalStats.length === 0) return ""

  const graphOptions = options.graphOptions

  // チャート設定（BoxPlotChartと同じロジック）
  const boxPlotFontSize = graphOptions.boxPlotFontSize ?? 11
  const boxPlotItemSpacing = graphOptions.boxPlotItemHeight ?? 20
  const boxHeight = boxPlotFontSize * 1.8
  const rowHeight = boxHeight + boxPlotItemSpacing

  const chartWidth = 500
  const legendHeight = 20 // 凡例用の高さ
  const chartHeight = 40 + subtotalStats.length * rowHeight + legendHeight
  const marginLeft = 100
  const marginRight = 60
  const marginTop = 30
  const plotWidth = chartWidth - marginLeft - marginRight

  const getStudentScore = (subtotalId: string): number => {
    const subtotal = report.scoringData.subtotalScores.find(
      (s) => s.subtotalId === subtotalId
    )
    return subtotal?.score ?? 0
  }

  const plotsHtml = subtotalStats
    .map((stat, index) => {
      const y = marginTop + index * rowHeight
      const boxPlot = stat.boxPlot
      const maxScore =
        report.scoringData.subtotalScores.find(
          (s) => s.subtotalId === stat.subtotalId
        )?.maxScore || 100

      const toPercent = (score: number) => (score / maxScore) * 100
      const toX = (percent: number) => marginLeft + (percent / 100) * plotWidth

      const minX = toX(toPercent(boxPlot.min))
      const q1X = toX(toPercent(boxPlot.q1))
      const medianX = toX(toPercent(boxPlot.median))
      const q3X = toX(toPercent(boxPlot.q3))
      const maxX = toX(toPercent(boxPlot.max))
      const averageX = toX(toPercent(stat.average))
      const studentScore = getStudentScore(stat.subtotalId)
      const studentX = toX(toPercent(studentScore))
      const markerRadius = Math.max(4, boxHeight / 4)

      const truncatedLabel =
        stat.subtotalLabel.length > 12
          ? stat.subtotalLabel.substring(0, 12) + "..."
          : stat.subtotalLabel

      let svg = `<text x="${marginLeft - 8}" y="${y + boxHeight / 2 + 4}" font-size="${boxPlotFontSize * fontScale}" fill="#333" text-anchor="end">${escapeHtml(truncatedLabel)}</text>`

      // ひげと箱
      if (graphOptions.showBoxPlotMin && graphOptions.showBoxPlotQ1) {
        svg += `<line x1="${minX}" y1="${y + boxHeight / 2}" x2="${q1X}" y2="${y + boxHeight / 2}" stroke="#666" stroke-width="1"/>`
        svg += `<line x1="${minX}" y1="${y + 4}" x2="${minX}" y2="${y + boxHeight - 4}" stroke="#666" stroke-width="1"/>`
      }
      if (graphOptions.showBoxPlotQ1 && graphOptions.showBoxPlotQ3) {
        svg += `<rect x="${q1X}" y="${y}" width="${Math.max(q3X - q1X, 1)}" height="${boxHeight}" fill="#e0e7ff" stroke="#6366f1"/>`
      }
      if (graphOptions.showBoxPlotMedian) {
        svg += `<line x1="${medianX}" y1="${y}" x2="${medianX}" y2="${y + boxHeight}" stroke="#4f46e5" stroke-width="2"/>`
      }
      if (graphOptions.showBoxPlotMax && graphOptions.showBoxPlotQ3) {
        svg += `<line x1="${q3X}" y1="${y + boxHeight / 2}" x2="${maxX}" y2="${y + boxHeight / 2}" stroke="#666" stroke-width="1"/>`
        svg += `<line x1="${maxX}" y1="${y + 4}" x2="${maxX}" y2="${y + boxHeight - 4}" stroke="#666" stroke-width="1"/>`
      }
      if (graphOptions.showAverageLine) {
        svg += `<line x1="${averageX}" y1="${y - 2}" x2="${averageX}" y2="${y + boxHeight + 2}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 2"/>`
      }
      if (graphOptions.showStudentMarker) {
        svg += `<circle cx="${studentX}" cy="${y + boxHeight / 2}" r="${markerRadius}" fill="#ef4444" stroke="#fff" stroke-width="2"/>`
        svg += `<text x="${chartWidth - 10}" y="${y + boxHeight / 2 + 4}" font-size="${(boxPlotFontSize - 1) * fontScale}" fill="#333" text-anchor="end">${studentScore}点</text>`
      }

      return `<g>${svg}</g>`
    })
    .join("")

  // 凡例を生成（BoxPlotChartと同じロジック）
  const legendY = chartHeight - 8
  let legendHtml = `<g transform="translate(${marginLeft}, ${legendY})">`
  let xOffset = 0

  // 範囲ラベルを動的に生成
  const getRangeLabel = (): string | null => {
    if (
      graphOptions.showBoxPlotQ1 &&
      graphOptions.showBoxPlotMedian &&
      graphOptions.showBoxPlotQ3
    )
      return "Q1-Q3範囲"
    if (
      graphOptions.showBoxPlotQ1 &&
      graphOptions.showBoxPlotMedian &&
      !graphOptions.showBoxPlotQ3
    )
      return "Q1-中央値範囲"
    if (
      !graphOptions.showBoxPlotQ1 &&
      graphOptions.showBoxPlotMedian &&
      graphOptions.showBoxPlotQ3
    )
      return "中央値-Q3範囲"
    if (
      graphOptions.showBoxPlotQ1 &&
      !graphOptions.showBoxPlotMedian &&
      graphOptions.showBoxPlotQ3
    )
      return "Q1-Q3範囲"
    return null
  }
  const rangeLabel = getRangeLabel()

  const legendFontSize = (boxPlotFontSize - 2) * fontScale

  if (graphOptions.showStudentMarker) {
    legendHtml += `
      <g transform="translate(${xOffset}, 0)">
        <circle cx="0" cy="0" r="4" fill="#ef4444"/>
        <text x="8" y="4" font-size="${legendFontSize}" fill="#666">あなたの得点</text>
      </g>
    `
    xOffset += 80
  }

  if (rangeLabel) {
    legendHtml += `
      <g transform="translate(${xOffset}, 0)">
        <rect x="0" y="-6" width="12" height="12" fill="#e0e7ff" stroke="#6366f1"/>
        <text x="16" y="4" font-size="${legendFontSize}" fill="#666">${rangeLabel}</text>
      </g>
    `
    xOffset += 80
  }

  if (graphOptions.showBoxPlotMedian) {
    legendHtml += `
      <g transform="translate(${xOffset}, 0)">
        <line x1="0" y1="0" x2="10" y2="0" stroke="#4f46e5" stroke-width="2"/>
        <text x="14" y="4" font-size="${legendFontSize}" fill="#666">中央値</text>
      </g>
    `
    xOffset += 60
  }

  if (graphOptions.showAverageLine) {
    legendHtml += `
      <g transform="translate(${xOffset}, 0)">
        <line x1="0" y1="0" x2="15" y2="0" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3 2"/>
        <text x="19" y="4" font-size="${legendFontSize}" fill="#666">平均</text>
      </g>
    `
  }

  legendHtml += `</g>`

  return `
    <section style="margin-bottom: 6mm;">
      <h2 style="
        font-size: ${14 * fontScale}px;
        font-weight: bold;
        margin-bottom: 4mm;
        padding-bottom: 2mm;
        border-bottom: 1px solid #ddd;
      ">
        小計別分布
      </h2>
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: auto;">
        <text x="${marginLeft}" y="15" font-size="${10 * fontScale}" fill="#666" text-anchor="start">0%</text>
        <text x="${marginLeft + plotWidth / 2}" y="15" font-size="${10 * fontScale}" fill="#666" text-anchor="middle">50%</text>
        <text x="${marginLeft + plotWidth}" y="15" font-size="${10 * fontScale}" fill="#666" text-anchor="end">100%</text>
        <line x1="${marginLeft}" y1="${marginTop}" x2="${marginLeft}" y2="${chartHeight - legendHeight - 10}" stroke="#e0e0e0" stroke-width="1"/>
        <line x1="${marginLeft + plotWidth / 2}" y1="${marginTop}" x2="${marginLeft + plotWidth / 2}" y2="${chartHeight - legendHeight - 10}" stroke="#e0e0e0" stroke-width="1" stroke-dasharray="4 4"/>
        <line x1="${marginLeft + plotWidth}" y1="${marginTop}" x2="${marginLeft + plotWidth}" y2="${chartHeight - legendHeight - 10}" stroke="#e0e0e0" stroke-width="1"/>
        ${plotsHtml}
        ${legendHtml}
      </svg>
    </section>
  `
}

// 設問テーブル（ScoreTablePreview.tsxと同じロジック）
function generateQuestionTable(
  report: IndividualReportData,
  options: IndividualReportOptions,
  fontScale: number
): string {
  const data = report.scoringData.scores
  if (data.length === 0) return ""

  const columns = options.questionTableColumns || 1
  const baseFontSize = options.questionTableFontSize || 10
  const tableFontScale = fontScale * (baseFontSize / 11)

  // マーク情報を取得
  const getMarkInfo = (status: string): { mark: string; markColor: string } => {
    switch (status) {
      case "correct":
        return { mark: "○", markColor: "#16a34a" }
      case "incorrect":
        return { mark: "×", markColor: "#dc2626" }
      case "partial":
        return { mark: "△", markColor: "#ca8a04" }
      case "no_answer":
        return { mark: "-", markColor: "#666" }
      default:
        return { mark: "", markColor: "#333" }
    }
  }

  // 1列表示の場合
  if (columns === 1) {
    const rowsHtml = data
      .map((item, index) => {
        const isAlt = index % 2 === 1
        const bgColor = isAlt ? "#fafafa" : "transparent"
        const { mark, markColor } = getMarkInfo(item.status)
        const correctRate =
          report.statistics.questionCorrectRates[item.questionId] ?? 0

        return `
          <tr style="background-color: ${bgColor};">
            <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: left;">
              ${escapeHtml(item.questionLabel.length > 30 ? item.questionLabel.substring(0, 30) + "..." : item.questionLabel)}
            </td>
            <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: center;">
              ${item.score ?? "-"}<span style="font-size: ${baseFontSize * 0.8}px; color: #666;"> / ${item.maxScore}</span>
            </td>
            ${
              options.showMarks
                ? `
              <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: center; color: ${markColor}; font-weight: bold;">
                ${mark}
              </td>
            `
                : ""
            }
            ${
              options.showCorrectRate
                ? `
              <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: center;">
                ${Math.round(correctRate)}%
              </td>
            `
                : ""
            }
          </tr>
        `
      })
      .join("")

    const totalRow = `
      <tr style="background-color: #e8f4fd; font-weight: bold;">
        <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: left; font-weight: bold;">合計</td>
        <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold;">
          ${report.scoringData.totalScore}<span style="font-size: ${baseFontSize * 0.8}px; color: #666;"> / ${report.scoringData.totalMaxScore}</span>
        </td>
        ${options.showMarks ? `<td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: center;">-</td>` : ""}
        ${
          options.showCorrectRate
            ? `
          <td style="padding: 2mm 3mm; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold;">
            ${Math.round((report.scoringData.totalScore / report.scoringData.totalMaxScore) * 100)}%
          </td>
        `
            : ""
        }
      </tr>
    `

    return `
      <section style="margin-bottom: 6mm;">
        <h2 style="font-size: ${14 * fontScale}px; font-weight: bold; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 1px solid #ddd;">
          設問別得点
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: ${baseFontSize}px;">
          <thead>
            <tr>
              <th style="padding: 2mm 3mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: left; width: 45%;">設問</th>
              <th style="padding: 2mm 3mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center; width: 25%;">得点</th>
              ${options.showMarks ? `<th style="padding: 2mm 3mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center; width: 10%;">評価</th>` : ""}
              ${options.showCorrectRate ? `<th style="padding: 2mm 3mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center; width: 15%;">正答率</th>` : ""}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${totalRow}
          </tbody>
        </table>
      </section>
    `
  }

  // 複数列表示の場合
  const rowsPerColumn = Math.ceil(data.length / columns)
  const columnData: (typeof data)[] = []
  for (let i = 0; i < columns; i++) {
    const start = i * rowsPerColumn
    const end = Math.min(start + rowsPerColumn, data.length)
    columnData.push(data.slice(start, end))
  }

  const multiFontSize = 10 * tableFontScale
  const columnWidth = `${100 / columns}%`

  const columnsHtml = columnData
    .map((colData) => {
      const rowsHtml = colData
        .map((item, index) => {
          const isAlt = index % 2 === 1
          const bgColor = isAlt ? "#fafafa" : "transparent"
          const { mark, markColor } = getMarkInfo(item.status)
          const shortLabel =
            item.questionLabel.length > 8
              ? item.questionLabel.substring(0, 8) + "…"
              : item.questionLabel

          return `
            <tr style="background-color: ${bgColor};">
              <td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 0;" title="${escapeHtml(item.questionLabel)}">
                ${escapeHtml(shortLabel)}
              </td>
              <td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0; text-align: center;">
                ${item.score ?? "-"}<span style="font-size: ${multiFontSize * 0.8}px; color: #666;"> / ${item.maxScore}</span>
              </td>
              ${
                options.showMarks
                  ? `
                <td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0; text-align: center; color: ${markColor}; font-weight: bold;">
                  ${mark}
                </td>
              `
                  : ""
              }
              ${
                options.showCorrectRate
                  ? `
                <td style="padding: 1.5mm 2mm; border-bottom: 1px solid #e0e0e0; text-align: center;">
                  ${Math.round(report.statistics.questionCorrectRates[item.questionId] ?? 0)}%
                </td>
              `
                  : ""
              }
            </tr>
          `
        })
        .join("")

      return `
        <div style="width: ${columnWidth};">
          <table style="width: 100%; border-collapse: collapse; font-size: ${multiFontSize}px;">
            <thead>
              <tr>
                <th style="padding: 1.5mm 2mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: left; width: 45%;">設問</th>
                <th style="padding: 1.5mm 2mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center; width: 30%;">得点</th>
                ${options.showMarks ? `<th style="padding: 1.5mm 2mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center; width: 10%;">○×</th>` : ""}
                ${options.showCorrectRate ? `<th style="padding: 1.5mm 2mm; background-color: #f5f5f5; font-weight: bold; border-bottom: 2px solid #ccc; text-align: center; width: 15%;">正答率</th>` : ""}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `
    })
    .join("")

  // 合計行
  const totalRowHtml = `
    <div style="margin-top: 2mm; padding: 2mm 3mm; background-color: #e8f4fd; border-radius: 2mm; display: flex; justify-content: space-between; font-size: ${11 * fontScale}px; font-weight: bold;">
      <span>合計</span>
      <span>
        ${report.scoringData.totalScore}<span style="font-size: ${11 * fontScale * 0.8}px; color: #666;"> / ${report.scoringData.totalMaxScore}</span>
        (${Math.round((report.scoringData.totalScore / report.scoringData.totalMaxScore) * 100)}%)
      </span>
    </div>
  `

  return `
    <section style="margin-bottom: 6mm;">
      <h2 style="font-size: ${14 * fontScale}px; font-weight: bold; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 1px solid #ddd;">
        設問別得点
      </h2>
      <div style="display: flex; gap: 2mm;">
        ${columnsHtml}
      </div>
      ${totalRowHtml}
    </section>
  `
}

// 学習アドバイス
function generateLearningAdvice(
  advice: ReturnType<typeof calculateLearningAdvice>,
  options: AdviceOptions,
  fontScale: number
): string {
  if (advice.reviewQuestions.length === 0) return ""

  const conditionParts: string[] = []
  if (options.reviewRateMin !== null && options.reviewRateMax !== null) {
    conditionParts.push(
      `正答率${options.reviewRateMin}%〜${options.reviewRateMax}%`
    )
  } else if (options.reviewRateMin !== null) {
    conditionParts.push(`正答率${options.reviewRateMin}%以上`)
  } else if (options.reviewRateMax !== null) {
    conditionParts.push(`正答率${options.reviewRateMax}%以下`)
  }
  if (options.reviewQuestionCount !== null) {
    conditionParts.push(`上位${options.reviewQuestionCount}問`)
  }
  const conditionText =
    conditionParts.length > 0 ? `（${conditionParts.join("・")}）` : ""

  const questionsHtml = advice.reviewQuestions
    .map(
      (q, i) =>
        `${i > 0 ? "、" : ""}<strong>${escapeHtml(q.label)}</strong><span style="font-size: ${10 * fontScale}px; color: #a16207;">（正答率${Math.round(q.correctRate)}%）</span>`
    )
    .join("")

  return `
    <section style="margin-bottom: 6mm;">
      <h2 style="
        font-size: ${14 * fontScale}px;
        font-weight: bold;
        margin-bottom: 4mm;
        padding-bottom: 2mm;
        border-bottom: 1px solid #ddd;
      ">
        学習アドバイス
      </h2>
      <div style="
        padding: 3mm 4mm;
        background-color: #fef3c7;
        border-radius: 2mm;
        border-left: 3px solid #f59e0b;
      ">
        <p style="font-size: ${12 * fontScale}px; font-weight: bold; margin: 0 0 2mm 0; color: #92400e;">
          復習しよう！${conditionText}
        </p>
        <p style="font-size: ${11 * fontScale}px; margin: 0; color: #78350f;">
          ${questionsHtml}
        </p>
      </div>
    </section>
  `
}

// コメント欄
function generateCommentSection(fontScale: number): string {
  return `
    <section style="
      margin-top: 6mm;
      padding: 4mm;
      border: 1px solid #ccc;
      border-radius: 2mm;
    ">
      <p style="font-size: ${11 * fontScale}px; font-weight: bold; margin: 0 0 2mm 0;">
        コメント:
      </p>
      <div style="min-height: 20mm; border-bottom: 1px dotted #ccc;"></div>
    </section>
  `
}

// 署名欄
function generateSignatureSection(fontScale: number): string {
  return `
    <section style="
      display: flex;
      justify-content: flex-end;
      gap: 10mm;
      margin-top: 6mm;
    ">
      <div style="text-align: center;">
        <p style="font-size: ${10 * fontScale}px; margin: 0 0 2mm 0;">保護者印</p>
        <div style="width: 20mm; height: 20mm; border: 1px solid #ccc; border-radius: 2mm;"></div>
      </div>
      <div style="text-align: center;">
        <p style="font-size: ${10 * fontScale}px; margin: 0 0 2mm 0;">担任印</p>
        <div style="width: 20mm; height: 20mm; border: 1px solid #ccc; border-radius: 2mm;"></div>
      </div>
    </section>
  `
}

// ユーティリティ
function formatDate(date: Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// ============================================================
// 箱ひげ図統計計算用ヘルパー関数（BoxPlotChart.tsxと同じロジック）
// ============================================================

interface BoxPlotData {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

interface ComputedSubtotalStat {
  subtotalId: string
  subtotalLabel: string
  subtotalGroupId: string
  boxPlot: BoxPlotData
  average: number
  maxScore: number
}

const DEFAULT_INCLUDE_STATUSES: BoxPlotIncludeStatuses = {
  participating: true,
  expected: true,
  absent: true,
}

function calculateMedian(sortedValues: number[]): number {
  const n = sortedValues.length
  if (n === 0) return 0
  if (n === 1) return sortedValues[0]

  const mid = Math.floor(n / 2)
  if (n % 2 === 0) {
    return (sortedValues[mid - 1] + sortedValues[mid]) / 2
  } else {
    return sortedValues[mid]
  }
}

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function calculateBoxPlotData(values: number[]): BoxPlotData {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  const min = sorted[0]
  const max = sorted[n - 1]
  const median = calculateMedian(sorted)

  const midIndex = Math.floor(n / 2)
  const lowerHalf = sorted.slice(0, midIndex)
  const upperHalf = sorted.slice(n % 2 === 0 ? midIndex : midIndex + 1)

  const q1 = calculateMedian(lowerHalf)
  const q3 = calculateMedian(upperHalf)

  return { min, q1, median, q3, max }
}

function computeSubtotalStats(
  rawScores: SubtotalRawScores[],
  subtotalStatistics: StatisticsData["subtotalStatistics"],
  includeStatuses: BoxPlotIncludeStatuses
): ComputedSubtotalStat[] {
  const includeAll =
    includeStatuses.participating &&
    includeStatuses.expected &&
    includeStatuses.absent

  return subtotalStatistics.map((stat) => {
    const rawData = rawScores.find((r) => r.subtotalId === stat.subtotalId)

    if (!rawData || includeAll) {
      return {
        subtotalId: stat.subtotalId,
        subtotalLabel: stat.subtotalLabel,
        subtotalGroupId: stat.subtotalGroupId,
        boxPlot: stat.boxPlot,
        average: stat.average,
        maxScore: stat.maxScore,
      }
    }

    const filteredScores = rawData.scores
      .filter((s) => {
        if (s.status === "participating") return includeStatuses.participating
        if (s.status === "expected") return includeStatuses.expected
        if (s.status === "absent") return includeStatuses.absent
        return true
      })
      .map((s) => s.score)

    if (filteredScores.length === 0) {
      return {
        subtotalId: stat.subtotalId,
        subtotalLabel: stat.subtotalLabel,
        subtotalGroupId: stat.subtotalGroupId,
        boxPlot: { min: 0, q1: 0, median: 0, q3: 0, max: 0 },
        average: 0,
        maxScore: stat.maxScore,
      }
    }

    return {
      subtotalId: stat.subtotalId,
      subtotalLabel: stat.subtotalLabel,
      subtotalGroupId: stat.subtotalGroupId,
      boxPlot: calculateBoxPlotData(filteredScores),
      average: calculateAverage(filteredScores),
      maxScore: stat.maxScore,
    }
  })
}
