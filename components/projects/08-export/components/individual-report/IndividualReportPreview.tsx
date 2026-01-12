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
import { LearningAdvicePreview } from "./LearningAdvicePreview"
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
  /** プレビュー表示用のスケール（0.5 = 50%縮小） */
  scale?: number
  /** 追加のクラス名 */
  className?: string
  /** 改ページプレビューを表示するか */
  showPageBreaks?: boolean
  /** ページ振り分けが計算されたときのコールバック */
  onPagesCalculated?: (pages: PageAllocation[]) => void
}

/**
 * A4サイズの個人成績表プレビュー
 */
export function IndividualReportPreview({
  report,
  options,
  scale = 1,
  className,
  showPageBreaks = true,
  onPagesCalculated,
}: IndividualReportPreviewProps) {
  // フォントサイズのスケール（オプションに基づく）
  const fontScale = getFontScale(options)

  // 各セクションのref
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([])
  const [pages, setPages] = useState<PageAllocation[]>([
    { pageIndex: 0, sectionIndices: [] },
  ])
  const [measured, setMeasured] = useState(false)

  // mm to px変換（96dpi基準: 1mm ≈ 3.7795px）
  const mmToPx = useCallback((mm: number) => mm * 3.7795275591, [])

  // 学習アドバイスを動的に計算
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

  // 表示されるセクションのインデックスリストを計算
  const visibleSectionIndices = useMemo(() => {
    const indices: number[] = [0, 1, 2] // ヘッダー、生徒情報、統計サマリーは常に表示
    if (options.showSubtotalTable) indices.push(3)
    if (options.graphOptions.showBoxPlot) indices.push(4)
    if (options.showQuestionTable) indices.push(5)
    if (options.showLearningAdvice) indices.push(6)
    if (options.showComment) indices.push(7)
    if (options.showSignature) indices.push(8)
    return indices
  }, [options])

  // オプションやレポートが変更されたら再測定のためにリセット
  useEffect(() => {
    setMeasured(false)
  }, [options, report])

  // セクションを測定してページに振り分け
  useEffect(() => {
    // まだ測定用レンダリングが完了していない場合はスキップ
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

      // 表示されるセクションのみを測定
      for (const index of visibleSectionIndices) {
        const ref = sectionRefs.current[index]
        if (!ref) continue

        const sectionHeight = ref.offsetHeight

        // このセクションを現在のページに追加できるか？
        if (currentPageHeight + sectionHeight <= pageHeightPx) {
          // 収まる場合は追加
          currentPage.sectionIndices.push(index)
          currentPageHeight += sectionHeight
        } else {
          // 収まらない場合は新しいページを開始
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

      // 最後のページを追加
      if (currentPage.sectionIndices.length > 0) {
        allocatedPages.push(currentPage)
      }

      const finalPages =
        allocatedPages.length > 0
          ? allocatedPages
          : [{ pageIndex: 0, sectionIndices: [] }]
      setPages(finalPages)
      setMeasured(true)

      // コールバックで通知
      onPagesCalculated?.(finalPages)
    }

    // 少し遅延させてDOMのレンダリング完了を待つ
    const timer = setTimeout(measureAndAllocate, 100)
    return () => clearTimeout(timer)
  }, [
    measured,
    showPageBreaks,
    mmToPx,
    onPagesCalculated,
    visibleSectionIndices,
  ])

  // セクションのref設定ヘルパー
  const setSectionRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      sectionRefs.current[index] = el
    },
    []
  )

  // 全セクションをレンダリング（測定用）
  const renderSection = (index: number) => {
    switch (index) {
      case 0: // ヘッダー
        return (
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "6mm",
              paddingBottom: "4mm",
              borderBottom: "2px solid #333",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: `${18 * fontScale}px`,
                  fontWeight: "bold",
                  margin: 0,
                }}
              >
                {report.examInfo.examName}
              </h1>
              {report.examInfo.subject && (
                <p
                  style={{
                    fontSize: `${12 * fontScale}px`,
                    color: "#666",
                    margin: "2mm 0 0 0",
                  }}
                >
                  {report.examInfo.subject}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              {report.examInfo.examDate && (
                <p
                  style={{
                    fontSize: `${12 * fontScale}px`,
                    color: "#666",
                    margin: 0,
                  }}
                >
                  {formatDate(report.examInfo.examDate)}
                </p>
              )}
              <p
                style={{
                  fontSize: `${14 * fontScale}px`,
                  fontWeight: "bold",
                  margin: "2mm 0 0 0",
                }}
              >
                個人成績表
              </p>
            </div>
          </header>
        )
      case 1: // 生徒情報
        return (
          <section
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6mm",
              padding: "4mm",
              backgroundColor: "#f5f5f5",
              borderRadius: "2mm",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: `${16 * fontScale}px`,
                  fontWeight: "bold",
                  margin: 0,
                }}
              >
                {report.studentInfo.fullName}
              </p>
              <p
                style={{
                  fontSize: `${11 * fontScale}px`,
                  color: "#666",
                  margin: "1mm 0 0 0",
                }}
              >
                {report.studentInfo.studentNumber}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p
                style={{
                  fontSize: `${12 * fontScale}px`,
                  margin: 0,
                }}
              >
                {report.studentInfo.grade && `${report.studentInfo.grade}年`}
                {report.studentInfo.className &&
                  ` ${report.studentInfo.className}`}
                {report.studentInfo.attendanceNumber != null &&
                  ` ${report.studentInfo.attendanceNumber}番`}
              </p>
            </div>
          </section>
        )
      case 2: // 統計サマリー
        return (
          <StatsSummary
            report={report}
            options={options}
            fontScale={fontScale}
          />
        )
      case 3: // 小計点テーブル
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
      case 4: // 箱ひげ図
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
              小計別分布
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
            />
          </section>
        ) : null
      case 5: // 設問テーブル
        return options.showQuestionTable ? (
          <ScoreTablePreview
            report={report}
            options={options}
            fontScale={fontScale}
          />
        ) : null
      case 6: // 学習アドバイス
        return options.showLearningAdvice ? (
          <LearningAdvicePreview
            advice={learningAdvice}
            options={options.adviceOptions}
            fontScale={fontScale}
          />
        ) : null
      case 7: // コメント欄
        return options.showComment ? (
          <section
            style={{
              marginTop: "6mm",
              padding: "4mm",
              border: "1px solid #ccc",
              borderRadius: "2mm",
            }}
          >
            <p
              style={{
                fontSize: `${11 * fontScale}px`,
                fontWeight: "bold",
                margin: "0 0 2mm 0",
              }}
            >
              コメント:
            </p>
            <div
              style={{
                minHeight: "20mm",
                borderBottom: "1px dotted #ccc",
              }}
            />
          </section>
        ) : null
      case 8: // 署名欄
        return options.showSignature ? (
          <section
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10mm",
              marginTop: "6mm",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: `${10 * fontScale}px`,
                  margin: "0 0 2mm 0",
                }}
              >
                保護者印
              </p>
              <div
                style={{
                  width: "20mm",
                  height: "20mm",
                  border: "1px solid #ccc",
                  borderRadius: "2mm",
                }}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: `${10 * fontScale}px`,
                  margin: "0 0 2mm 0",
                }}
              >
                担任印
              </p>
              <div
                style={{
                  width: "20mm",
                  height: "20mm",
                  border: "1px solid #ccc",
                  borderRadius: "2mm",
                }}
              />
            </div>
          </section>
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
            {/* ページ番号表示 */}
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

            {/* セクションをレンダリング */}
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
      {/* 測定用: 表示されるセクションのみを個別のdivでラップ */}
      {visibleSectionIndices.map((index) => (
        <div key={index} ref={setSectionRef(index)}>
          {renderSection(index)}
        </div>
      ))}
    </div>
  )
}

