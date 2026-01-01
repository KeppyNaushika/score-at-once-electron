import type { CropRegion } from "@prisma/client"
import * as ExcelJS from "exceljs"
import { SubtotalTargetMap } from "../../shared/calculations/subtotalCalculator"
import { ScoringData } from "../../shared/types/exportTypes"
import {
  applyCellStyle,
  getExcelColumnLetter,
  getStatusSymbol,
} from "../../shared/utilities/excelUtilities"

/**
 * データ行を作成する
 *
 * @param worksheet - 対象のワークシート
 * @param scoringData - 採点データ配列
 * @param subtotalRegions - 小計領域配列
 * @param subtotalTargetMap - 小計対象設問マップ
 * @param isScoreSheet - 点数一覧シートかどうか（true: 点数一覧、false: 正誤一覧）
 */
/**
 * 順位付きの採点データ型
 */
type ScoringDataWithRank = ScoringData & {
  originalIndex: number
  rank: number
}

export async function createDataRows(
  worksheet: ExcelJS.Worksheet,
  scoringData: ScoringData[],
  subtotalRegions: CropRegion[],
  subtotalTargetMap: SubtotalTargetMap,
  isScoreSheet: boolean
) {
  // 事前に順位を計算（総合点の降順でソート）
  const scoringDataWithRank: ScoringDataWithRank[] = scoringData
    .map(
      (student, index): ScoringDataWithRank => ({
        ...student,
        originalIndex: index,
        rank: 0, // 仮の値、後で正しい順位に更新
      })
    )
    .sort((a, b) => b.totalScore - a.totalScore)
    .map(
      (student, rank): ScoringDataWithRank => ({
        ...student,
        rank: rank + 1,
      })
    )
    // 元の順序に戻す
    .sort((a, b) => a.originalIndex - b.originalIndex)

  for (let i = 0; i < scoringDataWithRank.length; i++) {
    const student = scoringDataWithRank[i]
    const rowIndex = i + 2 // ヘッダー行を考慮

    // 受験状態を最左列（A列）に設定
    const statusText = getStatusText(student.status)

    const row = worksheet.addRow([
      statusText, // 受験状態（A列）
      student.rank, // 順位（B列）- 事前に計算済みの順位を使用
      student.grade || "",
      student.className || "",
      student.attendanceNumber || "",
      student.studentNumber,
      student.studentName,
    ])

    // 合計点の計算（Excel関数使用）
    const questionStartColIndex = 9 + subtotalRegions.length // 1つ右にシフト
    const questionEndColIndex =
      questionStartColIndex + student.scores.length - 1
    const questionStartCol = getExcelColumnLetter(questionStartColIndex)
    const questionEndCol = getExcelColumnLetter(questionEndColIndex)
    const totalCell = row.getCell("H") // G列からH列に変更
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
      isScoreSheet
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
 * @param student - 生徒の採点データ（計算済み小計点を含む）
 * @param subtotalRegions - 小計領域配列
 * @param subtotalTargetMap - 小計対象設問マップ（正誤一覧シートでのみ使用、非推奨）
 * @param rowIndex - 行インデックス（1ベース）
 * @param isScoreSheet - 点数一覧シートかどうか（true: 点数一覧、false: 正誤一覧）
 *
 * 注意: 点数一覧では計算済みの小計点を直接使用、正誤一覧では従来のExcel関数を使用
 */
async function setSubtotalCells(
  row: ExcelJS.Row,
  student: ScoringData,
  subtotalRegions: CropRegion[],
  subtotalTargetMap: SubtotalTargetMap,
  rowIndex: number,
  isScoreSheet: boolean
) {
  let subtotalColIndex = 9 // 1つ右にシフト
  const questionStartColIndex = 9 + subtotalRegions.length // 1つ右にシフト

  for (let i = 0; i < subtotalRegions.length; i++) {
    const col = getExcelColumnLetter(subtotalColIndex)
    const subtotalScore = student.subtotalScores[i]

    if (subtotalScore) {
      if (isScoreSheet) {
        // 点数一覧：計算済みの小計点を直接使用
        console.log(
          `📝 [Excel Export] Setting subtotal score: ${subtotalScore.score} for subtotal ${subtotalScore.subtotalId}`
        )
        if (subtotalScore.score !== null && subtotalScore.score !== undefined) {
          // 採点済みデータがあれば0点でも表示
          row.getCell(col).value = subtotalScore.score
        } else {
          // データがない場合は空欄
          row.getCell(col).value = ""
        }
      } else {
        // 正誤一覧：従来のロジックを使用（Excel関数が必要）
        // NOTE: buildSubtotalTargetMapは非推奨で空のマップを返すため、このロジックは機能しない
        const targetQuestionIndices =
          subtotalTargetMap[subtotalScore.subtotalId] || []

        if (targetQuestionIndices.length > 0) {
          const targetCells = targetQuestionIndices.map((index) => {
            const questionCol = getExcelColumnLetter(
              questionStartColIndex + index
            )
            return `${questionCol}${rowIndex}`
          })

          // 正誤一覧：対象設問の正答数
          const formula = targetCells
            .map((cell) => `IF(${cell}="○",1,0)`)
            .join("+")
          row.getCell(col).value = { formula }
        } else {
          // 正誤一覧で対象設問が不明な場合は空欄
          row.getCell(col).value = ""
        }
      }
    } else {
      // データがない場合は空欄
      row.getCell(col).value = ""
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
  isScoreSheet: boolean
) {
  let scoreColIndex = 9 + subtotalCount // 1つ右にシフト

  for (const score of student.scores) {
    const col = getExcelColumnLetter(scoreColIndex)
    const cell = row.getCell(col)

    if (isScoreSheet) {
      // 点数一覧
      if (score.status === "unscored") {
        // 未採点の場合は空欄
        cell.value = ""
      } else {
        // 採点済みの場合は0点でも表示
        cell.value =
          score.score !== null && score.score !== undefined ? score.score : 0
      }
      // 部分点・保留の場合は赤色に設定
      if (score.status === "partial" || score.status === "hold") {
        cell.font = { color: { argb: "FFFF0000" } }
      }
    } else {
      // 正誤一覧
      if (score.status === "unscored") {
        // 未採点の場合は空欄
        cell.value = ""
      } else {
        // 採点済みの場合は記号を表示
        const statusSymbol = getStatusSymbol(
          score.status,
          score.score ?? undefined
        )
        cell.value = statusSymbol || ""
      }
      // 部分点・保留の場合は赤色に設定
      if (score.status === "partial" || score.status === "hold") {
        cell.font = { color: { argb: "FFFF0000" } }
      }
    }
    scoreColIndex++
  }
}

/**
 * 受験状態を日本語に変換する
 *
 * @param status - 受験状態
 * @returns 日本語の受験状態
 */
function getStatusText(
  status?: "participating" | "expected" | "absent"
): string {
  switch (status) {
    case "participating":
      return "受験"
    case "expected":
      return "見込"
    case "absent":
      return "欠席"
    default:
      return "受験"
  }
}
