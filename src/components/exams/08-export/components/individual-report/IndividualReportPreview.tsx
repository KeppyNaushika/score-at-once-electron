"use client"

/**
 * 個人成績表プレビューコンポーネント
 * HTML/CSSベースでWYSIWYGプレビューと印刷に対応
 * 改ページプレビュー対応（実際の印刷レイアウトをシミュレート）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type {
  IndividualReportData,
  IndividualReportOptions,
  ReportPopulation,
} from "@/electron-src/lib/export/individual-report/types"
import { cn } from "@/lib/utils"

import { calculateLearningAdvice } from "../../utils/learningAdviceCalculator"
import { BoxPlotChart } from "./BoxPlotChart"
import {
  buildStatsItems,
  computeFilteredStats,
  getVisibleSectionIndices,
} from "./computeReportData"
import type { PageAllocation } from "./generatePrintHtml"
import { LearningAdvicePreview } from "./LearningAdvicePreview"
import {
  CommentSectionView,
  HeaderView,
  SignatureSectionView,
  StatsSummaryView,
  StudentInfoView,
} from "./ReportSectionViews"
import { ScoreTablePreview } from "./ScoreTablePreview"
import { SubtotalTablePreview } from "./SubtotalTablePreview"

/** A4ページの高さ（mm） */
const A4_HEIGHT_MM = 297
/** ページパディング（上下各5mm） */
const PAGE_PADDING_MM = 5
/** コンテンツエリアの高さ（mm） */
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PAGE_PADDING_MM * 2

interface IndividualReportPreviewProps {
  report: IndividualReportData
  /** 統計の母集団（試験に1つ）。平均・偏差値・順位・箱ひげ図はここから算出する */
  population: ReportPopulation
  options: IndividualReportOptions
  scale?: number
  className?: string
  showPageBreaks?: boolean
  onPagesCalculated?: (pages: PageAllocation[]) => void
}