/**
 * 統計サマリーセクション
 */
function StatsSummary({
  report,
  options,
  fontScale,
}: {
  report: IndividualReportData
  options: IndividualReportOptions
  fontScale: number
}) {
  const items: { label: string; value: string }[] = []

  // 得点
  if (options.showScore) {
    items.push({
      label: "得点",
      value: `${report.scoringData.totalScore} / ${report.scoringData.totalMaxScore}`,
    })
  }

  // 平均点
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

  // 偏差値
  if (options.showDeviation) {
    items.push({
      label: "偏差値",
      value: report.statistics.personal.deviation.toFixed(1),
    })
  }

  // 順位
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

  if (items.length === 0) return null

  return (
    <section
      style={{
        display: "flex",
        gap: "3mm",
        marginBottom: "6mm",
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            flex: 1,
            padding: "3mm 2mm",
            backgroundColor: "#f0f7ff",
            borderRadius: "2mm",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: `${10 * fontScale}px`,
              color: "#666",
              margin: 0,
            }}
          >
            {item.label}
          </p>
          <p
            style={{
              fontSize: `${16 * fontScale}px`,
              fontWeight: "bold",
              margin: "1mm 0 0 0",
            }}
          >
            {item.value}
          </p>
        </div>
      ))}
    </section>
  )
}

/**
 * フォントサイズのスケールを取得（将来的にオプションから取得）
 */
function getFontScale(_options: IndividualReportOptions): number {
  // TODO: オプションからフォントサイズ設定を取得
  return 1
}

/**
 * 日付をフォーマット
 */
function formatDate(date: Date | null): string {
  if (!date) return ""
  const d = new Date(date)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}
