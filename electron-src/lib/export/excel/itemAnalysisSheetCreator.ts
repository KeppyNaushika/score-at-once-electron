import type { CropRegion } from "@prisma/client"
import type * as ExcelJS from "exceljs"

import {
  computeItemAnalysis,
  formatLevelCounts,
  type ItemAnalysisInputStudent,
} from "@/lib/shared/itemAnalysis"
import { toScoringMethod } from "@/types/rubric.types"

import type { DiscriminationLevel, ScoringData } from "../../shared/types"
import {
  applyCellStyle,
  autoFitColumns,
} from "../../shared/utilities/excelUtilities"
import type { ExportScoreScale } from "./dataFetcher"

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

/**
 * ScoringData を項目分析入力へ正規化（設問の並び・ラベル・配点は CropRegion 基準）。
 * 類型評価の設問は、組の類型を全部（並び順）と付けた類型を渡す
 */
function toItemAnalysisInput(
  questionRegions: CropRegion[],
  scoreScales: ExportScoreScale[],
  scoringData: ScoringData[]
): ItemAnalysisInputStudent[] {
  const levelsByScaleId = new Map(
    scoreScales.map((scoreScale) => [scoreScale.id, scoreScale.levels])
  )
  return scoringData.map((student) => {
    const byId = new Map(
      student.scores.map((score) => [score.questionId, score])
    )
    return {
      items: questionRegions.map((region) => {
        const score = byId.get(region.id)
        return {
          questionId: region.id,
          label: region.label || `問${(region.orderIndex ?? 0) + 1}`,
          maxScore: region.points ?? 0,
          score: score?.score ?? null,
          isCorrect: score?.status === "correct",
          scale:
            toScoringMethod(region.scoringMethod) === "scale"
              ? {
                  levels:
                    (region.scoreScaleId !== null
                      ? levelsByScaleId.get(region.scoreScaleId)
                      : undefined) ?? [],
                  scaleLevelId: score?.scaleLevel?.id ?? null,
                }
              : null,
        }
      }),
    }
  })
}

/**
 * 問題分析シートを作成する
 * 設問別の正答率・得点率・識別係数（点双列相関）・D値（得点率差）と、テスト全体のα係数を出力。
 * 識別係数・D値は各セルを判定帯で着色する（単一の「判定」列は持たない）。
 * 類型評価の設問は正答率を出さず（「—」・平均にも入れない）、類型ごとの人数を出す
 * （docs/vlm-grading-design.md §4-8-5）。
 */
export async function createItemAnalysisSheet(
  workbook: ExcelJS.Workbook,
  questionRegions: CropRegion[],
  scoreScales: ExportScoreScale[],
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("問題分析")

  const analysis = computeItemAnalysis(
    toItemAnalysisInput(questionRegions, scoreScales, scoringData)
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
  // 類型評価の設問があるときだけ、類型ごとの人数の列を足す
  const hasScaleQuestion = analysis.items.some(
    (item) => item.levelCounts !== null
  )
  const headers = [
    "設問",
    "配点",
    "正答率(%)",
    "得点率(%)",
    "識別係数",
    "D値",
    ...(hasScaleQuestion ? ["類型の分布（人）"] : []),
  ]
  const headerRow = worksheet.addRow(headers)
  headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

  let correctRateSum = 0
  let correctRateCount = 0
  let scoreRateSum = 0
  let discrimSum = 0
  let discrimCount = 0
  let dValueSum = 0
  let dValueCount = 0

  for (const item of analysis.items) {
    if (item.correctRate !== null) {
      correctRateSum += item.correctRate
      correctRateCount++
    }
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
      item.correctRate !== null ? Math.round(item.correctRate * 10) / 10 : "—",
      Math.round(item.scoreRate * 10) / 10,
      item.discriminationIndex !== null
        ? Math.round(item.discriminationIndex * 1000) / 1000
        : "---",
      item.dValue !== null ? Math.round(item.dValue * 1000) / 1000 : "---",
      ...(hasScaleQuestion
        ? [item.levelCounts !== null ? formatLevelCounts(item.levelCounts) : ""]
        : []),
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
      correctRateCount > 0
        ? Math.round((correctRateSum / correctRateCount) * 10) / 10
        : "—",
      Math.round((scoreRateSum / questionCount) * 10) / 10,
      avgDiscrim,
      avgDValue,
      ...(hasScaleQuestion ? [""] : []),
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
