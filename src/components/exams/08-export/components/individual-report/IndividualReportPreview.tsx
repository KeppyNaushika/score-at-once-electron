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
} from "@/electron-src/lib/export/individual-report/types"
import { cn } from "@/lib/utils"

import { calculateLearningAdvice } from "../../utils/learningAdviceCalculator"
import { BoxPlotChart } from "./BoxPlotChart"
import {
  buildStatsItems,
  computeFilteredStats,
  getVisibleSectionIndices,
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
import { SubtotalTablePreview } from "./SubtotalTablePreview"

/** A4ページの高さ（mm） */
const A4_HEIGHT_MM = 297
/** ページパディング（上下各5mm） */
const PAGE_PADDING_MM = 5
/** コンテンツエリアの高さ（mm） */
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - PAGE_PADDING_MM * 2

/** ページ振り分け結果 */
export interface PageAllocation {
  pageIndex: number
  sectionIndices: number[]
}

interface IndividualReportPreviewProps {
  report: IndividualReportData
  options: IndividualReportOptions
  scale?: number
  className?: string
  showPageBreaks?: boolean
  onPagesCalculated?: (pages: PageAllocation[]) => void
}

export function IndividualReportPreview({
  report,
  options,
  scale = 1,
  className,
  showPageBreaks = true,
  onPagesCalculated,
}: IndividualReportPreviewProps) {
  const fontScale = 1

  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [pages, setPages] = useState<PageAllocation[]>([
    { pageIndex: 0, sectionIndices: [] },
  ])
  const [measured, setMeasured] = useState(false)

  const mmToPx = useCallback((mm: number) => mm * 3.7795275591, [])

  const learningAdvice = useMemo(() => {
    return calculateLearningAdvice(
      report.scoringData.scores,
      report.statistics.questionCorrectRates,
      options.adviceOptions
    )
  }, [
    report.scoringData.scores,
    report.statistics.questionCorrectRates,
    options.adviceOptions,
  ])

  const visibleSectionIndices = useMemo(
    () => getVisibleSectionIndices(options),
    [options]
  )

  // 統計サマリーの計算
  const filteredStats = useMemo(
    () => computeFilteredStats(report, options.boxPlotIncludeStatuses),
    [report, options.boxPlotIncludeStatuses]
  )

  const statsItems = useMemo(
    () => buildStatsItems(report, filteredStats, options),
    [report, filteredStats, options]
  )

  useEffect(() => {
    setMeasured(false)
  }, [options, report])

  useEffect(() => {
    if (measured) return
    if (!showPageBreaks) {
      setPages([{ pageIndex: 0, sectionIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8] }])
      setMeasured(true)
      return
    }

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
      setPages(finalPages)
      setMeasured(true)
      onPagesCalculated?.(finalPages)
    }

    const timer = setTimeout(measureAndAllocate, 100)
    return () => clearTimeout(timer)
  }, [
    measured,
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
        return options.graphOptions.showBoxPlot ? (
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
              statistics={report.statistics}
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
              showOverallBoxPlot={options.graphOptions.showOverallBoxPlot}
            />
          </section>
        ) : null
      case 5:
        return options.showQuestionTable ? (
          <ScoreTablePreview
            report={report}
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
  if (showPageBreaks && measured) {
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
