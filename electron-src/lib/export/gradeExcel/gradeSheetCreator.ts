/**
 * 成績算出Excel シート作成
 */

import type * as ExcelJS from "exceljs"

import type { GradeCalculationResult } from "../../../../src/types/grade.types"
import type { GradeExcelComparisonColumn } from "../../../../src/types/gradeExport.types"

/** 見出しのセルの塗り（成績一覧・詳細で共通） */
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE0E0E0" },
}

/** 成績一覧の列の種類（列幅を決める） */
type ResultColumnKind =
  | "number"
  | "name"
  | "percentage"
  | "gradeLabel"
  | "comparedGradeLabel"
  | "change"

const RESULT_COLUMN_WIDTHS: Record<ResultColumnKind, number> = {
  number: 12,
  name: 16,
  percentage: 12,
  gradeLabel: 12,
  comparedGradeLabel: 16,
  change: 6,
}

/**
 * 成績一覧シートを作成
 *
 * 見出しは2段。上の段で評価項目名をその項目の列にまたがって結合し、下の段に
 * 「(%)」「成績」と、比較1件ごとの「{比較先} 成績」「変化」を並べる。
 *
 * @param comparisonColumns 載せる比較の列。値は renderer が算出したもの（ここは書くだけ）。
 *   自分側の評価項目の列の右に、配列の順で並ぶ
 */
export function createGradeResultSheet(
  workbook: ExcelJS.Workbook,
  result: GradeCalculationResult,
  comparisonColumns: readonly GradeExcelComparisonColumn[] = []
): void {
  const sheet = workbook.addWorksheet("成績一覧")

  const itemColumns = result.gradeItems.map((gradeItem) => ({
    gradeItem,
    comparisonColumns: comparisonColumns.filter(
      (comparisonColumn) => comparisonColumn.gradeItemId === gradeItem.id
    ),
  }))
  // 比較の値は対象者 id で引く（並びに依存しない）
  const cellsByComparisonId = new Map(
    comparisonColumns.map((comparisonColumn) => [
      comparisonColumn.comparisonId,
      new Map(
        comparisonColumn.cells.map((comparisonCell) => [
          comparisonCell.gradeStudentId,
          comparisonCell,
        ])
      ),
    ])
  )

  // ── 見出し（2段） ──
  const columnKinds: ResultColumnKind[] = ["number", "name"]
  const groupHeaders: (string | null)[] = ["番号", "氏名"]
  const subHeaders: (string | null)[] = [null, null]
  const groupSpans: { firstColumn: number; lastColumn: number }[] = []
  for (const { gradeItem, comparisonColumns: itemComparisons } of itemColumns) {
    const firstColumn = groupHeaders.length + 1 // ExcelJS: 1-indexed
    groupHeaders.push(gradeItem.name, null)
    subHeaders.push("(%)", "成績")
    columnKinds.push("percentage", "gradeLabel")
    for (const comparisonColumn of itemComparisons) {
      groupHeaders.push(null, null)
      subHeaders.push(`${comparisonColumn.comparedTargetName} 成績`, "変化")
      columnKinds.push("comparedGradeLabel", "change")
    }
    groupSpans.push({ firstColumn, lastColumn: groupHeaders.length })
  }

  const groupHeaderRow = sheet.addRow(groupHeaders)
  const subHeaderRow = sheet.addRow(subHeaders)
  for (const headerRow of [groupHeaderRow, subHeaderRow]) {
    headerRow.font = { bold: true }
    for (let column = 1; column <= columnKinds.length; column++) {
      const cell = headerRow.getCell(column)
      cell.fill = HEADER_FILL
      cell.alignment = { vertical: "middle", horizontal: "center" }
    }
  }
  for (let column = 1; column <= columnKinds.length; column++) {
    subHeaderRow.getCell(column).border = { bottom: { style: "thin" } }
  }
  // 番号・氏名は2段を縦に、評価項目名はその項目の列を横に結合する
  sheet.mergeCells(1, 1, 2, 1)
  sheet.mergeCells(1, 2, 2, 2)
  for (const groupSpan of groupSpans) {
    sheet.mergeCells(1, groupSpan.firstColumn, 1, groupSpan.lastColumn)
  }

  // ── データ行 ──
  for (const student of result.students) {
    const row: (string | number | null)[] = [
      student.attendanceNumber,
      `${student.lastName} ${student.firstName}`,
    ]

    // セル位置追跡（除外/全欠測セルのスタイリング用）
    const excludedCellIndices: number[] = []
    const allMissingCellIndices: number[] = []
    const changeCellIndices: number[] = []

    for (const {
      gradeItem,
      comparisonColumns: itemComparisons,
    } of itemColumns) {
      const gradeItemResult = student.gradeItemResults.find(
        (gradeItemResult) => gradeItemResult.gradeItemId === gradeItem.id
      )
      if (gradeItemResult?.isExcluded) {
        excludedCellIndices.push(row.length, row.length + 1)
        row.push("除外", "除外")
      } else {
        if (gradeItemResult?.isAllMissing) {
          allMissingCellIndices.push(row.length, row.length + 1)
        }
        row.push(
          gradeItemResult?.percentage !== null &&
            gradeItemResult?.percentage !== undefined
            ? Math.round(gradeItemResult.percentage * 10) / 10
            : null,
          gradeItemResult?.gradeLabel ?? null
        )
      }

      for (const comparisonColumn of itemComparisons) {
        const comparisonCell = cellsByComparisonId
          .get(comparisonColumn.comparisonId)
          ?.get(student.gradeStudentId)
        changeCellIndices.push(row.length + 1)
        row.push(
          comparisonCell?.comparedGradeLabel ?? null,
          comparisonCell?.symbol ?? null
        )
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

    // 変化の記号は1文字なので中央に置く
    for (const cellIndex of changeCellIndices) {
      excelRow.getCell(cellIndex + 1).alignment = { horizontal: "center" }
    }
  }

  // 列幅調整
  columnKinds.forEach((columnKind, i) => {
    sheet.getColumn(i + 1).width = RESULT_COLUMN_WIDTHS[columnKind]
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
    cell.fill = HEADER_FILL
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
