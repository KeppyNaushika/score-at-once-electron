import * as ExcelJS from "exceljs"

import { computeFrequencyDistribution } from "../../shared/calculations/spAnalysis"
import type { ScoringData } from "../../shared/types/exportTypes"
import {
  applyCellStyle,
  autoFitColumns,
} from "../../shared/utilities/excelUtilities"

/**
 * 得点度数分布シートを作成する（#838）
 * 合計点を約10階級に等分した度数・割合と、簡易バー、平均・標準偏差を出力。
 */
export async function createFrequencyDistributionSheet(
  workbook: ExcelJS.Workbook,
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("得点度数分布")

  const totalScores = scoringData.map((student) => student.totalScore)
  const maxScore = scoringData[0]?.totalMaxScore ?? 0
  const result = computeFrequencyDistribution(totalScores, maxScore)

  if (!result) {
    const row = worksheet.addRow(["度数分布を作成できる得点データがありません"])
    applyCellStyle(row.getCell(1), "data")
    return worksheet
  }

  // 平均・標準偏差を上部に表示
  const meanRow = worksheet.addRow([
    "平均",
    Math.round(result.mean * 10) / 10,
    "標準偏差",
    Math.round(result.stdDev * 10) / 10,
  ])
  meanRow.eachCell((cell) => applyCellStyle(cell, "total"))
  worksheet.addRow([])

  // ヘッダー
  const headerRow = worksheet.addRow(["得点階級", "度数", "割合(%)", "分布"])
  headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

  const maxCount = Math.max(...result.bins.map((bin) => bin.count), 1)

  for (const bin of result.bins) {
    const ratio = result.count > 0 ? (bin.count / result.count) * 100 : 0
    const barLength = Math.round((bin.count / maxCount) * 20)
    const row = worksheet.addRow([
      bin.label,
      bin.count,
      Math.round(ratio * 10) / 10,
      "■".repeat(barLength),
    ])
    row.eachCell((cell) => applyCellStyle(cell, "data"))
  }

  // 合計
  const totalRow = worksheet.addRow(["合計", result.count, 100, ""])
  totalRow.eachCell((cell) => applyCellStyle(cell, "total"))

  autoFitColumns(worksheet)

  return worksheet
}
