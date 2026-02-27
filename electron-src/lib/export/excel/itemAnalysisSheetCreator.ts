import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"

import type { ScoringData } from "../../shared/types/exportTypes"
import {
  applyCellStyle,
  autoFitColumns,
} from "../../shared/utilities/excelUtilities"
import {
  calculateDiscriminationIndices,
  calculateQuestionCorrectRates,
  calculateQuestionScoreRates,
  getDiscriminationLevel,
} from "../individual-report/statisticsCalculator"

const DISCRIMINATION_LABEL: Record<string, string> = {
  good: "良好",
  acceptable: "許容",
  marginal: "要確認",
  poor: "低い",
  negative: "要検討",
  insufficient: "---",
}

const DISCRIMINATION_COLOR: Record<string, string> = {
  good: "FF92D050",
  acceptable: "FF5B9BD5",
  marginal: "FFFFEB9C",
  poor: "FFFF6B6B",
  negative: "FFCC3333",
  insufficient: "FFC0C0C0",
}

/**
 * 問題分析シートを作成する
 */
export async function createItemAnalysisSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("問題分析")

  // 統計データ計算
  const correctRates = calculateQuestionCorrectRates(scoringData)
  const scoreRates = calculateQuestionScoreRates(scoringData)
  const discriminationIndices = calculateDiscriminationIndices(scoringData)

  // ヘッダー行
  const headers = ["設問", "配点", "正答率(%)", "得点率(%)", "識別係数", "判定"]
  const headerRow = worksheet.addRow(headers)
  headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

  // データ行
  let correctRateSum = 0
  let scoreRateSum = 0
  let discrimSum = 0
  let discrimCount = 0

  for (const region of questionRegions) {
    const qId = region.id
    const label = region.label || `問${(region.orderIndex ?? 0) + 1}`
    const maxScore = region.points ?? 0
    const cr = correctRates[qId] ?? 0
    const sr = scoreRates[qId] ?? 0
    const di = discriminationIndices[qId] ?? null
    const level = getDiscriminationLevel(di)

    correctRateSum += cr
    scoreRateSum += sr
    if (di !== null) {
      discrimSum += di
      discrimCount++
    }

    const row = worksheet.addRow([
      label,
      maxScore,
      Math.round(cr * 10) / 10,
      Math.round(sr * 10) / 10,
      di !== null ? Math.round(di * 1000) / 1000 : "---",
      DISCRIMINATION_LABEL[level],
    ])

    row.eachCell((cell, colNumber) => {
      applyCellStyle(cell, "data")
      if (colNumber === 6) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: DISCRIMINATION_COLOR[level] },
        }
        if (level === "negative" || level === "poor") {
          cell.font = { ...cell.font, color: { argb: "FFFFFFFF" } }
        }
      }
    })
  }

  // サマリー行
  const questionCount = questionRegions.length
  if (questionCount > 0) {
    const avgCorrectRate =
      Math.round((correctRateSum / questionCount) * 10) / 10
    const avgScoreRate = Math.round((scoreRateSum / questionCount) * 10) / 10
    const avgDiscrim =
      discrimCount > 0
        ? Math.round((discrimSum / discrimCount) * 1000) / 1000
        : "---"

    const summaryRow = worksheet.addRow([
      "平均",
      "",
      avgCorrectRate,
      avgScoreRate,
      avgDiscrim,
      "",
    ])
    summaryRow.eachCell((cell) => applyCellStyle(cell, "total"))
  }

  autoFitColumns(worksheet)

  return worksheet
}
