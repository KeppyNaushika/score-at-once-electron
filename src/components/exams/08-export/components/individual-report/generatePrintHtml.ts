/**
 * 個人成績表の印刷用HTMLを生成
 * renderToStaticMarkupを使い、プレビュー用Reactコンポーネントを再利用してHTML化
 */
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/electron-src/lib/export/individual-report/types"

import { calculateLearningAdvice } from "../../utils/learningAdviceCalculator"
import { BoxPlotChartView } from "./BoxPlotChart"
import {
  allocateColumnsDHondt,
  buildStatsItems,
  computeFilteredClassroomStats,
  computeFilteredOverallStat,
  computeFilteredStats,
  computeFilteredSubtotalStats,
  filterSubtotalScores,
  getVisibleSectionIndices,
  groupSubtotalData,
  isTotalScoreStat,
  selectStudentClassrooms,
  splitItemsIntoColumns,
} from "./computeReportData"
import { LearningAdvicePreview } from "./LearningAdvicePreview"
import {
  CommentSectionView,
  HeaderView,
  SignatureSectionView,
  StatsSummaryView,
  StudentInfoView,
} from "./ReportSectionViews"
import { ScoreTablePreview } from "./ScoreTablePreview"
import { SubtotalTableView } from "./SubtotalTablePreview"

/** ページ振り分け情報 */
export interface PageAllocation {
  pageIndex: number
  sectionIndices: number[]
}

/**
 * 複数の個人成績表を結合した印刷用HTMLを生成
 */
export function generatePrintHtml(
  reports: IndividualReportData[],
  population: ReportPopulation,
  options: IndividualReportOptions,
  reportsPageAllocations?: PageAllocation[][]
): string {
  const fontScale = 1
  const visibleSectionIndices = getVisibleSectionIndices(options)

  const reportsHtml = reports
    .map((report, reportIndex) => {
      const pageAllocations = reportsPageAllocations?.[reportIndex]
      const isLastReport = reportIndex === reports.length - 1

      const reportHtml = generateSingleReportHtml(
        report,
        population,
        options,
        fontScale,
        visibleSectionIndices,
        pageAllocations
      )

      return `<div class="student-report${isLastReport ? "" : " page-break-after"}">${reportHtml}</div>`
    })
    .join("")

  return `<!DOCTYPE html>
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
</html>`
}

/**
 * 単一レポートの印刷用HTMLを生成
 */
function generateSingleReportHtml(
  report: IndividualReportData,
  population: ReportPopulation,
  options: IndividualReportOptions,
  fontScale: number,
  visibleSectionIndices: number[],
  pageAllocations?: PageAllocation[]
): string {
  // 各ページの先頭セクションを特定
  const pageStartSections = new Set<number>()
  if (pageAllocations && pageAllocations.length > 1) {
    pageAllocations.forEach((page, pageIdx) => {
      if (pageIdx > 0 && page.sectionIndices.length > 0) {
        pageStartSections.add(page.sectionIndices[0])
      }
    })
  }

  // 各セクションのReact要素を生成
  const sectionsHtml = visibleSectionIndices
    .map((sectionIndex) => {
      const sectionElement = renderSectionElement(
        sectionIndex,
        report,
        population,
        options,
        fontScale
      )
      if (!sectionElement) return ""

      const html = renderToStaticMarkup(sectionElement)
      const pageBreak = pageStartSections.has(sectionIndex)
        ? "page-break-before"
        : ""

      return `<div class="report-section ${pageBreak}">${html}</div>`
    })
    .join("")

  return `<div class="individual-report-page" style="width:200mm;min-height:287mm;padding:0;background-color:white;font-family:'Noto Sans JP','Hiragino Sans',sans-serif;font-size:${12 * fontScale}px;line-height:1.5;color:#1a1a1a;box-sizing:border-box;">${sectionsHtml}</div>`
}

/**
 * セクションのReact要素を生成（renderToStaticMarkup用）
 */
