/**
 * 個人成績表Canvas描画ユーティリティ
 */

import type {
  IndividualReportData,
  IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"
import { drawBarChart, drawBoxPlot, drawRadarChart } from "./chart-renderers"
import type { BarChartData, ChartConfig, RadarChartData } from "./chart-renderers"

/** レポート描画設定 */
export interface ReportRenderConfig {
  // ページサイズ（ピクセル）
  pageWidth: number
  pageHeight: number
  // 余白
  margin: { top: number; right: number; bottom: number; left: number }
  // フォントサイズ
  fontSize: {
    title: number
    header: number
    body: number
    small: number
  }
  // 色設定
  colors: {
    primary: string
    secondary: string
    correct: string
    incorrect: string
    partial: string
    text: string
    border: string
    background: string
  }
}

/** デフォルト設定（A4 @144dpi） */
export const DEFAULT_RENDER_CONFIG: ReportRenderConfig = {
  pageWidth: 1190,  // A4 width @ 144dpi
  pageHeight: 1684, // A4 height @ 144dpi
  margin: { top: 60, right: 60, bottom: 60, left: 60 },
  fontSize: { title: 28, header: 18, body: 14, small: 12 },
  colors: {
    primary: "#2563eb",
    secondary: "#7c3aed",
    correct: "#22c55e",
    incorrect: "#ef4444",
    partial: "#f59e0b",
    text: "#1f2937",
    border: "#d1d5db",
    background: "#ffffff",
  },
}

/**
 * 個人成績表を Canvas に描画
 */
export async function renderIndividualReportToCanvas(
  canvas: HTMLCanvasElement,
  reportData: IndividualReportData,
  options: IndividualReportOptions,
  config: ReportRenderConfig = DEFAULT_RENDER_CONFIG,
): Promise<Blob> {
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas context not available")

  canvas.width = config.pageWidth
  canvas.height = config.pageHeight

  // 背景を白に
  ctx.fillStyle = config.colors.background
  ctx.fillRect(0, 0, config.pageWidth, config.pageHeight)

  let currentY = config.margin.top
  const contentWidth = config.pageWidth - config.margin.left - config.margin.right

  // 1. ヘッダー描画
  currentY = drawReportHeader(ctx, reportData, config, currentY, contentWidth)

  // 2. 生徒情報・統計情報
  currentY = drawStudentInfo(ctx, reportData, options, config, currentY, contentWidth)

  // 3. スコアテーブル
  currentY = drawScoreTable(ctx, reportData, options, config, currentY, contentWidth)

  // 4. グラフ（オプション）
  if (options.showGraph) {
    currentY = drawCharts(ctx, reportData, options, config, currentY, contentWidth)
  }

  // 5. 学習アドバイス（オプション）
  if (options.showLearningAdvice) {
    currentY = drawLearningAdvice(ctx, reportData, config, currentY, contentWidth)
  }

  // 6. コメント欄（オプション）
  if (options.showComment) {
    currentY = drawCommentSection(ctx, config, currentY, contentWidth)
  }

  // 7. 署名欄（オプション）
  if (options.showSignature) {
    drawSignatureSection(ctx, config, currentY, contentWidth)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create blob"))),
      "image/png",
      1.0,
    )
  })
}

/** ヘッダー（試験名・日付）を描画 */
function drawReportHeader(
  ctx: CanvasRenderingContext2D,
  reportData: IndividualReportData,
  config: ReportRenderConfig,
  startY: number,
  contentWidth: number,
): number {
  const { margin, fontSize, colors } = config
  let y = startY

  // 試験名（中央寄せ）
  ctx.fillStyle = colors.text
  ctx.font = `bold ${fontSize.title}px sans-serif`
  ctx.textAlign = "center"
  ctx.fillText(
    reportData.examInfo.examName,
    margin.left + contentWidth / 2,
    y + fontSize.title,
  )
  y += fontSize.title + 10

  // 実施日・教科
  ctx.font = `${fontSize.body}px sans-serif`
  const dateStr = reportData.examInfo.examDate
    ? new Date(reportData.examInfo.examDate).toLocaleDateString("ja-JP")
    : ""
  const subjectStr = reportData.examInfo.subject || ""
  const subInfo = [dateStr, subjectStr].filter(Boolean).join(" | ")
  ctx.fillText(subInfo, margin.left + contentWidth / 2, y + fontSize.body)
  y += fontSize.body + 20

  // 区切り線
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(margin.left, y)
  ctx.lineTo(margin.left + contentWidth, y)
  ctx.stroke()
  y += 20

  return y
}

