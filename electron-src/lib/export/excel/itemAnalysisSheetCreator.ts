import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"

import {
  computeItemAnalysis,
  type ItemAnalysisInputStudent,
} from "../../shared/calculations/itemAnalysis"
import type {
  DiscriminationLevel,
  ScoringData,
} from "../../shared/types/exportTypes"
import {
  applyCellStyle,
  autoFitColumns,
} from "../../shared/utilities/excelUtilities"

const DISCRIMINATION_LABEL: Record<DiscriminationLevel, string> = {
  good: "良好",
  acceptable: "許容",
  marginal: "要確認",
  poor: "低い",
  negative: "要検討",
  insufficient: "---",
}

const DISCRIMINATION_COLOR: Record<DiscriminationLevel, string> = {
  good: "FF92D050",
  acceptable: "FF5B9BD5",
  marginal: "FFFFEB9C",
  poor: "FFFF6B6B",
  negative: "FFCC3333",
  insufficient: "FFC0C0C0",
}

/** 判定帯で着色する（負・低は白文字） */
function colorByLevel(cell: ExcelJS.Cell, level: DiscriminationLevel): void {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: DISCRIMINATION_COLOR[level] },
  }
  if (level === "negative" || level === "poor") {
    cell.font = { ...cell.font, color: { argb: "FFFFFFFF" } }
  }
}

/** ScoringData を項目分析入力へ正規化（設問の並び・ラベル・配点は CropRegion 基準） */
function toItemAnalysisInput(
  questionRegions: CropRegion[],
  scoringData: ScoringData[]
): ItemAnalysisInputStudent[] {
  return scoringData.map((sd) => {
    const byId = new Map(sd.scores.map((s) => [s.questionId, s]))
    return {
      items: questionRegions.map((region) => {
        const s = byId.get(region.id)
        return {
          questionId: region.id,
          label: region.label || `問${(region.orderIndex ?? 0) + 1}`,
          maxScore: region.points ?? 0,
          score: s?.score ?? null,
          isCorrect: s?.status === "correct",
        }
      }),
    }
  })
}

/**
 * 問題分析シートを作成する
 * 設問別の正答率・得点率・識別係数（点双列相関）・D値（得点率差）と、テスト全体のα係数を出力。
 * 識別係数・D値は各セルを判定帯で着色する（単一の「判定」列は持たない）。
 */
export async function createItemAnalysisSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("問題分析")

  const analysis = computeItemAnalysis(
    toItemAnalysisInput(questionRegions, scoringData)
  )

  if (!analysis) {
    const row = worksheet.addRow(["問題分析を作成できる採点データがありません"])
    applyCellStyle(row.getCell(1), "data")
    return worksheet
  }

  // テスト全体の信頼性係数（クロンバックα）をシート上部に1値表示
  const alphaRow = worksheet.addRow([
    "クロンバックα係数",
    analysis.cronbachAlpha !== null
      ? Math.round(analysis.cronbachAlpha * 1000) / 1000
      : "判定不可",
  ])
  alphaRow.eachCell((cell) => applyCellStyle(cell, "total"))
  worksheet.addRow([]) // 区切りの空行

  // ヘッダー行
  const headers = ["設問", "配点", "正答率(%)", "得点率(%)", "識別係数", "D値"]
  const headerRow = worksheet.addRow(headers)
  headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

  let correctRateSum = 0
  let scoreRateSum = 0
  let discrimSum = 0
  let discrimCount = 0
  let dValueSum = 0
  let dValueCount = 0

  for (const item of analysis.items) {
    correctRateSum += item.correctRate
    scoreRateSum += item.scoreRate
    if (item.discriminationIndex !== null) {
      discrimSum += item.discriminationIndex
      discrimCount++
    }
    if (item.dValue !== null) {
      dValueSum += item.dValue
      dValueCount++
    }

    const row = worksheet.addRow([
      item.label,
      item.maxScore,
      Math.round(item.correctRate * 10) / 10,
      Math.round(item.scoreRate * 10) / 10,
      item.discriminationIndex !== null
        ? Math.round(item.discriminationIndex * 1000) / 1000
        : "---",
      item.dValue !== null ? Math.round(item.dValue * 1000) / 1000 : "---",
    ])

    row.eachCell((cell, colNumber) => {
      applyCellStyle(cell, "data")
      // 5列目=識別係数、6列目=D値 を各々の判定帯で着色
      if (colNumber === 5) colorByLevel(cell, item.discriminationLevel)
      if (colNumber === 6) colorByLevel(cell, item.dValueLevel)
    })
  }

  // サマリー行
  const questionCount = analysis.items.length
  if (questionCount > 0) {
    const avgDiscrim =
      discrimCount > 0
        ? Math.round((discrimSum / discrimCount) * 1000) / 1000
        : "---"
    const avgDValue =
      dValueCount > 0
        ? Math.round((dValueSum / dValueCount) * 1000) / 1000
        : "---"

    const summaryRow = worksheet.addRow([
      "平均",
      "",
      Math.round((correctRateSum / questionCount) * 10) / 10,
      Math.round((scoreRateSum / questionCount) * 10) / 10,
      avgDiscrim,
      avgDValue,
    ])
    summaryRow.eachCell((cell) => applyCellStyle(cell, "total"))
  }

  // 判定帯の凡例
  worksheet.addRow([])
  const legendRow = worksheet.addRow([
    `判定（識別係数・D値の着色）: ${DISCRIMINATION_LABEL.good}≥0.4 / ${DISCRIMINATION_LABEL.acceptable}≥0.3 / ${DISCRIMINATION_LABEL.marginal}≥0.2 / ${DISCRIMINATION_LABEL.poor}<0.2 / ${DISCRIMINATION_LABEL.negative}<0`,
  ])
  applyCellStyle(legendRow.getCell(1), "data")

  autoFitColumns(worksheet)

  return worksheet
}