function renderSectionElement(
  index: number,
  report: IndividualReportData,
  population: ReportPopulation,
  options: IndividualReportOptions,
  fontScale: number
): React.ReactElement | null {
  switch (index) {
    case 0:
      return React.createElement(HeaderView, { report, fontScale })

    case 1:
      return React.createElement(StudentInfoView, { report, fontScale })

    case 2: {
      const filteredStats = computeFilteredStats(
        population,
        report.scoringData,
        options.boxPlotIncludeStatuses
      )
      const items = buildStatsItems(report, filteredStats, options)
      if (items.length === 0) return null
      return React.createElement(StatsSummaryView, { items, fontScale })
    }

    case 3: {
      // 小計点テーブル
      const subtotalScores = filterSubtotalScores(
        report.scoringData.subtotalScores,
        options.tableSubtotalGroupSelection,
        options.hideUnassignedSubtotals
      )
      if (subtotalScores.length === 0) return null

      const groupedData = groupSubtotalData(subtotalScores)
      const columns = options.subtotalTableColumns || 1
      const isHorizontalLayout = columns >= groupedData.length
      const baseFontSize = options.subtotalTableFontSize || 10

      const groupTableDataList = groupedData.map((group) => {
        const allocatedColumns = isHorizontalLayout
          ? allocateColumnsDHondt(groupedData, columns).get(group.groupId) || 1
          : columns
        const columnItems = splitItemsIntoColumns(group.items, allocatedColumns)
        const maxRows = Math.max(
          ...columnItems.map((column) => column.length),
          0
        )
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

      const totalAllocatedColumns = isHorizontalLayout
        ? groupTableDataList.reduce(
            (sum, groupData) => sum + groupData.allocatedColumns,
            0
          )
        : 1

      return React.createElement(SubtotalTableView, {
        groupTableDataList,
        isHorizontalLayout,
        totalAllocatedColumns,
        fontScale,
        baseFontSize,
        showGroupSubtotals: options.showGroupSubtotals,
      })
    }

    case 4: {
      // 箱ひげ図
      const includeStatuses = options.boxPlotIncludeStatuses || {
        participating: true,
        expected: true,
        absent: true,
      }
      const computedStats = computeFilteredSubtotalStats(
        population.subtotalRawScores,
        population.subtotals,
        includeStatuses
      )

      let subtotalStats = computedStats

      if (
        options.boxPlotSubtotalGroupSelection?.enabled &&
        options.boxPlotSubtotalGroupSelection.selectedGroupIds.length > 0
      ) {
        subtotalStats = subtotalStats.filter(
          (subtotalStat) =>
            !subtotalStat.subtotalGroupId ||
            options.boxPlotSubtotalGroupSelection!.selectedGroupIds.includes(
              subtotalStat.subtotalGroupId
            )
        )
      }

      if (options.hideUnassignedSubtotals) {
        const assignedSubtotalIds = new Set(
          report.scoringData.subtotalScores
            .filter((subtotalScore) => subtotalScore.hasQuestionAssignments)
            .map((subtotalScore) => subtotalScore.subtotalId)
        )
        subtotalStats = subtotalStats.filter((subtotalStat) =>
          assignedSubtotalIds.has(subtotalStat.subtotalId)
        )
      }

      const graphOptions = options.graphOptions

      // 合計点を合成
      type ComputedStat = (typeof subtotalStats)[number]
      const allStats: ComputedStat[] = []

      if (graphOptions.showTotalScoreBoxPlot) {
        allStats.push(
          computeFilteredOverallStat(
            population.rawTotalScores,
            report.scoringData.totalMaxScore,
            includeStatuses
          )
        )
      }

      // 所属学級ごとの合計点（複数学級対応）
      if (options.statistics.boxPlot.classroom) {
        allStats.push(
          ...computeFilteredClassroomStats(
            population.rawTotalScores,
            selectStudentClassrooms(
              population.classrooms,
              report.scoringData.studentId
            ),
            report.scoringData.totalMaxScore,
            includeStatuses
          )
        )
      }

      allStats.push(...subtotalStats)

      if (allStats.length === 0) return null

      const getStudentScore = (id: string): number => {
        if (isTotalScoreStat(id)) {
          return report.scoringData.totalScore ?? 0
        }
        const subtotal = report.scoringData.subtotalScores.find(
          (subtotalScore) => subtotalScore.subtotalId === id
        )
        return subtotal?.score ?? 0
      }

      // セクションヘッダーと箱ひげ図をまとめる
      return React.createElement(
        "section",
        { style: { marginBottom: "6mm" } },
        React.createElement(
          "h2",
          {
            style: {
              fontSize: `${14 * fontScale}px`,
              fontWeight: "bold",
              marginBottom: "4mm",
              paddingBottom: "2mm",
              borderBottom: "1px solid #ddd",
            },
          },
          "得点分布"
        ),
        React.createElement(BoxPlotChartView, {
          subtotalStats: allStats,
          getStudentScore,
          fontScale,
          showMin: graphOptions.showBoxPlotMin,
          showQ1: graphOptions.showBoxPlotQ1,
          showMedian: graphOptions.showBoxPlotMedian,
          showQ3: graphOptions.showBoxPlotQ3,
          showMax: graphOptions.showBoxPlotMax,
          showAverageLine: graphOptions.showAverageLine,
          showStudentMarker: graphOptions.showStudentMarker,
          boxPlotFontSize: graphOptions.boxPlotFontSize ?? 11,
          boxPlotItemHeight: graphOptions.boxPlotItemHeight ?? 20,
        })
      )
    }

    case 5:
      // 設問テーブル（既にhooks不使用）
      return React.createElement(ScoreTablePreview, {
        report,
        population,
        options,
        fontScale,
      })

    case 6: {
      // 学習アドバイス（既にhooks不使用）
      const learningAdvice = calculateLearningAdvice(
        report.scoringData.scores,
        population.questionCorrectRates,
        options.adviceOptions
      )
      return React.createElement(LearningAdvicePreview, {
        advice: learningAdvice,
        options: options.adviceOptions,
        fontScale,
      })
    }

    case 7:
      return React.createElement(CommentSectionView, { fontScale })

    case 8:
      return React.createElement(SignatureSectionView, { fontScale })

    default:
      return null
  }
}