/** 生徒情報・統計情報を描画 */
function drawStudentInfo(
  ctx: CanvasRenderingContext2D,
  reportData: IndividualReportData,
  options: IndividualReportOptions,
  config: ReportRenderConfig,
  startY: number,
  contentWidth: number,
): number {
  const { margin, fontSize, colors } = config
  let y = startY

  ctx.textAlign = "left"
  ctx.font = `bold ${fontSize.header}px sans-serif`
  ctx.fillStyle = colors.text

  // 氏名
  ctx.fillText(reportData.studentInfo.fullName, margin.left, y + fontSize.header)

  // 学籍番号・学級情報
  ctx.font = `${fontSize.body}px sans-serif`
  const classInfo = [
    reportData.studentInfo.grade ? `${reportData.studentInfo.grade}年` : "",
    reportData.studentInfo.className ? `${reportData.studentInfo.className}` : "",
    reportData.studentInfo.attendanceNumber
      ? `${reportData.studentInfo.attendanceNumber}番`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
  ctx.fillText(classInfo, margin.left + 250, y + fontSize.header)

  // 統計情報（右側）
  if (options.showDeviation || options.showRank) {
    ctx.textAlign = "right"
    const stats: string[] = []

    if (options.showDeviation) {
      stats.push(`偏差値: ${reportData.statistics.personal.deviation}`)
    }

    if (options.showRank) {
      const { rankType } = options
      if (rankType === "class" || rankType === "both") {
        stats.push(
          `学級順位: ${reportData.statistics.personal.classRank}/${reportData.statistics.class.total}位`,
        )
      }
      if (rankType === "overall" || rankType === "both") {
        stats.push(
          `全体順位: ${reportData.statistics.personal.overallRank}/${reportData.statistics.overall.total}位`,
        )
      }
    }

    ctx.fillText(stats.join("  "), margin.left + contentWidth, y + fontSize.header)
  }

  y += fontSize.header + 20

  return y
}

/** スコアテーブルを描画 */
function drawScoreTable(
  ctx: CanvasRenderingContext2D,
  reportData: IndividualReportData,
  options: IndividualReportOptions,
  config: ReportRenderConfig,
  startY: number,
  contentWidth: number,
): number {
  const { margin, fontSize, colors } = config
  let y = startY

  const isDetailMode = options.displayMode === "detail"
  const data = isDetailMode
    ? reportData.scoringData.scores
    : reportData.scoringData.subtotalScores

  if (data.length === 0) return y

  // テーブル設定
  const rowHeight = 24
  const colWidths: { label: number; maxScore: number; score: number; mark?: number; rate: number } =
    isDetailMode
      ? { label: 150, maxScore: 60, score: 60, mark: 50, rate: 60 }
      : { label: 200, maxScore: 80, score: 80, rate: 80 }

  // ヘッダー
  ctx.fillStyle = "#f3f4f6"
  ctx.fillRect(margin.left, y, contentWidth, rowHeight)
  ctx.strokeStyle = colors.border
  ctx.strokeRect(margin.left, y, contentWidth, rowHeight)

  ctx.fillStyle = colors.text
  ctx.font = `bold ${fontSize.small}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  let colX = margin.left
  ctx.fillText("設問", colX + colWidths.label / 2, y + rowHeight / 2)
  colX += colWidths.label
  ctx.fillText("配点", colX + colWidths.maxScore / 2, y + rowHeight / 2)
  colX += colWidths.maxScore
  ctx.fillText("得点", colX + colWidths.score / 2, y + rowHeight / 2)
  colX += colWidths.score
  if (isDetailMode && options.showMarks && colWidths.mark) {
    ctx.fillText("評価", colX + colWidths.mark / 2, y + rowHeight / 2)
    colX += colWidths.mark
  }
  ctx.fillText("正答率", colX + colWidths.rate / 2, y + rowHeight / 2)

  y += rowHeight

  // データ行
  ctx.font = `${fontSize.small}px sans-serif`

  const maxRows = Math.min(data.length, 20) // 1ページに最大20行

  for (let i = 0; i < maxRows; i++) {
    const item = data[i]
    const isEven = i % 2 === 0

    if (isEven) {
      ctx.fillStyle = "#fafafa"
      ctx.fillRect(margin.left, y, contentWidth, rowHeight)
    }
    ctx.strokeStyle = colors.border
    ctx.strokeRect(margin.left, y, contentWidth, rowHeight)

    ctx.fillStyle = colors.text
    colX = margin.left

    // ラベル
    const label = isDetailMode
      ? (item as typeof reportData.scoringData.scores[0]).questionLabel
      : (item as typeof reportData.scoringData.subtotalScores[0]).subtotalLabel
    ctx.textAlign = "left"
    ctx.fillText(
      label.length > 15 ? label.substring(0, 15) + "..." : label,
      colX + 8,
      y + rowHeight / 2,
    )
    colX += colWidths.label

    // 配点
    ctx.textAlign = "center"
    const maxScore = isDetailMode
      ? (item as typeof reportData.scoringData.scores[0]).maxScore
      : (item as typeof reportData.scoringData.subtotalScores[0]).maxScore
    ctx.fillText(String(maxScore), colX + colWidths.maxScore / 2, y + rowHeight / 2)
    colX += colWidths.maxScore

    // 得点
    const score = isDetailMode
      ? (item as typeof reportData.scoringData.scores[0]).score ?? "-"
      : (item as typeof reportData.scoringData.subtotalScores[0]).score
    ctx.fillText(String(score), colX + colWidths.score / 2, y + rowHeight / 2)
    colX += colWidths.score

    // 評価マーク（設問詳細モードのみ）
    if (isDetailMode && options.showMarks) {
      const status = (item as typeof reportData.scoringData.scores[0]).status
      let mark = ""
      let markColor = colors.text
      switch (status) {
        case "correct":
          mark = "○"
          markColor = colors.correct
          break
        case "incorrect":
          mark = "×"
          markColor = colors.incorrect
          break
        case "partial":
          mark = "△"
          markColor = colors.partial
          break
        case "no_answer":
          mark = "-"
          break
        default:
          mark = ""
      }
      ctx.fillStyle = markColor
      ctx.font = `bold ${fontSize.body}px sans-serif`
      ctx.fillText(mark, colX + (colWidths.mark ?? 50) / 2, y + rowHeight / 2)
      ctx.fillStyle = colors.text
      ctx.font = `${fontSize.small}px sans-serif`
      colX += colWidths.mark ?? 50
    }

    // 正答率
    if (isDetailMode) {
      const questionId = (item as typeof reportData.scoringData.scores[0]).questionId
      const rate = reportData.statistics.questionCorrectRates[questionId] ?? 0
      ctx.fillText(`${Math.round(rate)}%`, colX + colWidths.rate / 2, y + rowHeight / 2)
    }

    y += rowHeight
  }

  // 合計行
  ctx.fillStyle = "#e0e7ff"
  ctx.fillRect(margin.left, y, contentWidth, rowHeight)
  ctx.strokeRect(margin.left, y, contentWidth, rowHeight)

  ctx.fillStyle = colors.text
  ctx.font = `bold ${fontSize.small}px sans-serif`
  colX = margin.left
  ctx.textAlign = "left"
  ctx.fillText("合計", colX + 8, y + rowHeight / 2)
  colX += colWidths.label
  ctx.textAlign = "center"
  ctx.fillText(
    String(reportData.scoringData.totalMaxScore),
    colX + colWidths.maxScore / 2,
    y + rowHeight / 2,
  )
  colX += colWidths.maxScore
  ctx.fillText(
    String(reportData.scoringData.totalScore),
    colX + colWidths.score / 2,
    y + rowHeight / 2,
  )

  y += rowHeight + 20

  return y
}

/** グラフを描画 */
function drawCharts(
  ctx: CanvasRenderingContext2D,
  reportData: IndividualReportData,
  options: IndividualReportOptions,
  config: ReportRenderConfig,
  startY: number,
  _contentWidth: number,
): number {
  const { margin, colors } = config
  let y = startY

  const chartConfig: ChartConfig = {
    width: 280,
    height: 200,
    padding: 30,
    colors: {
      primary: colors.primary,
      secondary: colors.secondary,
      average: "#f59e0b",
      background: "#fafafa",
      border: colors.border,
      text: colors.text,
    },
    fontSize: 12,
  }

  // 小計データからグラフ用データを生成
  const chartData: BarChartData[] = reportData.scoringData.subtotalScores.map((st) => {
    const stats = reportData.statistics.subtotalStatistics.find(
      (s) => s.subtotalId === st.subtotalRegionId,
    )
    return {
      label: st.subtotalLabel,
      value: st.score,
      maxValue: st.maxScore,
      average: stats?.average,
    }
  })

  const radarData: RadarChartData[] = chartData.map((d) => ({
    label: d.label,
    value: d.value,
    maxValue: d.maxValue,
    average: d.average,
  }))

  let chartX = margin.left

  // 棒グラフ
  if (options.graphOptions.showBarChart && chartData.length > 0) {
    drawBarChart(
      ctx,
      chartData,
      chartX,
      y,
      chartConfig,
      options.graphOptions.showAverageLine,
    )
    chartX += chartConfig.width + 20
  }

  // レーダーチャート
  if (options.graphOptions.showRadarChart && radarData.length >= 3) {
    drawRadarChart(
      ctx,
      radarData,
      chartX,
      y,
      chartConfig,
      options.graphOptions.showAverageLine,
    )
    chartX += chartConfig.width + 20
  }

  // 箱ひげ図
  if (options.graphOptions.showBoxPlot) {
    const boxConfig = { ...chartConfig, width: 300 }
    drawBoxPlot(
      ctx,
      reportData.statistics.overall.boxPlot,
      reportData.scoringData.totalScore,
      reportData.scoringData.totalMaxScore,
      chartX,
      y,
      boxConfig,
    )
  }

  y += chartConfig.height + 20

  return y
}

/** 学習アドバイスを描画 */
function drawLearningAdvice(
  ctx: CanvasRenderingContext2D,
  reportData: IndividualReportData,
  config: ReportRenderConfig,
  startY: number,
  _contentWidth: number,
): number {
  const { margin, fontSize, colors } = config
  let y = startY

  const { differentiatingQuestions, mustReviewQuestions } = reportData.learningAdvice

  if (differentiatingQuestions.length === 0 && mustReviewQuestions.length === 0) {
    return y
  }

  ctx.font = `bold ${fontSize.header}px sans-serif`
  ctx.fillStyle = colors.text
  ctx.textAlign = "left"
  ctx.fillText("学習アドバイス", margin.left, y + fontSize.header)
  y += fontSize.header + 10

  // 差がつく問題
  if (differentiatingQuestions.length > 0) {
    ctx.font = `${fontSize.body}px sans-serif`
    ctx.fillStyle = colors.primary
    const labels = differentiatingQuestions.map((q) => q.label).join(", ")
    ctx.fillText(`差がつく問題: ${labels}`, margin.left, y + fontSize.body)
    y += fontSize.body + 8
  }

  // 必ず復習問題
  if (mustReviewQuestions.length > 0) {
    ctx.font = `${fontSize.body}px sans-serif`
    ctx.fillStyle = colors.incorrect
    const labels = mustReviewQuestions.map((q) => q.label).join(", ")
    ctx.fillText(`必ず復習: ${labels}`, margin.left, y + fontSize.body)
    y += fontSize.body + 8
  }

  y += 15

  return y
}

/** コメント欄を描画 */
function drawCommentSection(
  ctx: CanvasRenderingContext2D,
  config: ReportRenderConfig,
  startY: number,
  contentWidth: number,
): number {
  const { margin, fontSize, colors } = config
  let y = startY

  ctx.font = `${fontSize.body}px sans-serif`
  ctx.fillStyle = colors.text
  ctx.textAlign = "left"
  ctx.fillText("コメント:", margin.left, y + fontSize.body)
  y += fontSize.body + 10

  // 空白欄（3行分）
  ctx.strokeStyle = colors.border
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(margin.left, y + 20)
    ctx.lineTo(margin.left + contentWidth, y + 20)
    ctx.stroke()
    y += 25
  }

  y += 10

  return y
}

/** 署名欄を描画 */
function drawSignatureSection(
  ctx: CanvasRenderingContext2D,
  config: ReportRenderConfig,
  startY: number,
  contentWidth: number,
): void {
  const { margin, fontSize, colors } = config
  let y = startY

  ctx.font = `${fontSize.body}px sans-serif`
  ctx.fillStyle = colors.text
  ctx.textAlign = "left"

  const boxSize = 50
  const boxGap = 100

  // 保護者印
  ctx.fillText("保護者印", margin.left + contentWidth / 2 - boxGap - boxSize - 20, y + fontSize.body)
  ctx.strokeStyle = colors.border
  ctx.strokeRect(
    margin.left + contentWidth / 2 - boxGap - boxSize,
    y + fontSize.body + 5,
    boxSize,
    boxSize,
  )

  // 担任印
  ctx.fillText("担任印", margin.left + contentWidth / 2 + boxGap - 50, y + fontSize.body)
  ctx.strokeRect(
    margin.left + contentWidth / 2 + boxGap,
    y + fontSize.body + 5,
    boxSize,
    boxSize,
  )
}
