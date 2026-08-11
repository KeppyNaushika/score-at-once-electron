/**
 * 成績算出Excel シート作成
 */

import type * as ExcelJS from "exceljs"

import type { GradeCalculationResult } from "../../../../src/types/grade.types"

/**
 * 成績一覧シートを作成
 */
export function createGradeResultSheet(
  workbook: ExcelJS.Workbook,
  result: GradeCalculationResult
): void {
  const sheet = workbook.addWorksheet("成績一覧")

  // ヘッダー行構築
  const headers = ["番号", "氏名"]
  for (const gradeItem of result.gradeItems) {
    headers.push(`${gradeItem.name} (%)`)
    headers.push(`${gradeItem.name} 成績`)
  }

  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }
    cell.border = {
      bottom: { style: "thin" },
    }
  })

  // データ行
  for (const student of result.students) {
    const row: (string | number | null)[] = [
      student.attendanceNumber,
      `${student.lastName} ${student.firstName}`,
    ]

    // セル位置追跡（除外/全欠測セルのスタイリング用）
    const excludedCellIndices: number[] = []
    const allMissingCellIndices: number[] = []
    let resultColIndex = 2 // 0=番号, 1=氏名

    for (const gradeItem of result.gradeItems) {
      const gradeItemResult = student.gradeItemResults.find(
        (gradeItemResult) => gradeItemResult.gradeItemId === gradeItem.id
      )
      if (gradeItemResult?.isExcluded) {
        row.push("除外")
        excludedCellIndices.push(resultColIndex)
        resultColIndex++
        row.push("除外")
        excludedCellIndices.push(resultColIndex)
        resultColIndex++
      } else {
        row.push(
          gradeItemResult?.percentage !== null &&
            gradeItemResult?.percentage !== undefined
            ? Math.round(gradeItemResult.percentage * 10) / 10
            : null
        )
        if (gradeItemResult?.isAllMissing) {
          allMissingCellIndices.push(resultColIndex)
        }
        resultColIndex++
        row.push(gradeItemResult?.gradeLabel ?? null)
        if (gradeItemResult?.isAllMissing) {
          allMissingCellIndices.push(resultColIndex)
        }
        resultColIndex++
      }
    }

    const excelRow = sheet.addRow(row)

    // 除外セルにスタイル適用
    for (const cellIndex of excludedCellIndices) {
      const cell = excelRow.getCell(cellIndex + 1) // ExcelJS: 1-indexed
      cell.font = { italic: true, color: { argb: "FF999999" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      }
    }

    // 全欠測→0点セルに赤色適用
    for (const cellIndex of allMissingCellIndices) {
      const cell = excelRow.getCell(cellIndex + 1)
      cell.font = { color: { argb: "FFEF4444" } }
    }
  }

  // 列幅調整
  sheet.columns.forEach((column, i) => {
    if (i === 1) {
      column.width = 16
    } else {
      column.width = 12
    }
  })
}

/**
 * データソース別詳細シートを作成
 */
export function createDetailSheet(
  workbook: ExcelJS.Workbook,
  result: GradeCalculationResult
): void {
  const sheet = workbook.addWorksheet("詳細")

  // ヘッダー: 番号 / 氏名 / 各GradeItem内の各dataSource。
  // 列は評価項目そのものの dataSources から決める。特定の生徒の sourceScores を
  // 基準にしてはならない（除外された生徒は空になり、行ごとに列数が食い違う）。
  const headers = ["番号", "氏名"]
  for (const gradeItem of result.gradeItems) {
    for (const dataSource of gradeItem.dataSources) {
      headers.push(`${gradeItem.name}/${dataSource.name}`)
    }
    headers.push(`${gradeItem.name} 合計`)
  }

  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }
    cell.border = {
      bottom: { style: "thin" },
    }
  })

  // 番号・氏名以外のヘッダー（データソース名・各評価項目の合計）はすべて縦書きに
  // （名前が長く横幅を取るため）
  for (let i = 3; i <= headers.length; i++) {
    headerRow.getCell(i).alignment = {
      textRotation: "vertical",
      vertical: "middle",
      horizontal: "center",
    }
  }

  for (const student of result.students) {
    const row: (string | number | null)[] = [
      student.attendanceNumber,
      `${student.lastName} ${student.firstName}`,
    ]

    // セル位置追跡用（推定/除外セルのスタイリング用）
    const estimatedCellIndices: number[] = []
    const detailExcludedCellIndices: number[] = []
    let colIndex = 2 // 0=番号, 1=氏名

    // ヘッダーと同じく評価項目の dataSources を列の定義として使い、除外でも結果欠落でも
    // 必ず「dataSources 件数 + 合計1列」を出す。行ごとの列数を構造で揃え、ずれを起こさない。
    for (const gradeItem of result.gradeItems) {
      const gradeItemResult = student.gradeItemResults.find(
        (gradeItemResult) => gradeItemResult.gradeItemId === gradeItem.id
      )
      const isExcluded = gradeItemResult?.isExcluded ?? false

      for (const dataSource of gradeItem.dataSources) {
        if (isExcluded) {
          row.push("除外")
          detailExcludedCellIndices.push(colIndex)
        } else {
          // 位置ではなく dataSourceId で引く（順序の一致に依存しない）
          const sourceScore = gradeItemResult?.sourceScores.find(
            (sourceScore) => sourceScore.dataSourceId === dataSource.id
          )
          row.push(
            sourceScore !== undefined && sourceScore.weightedScore !== null
              ? Math.round(sourceScore.weightedScore * 100) / 100
              : null
          )
          if (sourceScore?.isEstimated) {
            estimatedCellIndices.push(colIndex)
          }
        }
        colIndex++
      }

      if (isExcluded) {
        row.push("除外")
        detailExcludedCellIndices.push(colIndex)
      } else {
        row.push(
          gradeItemResult !== undefined &&
            gradeItemResult.weightedScore !== null
            ? Math.round(gradeItemResult.weightedScore * 100) / 100
            : null
        )
      }
      colIndex++
    }

    const excelRow = sheet.addRow(row)

    // 推定セルにスタイル適用
    for (const cellIndex of estimatedCellIndices) {
      const cell = excelRow.getCell(cellIndex + 1) // ExcelJS: 1-indexed
      cell.font = { italic: true, color: { argb: "FFD97706" } }
      cell.note = "欠測推定値"
    }

    // 除外セルにスタイル適用
    for (const cellIndex of detailExcludedCellIndices) {
      const cell = excelRow.getCell(cellIndex + 1)
      cell.font = { italic: true, color: { argb: "FF999999" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      }
    }
  }

  sheet.columns.forEach((column, i) => {
    if (i === 1) {
      column.width = 16
    } else {
      column.width = 14
    }
  })
}
