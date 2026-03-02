/**
 * 成績算出Excel シート作成
 */

import * as ExcelJS from "exceljs"

import type { GradeCalculationResult } from "../../../../types/grade.types"

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
  headers.push("総合 (%)", "総合成績")

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
      const gir = student.gradeItemResults.find(
        (r) => r.gradeItemId === gradeItem.id
      )
      if (gir?.isExcluded) {
        row.push("除外")
        excludedCellIndices.push(resultColIndex)
        resultColIndex++
        row.push("除外")
        excludedCellIndices.push(resultColIndex)
        resultColIndex++
      } else {
        row.push(
          gir?.percentage !== null && gir?.percentage !== undefined
            ? Math.round(gir.percentage * 10) / 10
            : null
        )
        if (gir?.isAllMissing) {
          allMissingCellIndices.push(resultColIndex)
        }
        resultColIndex++
        row.push(gir?.gradeLabel ?? null)
        if (gir?.isAllMissing) {
          allMissingCellIndices.push(resultColIndex)
        }
        resultColIndex++
      }
    }

    row.push(
      student.overallPercentage !== null
        ? Math.round(student.overallPercentage * 10) / 10
        : null
    )
    row.push(student.overallGradeLabel)

    const excelRow = sheet.addRow(row)

    // 除外セルにスタイル適用
    for (const idx of excludedCellIndices) {
      const cell = excelRow.getCell(idx + 1) // ExcelJS: 1-indexed
      cell.font = { italic: true, color: { argb: "FF999999" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      }
    }

    // 全欠測→0点セルに赤色適用
    for (const idx of allMissingCellIndices) {
      const cell = excelRow.getCell(idx + 1)
      cell.font = { color: { argb: "FFEF4444" } }
    }
  }

  // 列幅調整
  sheet.columns.forEach((col, i) => {
    if (i === 1) {
      col.width = 16
    } else {
      col.width = 12
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

  // ヘッダー: 番号 / 氏名 / 各GradeItem内の各dataSource
  const headers = ["番号", "氏名"]
  for (const gradeItem of result.gradeItems) {
    const firstStudent = result.students[0]
    const gir = firstStudent?.gradeItemResults.find(
      (r) => r.gradeItemId === gradeItem.id
    )
    if (gir) {
      for (const ss of gir.sourceScores) {
        headers.push(`${gradeItem.name}/${ss.dataSourceName}`)
      }
    }
    headers.push(`${gradeItem.name} 合計`)
  }
  headers.push("総合")

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

  for (const student of result.students) {
    const row: (string | number | null)[] = [
      student.attendanceNumber,
      `${student.lastName} ${student.firstName}`,
    ]

    // セル位置追跡用（推定/除外セルのスタイリング用）
    const estimatedCellIndices: number[] = []
    const detailExcludedCellIndices: number[] = []
    let colIndex = 2 // 0=番号, 1=氏名

    for (const gradeItem of result.gradeItems) {
      const gir = student.gradeItemResults.find(
        (r) => r.gradeItemId === gradeItem.id
      )
      if (gir) {
        if (gir.isExcluded) {
          // 除外: DataSource列分 + 合計列の全てを「除外」表示
          const firstStudent = result.students[0]
          const refGir = firstStudent?.gradeItemResults.find(
            (r) => r.gradeItemId === gradeItem.id
          )
          const sourceCount = refGir?.sourceScores.length ?? 0
          for (let i = 0; i < sourceCount; i++) {
            row.push("除外")
            detailExcludedCellIndices.push(colIndex)
            colIndex++
          }
          row.push("除外")
          detailExcludedCellIndices.push(colIndex)
          colIndex++
        } else {
          for (const ss of gir.sourceScores) {
            row.push(
              ss.weightedScore !== null
                ? Math.round(ss.weightedScore * 100) / 100
                : null
            )
            if (ss.isEstimated) {
              estimatedCellIndices.push(colIndex)
            }
            colIndex++
          }
          row.push(
            gir.weightedScore !== null
              ? Math.round(gir.weightedScore * 100) / 100
              : null
          )
          colIndex++
        }
      }
    }

    row.push(
      student.overallScore !== null
        ? Math.round(student.overallScore * 100) / 100
        : null
    )

    const excelRow = sheet.addRow(row)

    // 推定セルにスタイル適用
    for (const idx of estimatedCellIndices) {
      const cell = excelRow.getCell(idx + 1) // ExcelJS: 1-indexed
      cell.font = { italic: true, color: { argb: "FFD97706" } }
      cell.note = "欠測推定値"
    }

    // 除外セルにスタイル適用
    for (const idx of detailExcludedCellIndices) {
      const cell = excelRow.getCell(idx + 1)
      cell.font = { italic: true, color: { argb: "FF999999" } }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
      }
    }
  }

  sheet.columns.forEach((col, i) => {
    if (i === 1) {
      col.width = 16
    } else {
      col.width = 14
    }
  })
}
