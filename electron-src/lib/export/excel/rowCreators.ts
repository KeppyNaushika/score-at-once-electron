import * as ExcelJS from "exceljs"

import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

import { ScoringData } from "../../shared/types/exportTypes"
import {
  applyCellStyle,
  getExcelColumnLetter,
  getStatusSymbol,
} from "../../shared/utilities/excelUtilities"
import type { SubtotalColumn } from "./dataFetcher"

/**
 * データ行を作成する
 *
 * @param worksheet - 対象のワークシート
 * @param scoringData - 採点データ配列
 * @param subtotalColumns - 小計列情報配列（SubtotalGroupから構築）
 * @param isScoreSheet - 点数一覧シートかどうか（true: 点数一覧、false: 正誤一覧）
 */
export async function createDataRows(
  worksheet: ExcelJS.Worksheet,
  scoringData: ScoringData[],
  subtotalColumns: SubtotalColumn[],
  isScoreSheet: boolean
) {
  // 事前に順位を計算（総合点の降順でソート、null は最下位扱い）
  const scoringDataWithRank = scoringData
    .map((student, index) => ({
      ...student,
      originalIndex: index,
      rank: 0, // 仮の値、後で正しい順位に更新
    }))
    .sort(
      (studentA, studentB) =>
        (studentB.totalScore ?? -1) - (studentA.totalScore ?? -1)
    )
    .map((student, rank) => ({
      ...student,
      rank: student.totalScore !== null ? rank + 1 : 0,
    }))
    // 元の順序に戻す
    .sort(
      (studentA, studentB) => studentA.originalIndex - studentB.originalIndex
    )

  for (let i = 0; i < scoringDataWithRank.length; i++) {
    const student = scoringDataWithRank[i]

    // 受験状態を最左列（A列）に設定
    const statusText = getStatusText(student.status)

    const row = worksheet.addRow([
      statusText, // 受験状態（A列）
      student.rank > 0 ? student.rank : "", // 順位（B列）- null totalScore → 空欄
      student.grade || "",
      student.className || "",
      student.attendanceNumber || "",
      student.studentNumber,
      student.studentName,
    ])

    // 合計点の設定（計算済み値を直接出力、null → 空欄）
    const totalCell = row.getCell("H")
    if (student.totalScore !== null) {
      totalCell.value = student.totalScore
    } else {
      totalCell.value = ""
    }
    // 合計点を赤色に設定
    totalCell.font = { color: { argb: "FFFF0000" } }

    // 小計点の設定（SubtotalColumn ID紐付け方式）
    setSubtotalCells(row, student, subtotalColumns, isScoreSheet)

    // 設問別データの設定
    setQuestionCells(row, student, subtotalColumns.length, isScoreSheet)

    // 行スタイルの適用
    row.eachCell((cell) => applyCellStyle(cell, "data"))
  }
}

/**
 * 小計点セルを設定する（SubtotalColumn ID紐付け方式）
 *
 * @param row - 対象の行
 * @param student - 生徒の採点データ（計算済み小計点を含む）
 * @param subtotalColumns - 小計列情報配列
 * @param isScoreSheet - 点数一覧シートかどうか
 */
function setSubtotalCells(
  row: ExcelJS.Row,
  student: ScoringData,
  subtotalColumns: SubtotalColumn[],
  isScoreSheet: boolean
) {
  let subtotalColIndex = 9

  for (const column of subtotalColumns) {
    const columnLetter = getExcelColumnLetter(subtotalColIndex)
    const subtotalScore = student.subtotalScores.find(
      (subtotalScore) => subtotalScore.subtotalId === column.subtotalId
    )

    if (isScoreSheet) {
      // 点数一覧：計算済みの小計点を直接使用
      if (
        subtotalScore &&
        subtotalScore.score !== null &&
        subtotalScore.score !== undefined
      ) {
        row.getCell(columnLetter).value = subtotalScore.score
      } else {
        row.getCell(columnLetter).value = ""
      }
    } else {
      // 正誤一覧：計算済みの小計点を直接使用（旧Excel関数方式を廃止）
      if (
        subtotalScore &&
        subtotalScore.score !== null &&
        subtotalScore.score !== undefined
      ) {
        row.getCell(columnLetter).value = subtotalScore.score
      } else {
        row.getCell(columnLetter).value = ""
      }
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
    const columnLetter = getExcelColumnLetter(scoreColIndex)
    const cell = row.getCell(columnLetter)

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
      if (score.status === "partial" || score.status === "pending") {
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
      if (score.status === "partial" || score.status === "pending") {
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
function getStatusText(status?: ExamStudentStatus): string {
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