export function IndividualReportPreview({
  report,
  population,
  options,
  scale = 1,
  className,
  showPageBreaks = true,
  onPagesCalculated,
}: IndividualReportPreviewProps) {
  const fontScale = 1

  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  // 測定結果は「どの入力に対するものか」を一緒に持つ。表示設定や対象生徒が
  // 変われば一致しなくなるので、測り直しのフラグを別に持たなくてよい
  const [measurement, setMeasurement] = useState<{
    report: IndividualReportData
    options: IndividualReportOptions
    pages: PageAllocation[]
  } | null>(null)

  const pages =
    measurement?.report === report && measurement.options === options
      ? measurement.pages
      : null

  const mmToPx = useCallback((mm: number) => mm * 3.7795275591, [])

  const learningAdvice = useMemo(() => {
    return calculateLearningAdvice(
      report.scoringData.scores,
      population.questionCorrectRates,
      options.adviceOptions
    )
  }, [
    report.scoringData.scores,
    population.questionCorrectRates,
    options.adviceOptions,
  ])

  const visibleSectionIndices = useMemo(
    () => getVisibleSectionIndices(options),
    [options]
  )

  // 統計サマリーの計算
  const filteredStats = useMemo(
    () =>
      computeFilteredStats(
        population,
        report.scoringData,
        options.boxPlotIncludeStatuses
      ),
    [population, report.scoringData, options.boxPlotIncludeStatuses]
  )

  const statsItems = useMemo(
    () => buildStatsItems(report, filteredStats, options),
    [report, filteredStats, options]
  )

  useEffect(() => {
    // 改ページを出さないときは1枚に流し込むだけなので測る必要がない
    if (!showPageBreaks || pages) return

    const measureAndAllocate = () => {
      const pageHeightPx = mmToPx(CONTENT_HEIGHT_MM)
      const allocatedPages: PageAllocation[] = []
      let currentPage: PageAllocation = { pageIndex: 0, sectionIndices: [] }
      let currentPageHeight = 0

      for (const index of visibleSectionIndices) {
        const ref = sectionRefs.current[index]
        if (!ref) continue

        const sectionHeight = ref.offsetHeight

        if (currentPageHeight + sectionHeight <= pageHeightPx) {
          currentPage.sectionIndices.push(index)
          currentPageHeight += sectionHeight
        } else {
          if (currentPage.sectionIndices.length > 0) {
            allocatedPages.push(currentPage)
          }
          currentPage = {
            pageIndex: allocatedPages.length,
            sectionIndices: [index],
          }
          currentPageHeight = sectionHeight
        }
      }

      if (currentPage.sectionIndices.length > 0) {
        allocatedPages.push(currentPage)
      }

      const finalPages =
        allocatedPages.length > 0
          ? allocatedPages
          : [{ pageIndex: 0, sectionIndices: [] }]
      setMeasurement({ report, options, pages: finalPages })
      onPagesCalculated?.(finalPages)
    }

    const timer = setTimeout(measureAndAllocate, 100)
    return () => clearTimeout(timer)
  }, [
    pages,
    report,
    options,
    showPageBreaks,
    mmToPx,
    onPagesCalculated,
    visibleSectionIndices,
  ])

  const setSectionRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      sectionRefs.current[index] = el
    },
    []
  )

  const renderSection = (index: number) => {
    switch (index) {
      case 0:
        return <HeaderView report={report} fontScale={fontScale} />
      case 1:
        return <StudentInfoView report={report} fontScale={fontScale} />
      case 2:
        return <StatsSummaryView items={statsItems} fontScale={fontScale} />
      case 3:
        return options.showSubtotalTable ? (
          <SubtotalTablePreview
            report={report}
            fontScale={fontScale}
            subtotalGroupSelection={options.tableSubtotalGroupSelection}
            hideUnassignedSubtotals={options.hideUnassignedSubtotals}
            columns={options.subtotalTableColumns}
            showGroupSubtotals={options.showGroupSubtotals}
            fontSize={options.subtotalTableFontSize}
          />
        ) : null
      case 4:
        return options.statistics.boxPlot.overall ||
          options.statistics.boxPlot.classroom ? (
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
              得点分布
            </h2>
            <BoxPlotChart
              population={population}
              scoringData={report.scoringData}
              fontScale={fontScale}
              showMin={options.graphOptions.showBoxPlotMin}
              showQ1={options.graphOptions.showBoxPlotQ1}
              showMedian={options.graphOptions.showBoxPlotMedian}
              showQ3={options.graphOptions.showBoxPlotQ3}
              showMax={options.graphOptions.showBoxPlotMax}
              showAverageLine={options.graphOptions.showAverageLine}
              showStudentMarker={options.graphOptions.showStudentMarker}
              subtotalGroupSelection={options.boxPlotSubtotalGroupSelection}
              hideUnassignedSubtotals={options.hideUnassignedSubtotals}
              boxPlotIncludeStatuses={options.boxPlotIncludeStatuses}
              boxPlotFontSize={options.graphOptions.boxPlotFontSize}
              boxPlotItemHeight={options.graphOptions.boxPlotItemHeight}
              showTotalScoreBoxPlot={options.graphOptions.showTotalScoreBoxPlot}
              showClassroomBoxPlot={options.statistics.boxPlot.classroom}
            />
          </section>
        ) : null
      case 5:
        return options.showQuestionTable ? (
          <ScoreTablePreview
            report={report}
            population={population}
            options={options}
            fontScale={fontScale}
          />
        ) : null
      case 6:
        return options.showLearningAdvice ? (
          <LearningAdvicePreview
            advice={learningAdvice}
            options={options.adviceOptions}
            fontScale={fontScale}
          />
        ) : null
      case 7:
        return options.showComment ? (
          <CommentSectionView fontScale={fontScale} />
        ) : null
      case 8:
        return options.showSignature ? (
          <SignatureSectionView fontScale={fontScale} />
        ) : null
      default:
        return null
    }
  }

  // ページ分割プレビューモード
  if (showPageBreaks && pages) {
    return (
      <div
        className={cn("individual-report-pages", className)}
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        {pages.map((page, pageIdx) => (
          <div
            key={page.pageIndex}
            style={{
              width: "210mm",
              height: "297mm",
              padding: "5mm",
              backgroundColor: "white",
              fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
              fontSize: `${12 * fontScale}px`,
              lineHeight: 1.5,
              color: "#1a1a1a",
              boxSizing: "border-box",
              position: "relative",
              marginBottom: pageIdx < pages.length - 1 ? "10mm" : 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "2mm",
                right: "4mm",
                fontSize: "10px",
                color: "#999",
                backgroundColor: "#f5f5f5",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {pageIdx + 1} / {pages.length}
            </div>

            {page.sectionIndices.map((sectionIdx) => (
              <div key={sectionIdx}>{renderSection(sectionIdx)}</div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // 測定用の非表示レンダリング（初回のみ）
  return (
    <div
      className={cn("individual-report-page", className)}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "5mm",
        backgroundColor: "white",
        fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
        fontSize: `${12 * fontScale}px`,
        lineHeight: 1.5,
        color: "#1a1a1a",
        boxSizing: "border-box",
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top left",
        position: "relative",
      }}
    >
      {visibleSectionIndices.map((index) => (
        <div key={index} ref={setSectionRef(index)}>
          {renderSection(index)}
        </div>
      ))}
    </div>
  )
}
