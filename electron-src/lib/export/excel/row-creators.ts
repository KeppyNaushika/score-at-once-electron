import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"
import { SubtotalTargetMap } from "../../shared/calculations/subtotal-calculator"
import { ScoringData } from "../../shared/types/export-types"
import {
  applyCellStyle,
  getExcelColumnLetter,
  getStatusSymbol,
} from "../../shared/utilities/excel-utilities"

/**
 * データ行を作成する
 *
 * @param worksheet - 対象のワークシート
 * @param scoringData - 採点データ配列
 * @param subtotalRegions - 小計領域配列
 * @param subtotalTargetMap - 小計対象設問マップ
 * @param isScoreSheet - 点数一覧シートかどうか（true: 点数一覧、false: 正誤一覧）
 */
export async function createDataRows(
  worksheet: ExcelJS.Worksheet,
  scoringData: ScoringData[],
  subtotalRegions: CropRegion[],
  subtotalTargetMap: SubtotalTargetMap,
  isScoreSheet: boolean,
) {
  for (let i = 0; i < scoringData.length; i++) {
    const student = scoringData[i]
    const rowIndex = i + 2 // ヘッダー行を考慮

    const row = worksheet.addRow([
      `=RANK(G${rowIndex},G:G,0)`, // 順位計算
      student.grade || "",
      student.className || "",
      student.attendanceNumber || "",
      student.studentNumber,
      student.studentName,
    ])

    // 合計点の計算（Excel関数使用）
    const questionStartColIndex = 8 + subtotalRegions.length
    const questionEndColIndex =
      questionStartColIndex + student.scores.length - 1
    const questionStartCol = getExcelColumnLetter(questionStartColIndex)
    const questionEndCol = getExcelColumnLetter(questionEndColIndex)
    const totalCell = row.getCell("G")
    totalCell.value = {
      formula: `SUM(${questionStartCol}${rowIndex}:${questionEndCol}${rowIndex})`,
    }
    // 合計点を赤色に設定
    totalCell.font = { color: { argb: "FFFF0000" } }

    // 小計点の設定
    await setSubtotalCells(
      row,
      student,
      subtotalRegions,
      subtotalTargetMap,
      rowIndex,
      isScoreSheet,
    )

    // 設問別データの設定
    setQuestionCells(row, student, subtotalRegions.length, isScoreSheet)

    // 行スタイルの適用
    row.eachCell((cell) => applyCellStyle(cell, "data"))
  }
}

/**
 * 小計点セルを設定する
 *
 * @param row - 対象の行
 * @param student - 生徒の採点データ
 * @param subtotalRegions - 小計領域配列
 * @param subtotalTargetMap - 小計対象設問マップ
 * @param rowIndex - 行インデックス（1ベース）
 * @param isScoreSheet - 点数一覧シートかどうか（true: 点数一覧、false: 正誤一覧）
 */
async function setSubtotalCells(
  row: ExcelJS.Row,
  student: ScoringData,
  subtotalRegions: CropRegion[],
  subtotalTargetMap: SubtotalTargetMap,
  rowIndex: number,
  isScoreSheet: boolean,
) {
  let subtotalColIndex = 8
  const questionStartColIndex = 8 + subtotalRegions.length

  for (let i = 0; i < subtotalRegions.length; i++) {
    const col = getExcelColumnLetter(subtotalColIndex)
    const subtotalScore = student.subtotalScores[i]

    if (subtotalScore) {
      const targetQuestionIndices =
        subtotalTargetMap[subtotalScore.subtotalRegionId] || []

      if (targetQuestionIndices.length > 0) {
        const targetCells = targetQuestionIndices.map((index) => {
          const questionCol = getExcelColumnLetter(
            questionStartColIndex + index,
          )
          return `${questionCol}${rowIndex}`
        })

        if (isScoreSheet) {
          // 点数一覧：対象設問の合計
          const formula = targetCells.join("+")
          row.getCell(col).value = { formula }
        } else {
          // 正誤一覧：対象設問の正答数
          const formula = targetCells
            .map((cell) => `IF(${cell}="○",1,0)`)
            .join("+")
          row.getCell(col).value = { formula }
        }
      } else {
        row.getCell(col).value = 0
      }
    } else {
      row.getCell(col).value = 0
    }
    subtotalColIndex++
  }
}

/**
 * 設問セルを設定する
 *
 * @param row - 対象の行
 * @param student - 生徒の採点データ
 * @param subtotalCount - 小計列の数
 * @param isScoreSheet - 点数一覧シートかどうか（true: 点数一覧、false: 正誤一覧）
 */
function setQuestionCells(
  row: ExcelJS.Row,
  student: ScoringData,
  subtotalCount: number,
  isScoreSheet: boolean,
) {
  let scoreColIndex = 8 + subtotalCount

  for (const score of student.scores) {
    const col = getExcelColumnLetter(scoreColIndex)
    const cell = row.getCell(col)

    if (isScoreSheet) {
      // 点数一覧
      cell.value = score.score || 0
      // 部分点・保留の場合は赤色に設定
      if (score.status === "partial" || score.status === "hold") {
        cell.font = { color: { argb: "FFFF0000" } }
      }
    } else {
      // 正誤一覧
      cell.value = getStatusSymbol(score.status, score.score ?? undefined)
      // 部分点・保留の場合は赤色に設定
      if (score.status === "partial" || score.status === "hold") {
        cell.font = { color: { argb: "FFFF0000" } }
      }
    }
    scoreColIndex++
  }
}
