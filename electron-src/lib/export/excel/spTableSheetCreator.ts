import * as ExcelJS from "exceljs"

import {
  computeSpTable,
  type SpInputStudent,
} from "../../shared/calculations/spAnalysis"
import type { ScoringData } from "../../shared/types"
import {
  applyCellStyle,
  autoFitColumns,
} from "../../shared/utilities/excelUtilities"

/** ScoringData を S-P表入力（二値）へ正規化 */
function toSpInput(scoringData: ScoringData[]): SpInputStudent[] {
  return scoringData.map((student) => ({
    studentId: student.studentId,
    studentName: student.studentName,
    items: student.scores.map((score) => ({
      questionId: score.questionId,
      label: score.questionLabel,
      isCorrect: score.status === "correct",
      isScored: score.status !== "unscored",
    })),
  }))
}

const MEDIUM_BORDER: Partial<ExcelJS.Border> = {
  style: "medium",
  color: { argb: "FF333333" },
}

/**
 * S-P表シートを作成する（#838）
 * 生徒（正答数降順）×設問（正答者数降順）の正誤マトリクスと、佐藤の注意係数を出力。
 * S曲線（行ごとの正答数境界）・P曲線（列ごとの正答者数境界）を罫線で表現する。
 */
export async function createSpTableSheet(
  workbook: ExcelJS.Workbook,
  scoringData: ScoringData[]
): Promise<ExcelJS.Worksheet> {
  const worksheet = workbook.addWorksheet("S-P表")

  const result = computeSpTable(toSpInput(scoringData))
  if (!result) {
    const row = worksheet.addRow(["S-P表を作成できる採点データがありません"])
    applyCellStyle(row.getCell(1), "data")
    return worksheet
  }

  const { students, problems } = result

  // ヘッダー行: 生徒 | 各設問 | 正答数 | 注意係数
  const headers = [
    "生徒",
    ...problems.map((problem) => problem.label),
    "正答数",
    "注意係数",
  ]
  const headerRow = worksheet.addRow(headers)
  headerRow.eachCell((cell) => applyCellStyle(cell, "header"))

  const headerRowNumber = headerRow.number
  const firstProblemCol = 2 // 1列目は生徒名

  // 生徒行
  students.forEach((student) => {
    const cautionText =
      student.cautionIndex !== null
        ? Math.round(student.cautionIndex * 1000) / 1000
        : "---"
    const row = worksheet.addRow([
      student.studentName,
      ...student.cells.map((isCorrect) => (isCorrect ? "○" : "")),
      student.correctCount,
      cautionText,
    ])

    row.eachCell((cell, colNumber) => {
      applyCellStyle(cell, "data")
      // 正答セルを淡く着色
      if (
        colNumber >= firstProblemCol &&
        colNumber < firstProblemCol + problems.length
      ) {
        const j = colNumber - firstProblemCol
        if (student.cells[j]) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          }
        }
      }
    })

    // S曲線: 正答数 c の右側に縦境界（c 個目の設問セルの右罫線）
    if (student.correctCount > 0 && student.correctCount <= problems.length) {
      const cell = row.getCell(firstProblemCol + student.correctCount - 1)
      cell.border = { ...cell.border, right: MEDIUM_BORDER }
    }
  })

  // P曲線: 各設問列で正答者数 m の行の下に横境界
  problems.forEach((problem, colIdx) => {
    if (problem.correctCount > 0 && problem.correctCount <= students.length) {
      const rowNumber = headerRowNumber + problem.correctCount
      const cell = worksheet.getRow(rowNumber).getCell(firstProblemCol + colIdx)
      cell.border = { ...cell.border, bottom: MEDIUM_BORDER }
    }
  })

  // 正答者数の行
  const correctCountRow = worksheet.addRow([
    "正答者数",
    ...problems.map((problem) => problem.correctCount),
    "",
    "",
  ])
  correctCountRow.eachCell((cell) => applyCellStyle(cell, "total"))

  // 設問の注意係数の行
  const problemCautionRow = worksheet.addRow([
    "注意係数",
    ...problems.map((problem) =>
      problem.cautionIndex !== null
        ? Math.round(problem.cautionIndex * 1000) / 1000
        : "---"
    ),
    "",
    "",
  ])
  problemCautionRow.eachCell((cell) => applyCellStyle(cell, "total"))

  autoFitColumns(worksheet)

  return worksheet
}
