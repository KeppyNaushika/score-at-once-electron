// Excel操作で共通的に使用されるユーティリティ関数
import * as ExcelJS from "exceljs"

/**
 * Excel列番号を列文字に変換する関数
 * 例: 1 -> 'A', 26 -> 'Z', 27 -> 'AA'
 */
export function getExcelColumnLetter(colIndex: number): string {
  let result = ""
  let num = colIndex - 1
  while (num >= 0) {
    result = String.fromCharCode(65 + (num % 26)) + result
    num = Math.floor(num / 26) - 1
  }
  return result
}

/**
 * 採点ステータスを正誤記号に変換する関数
 */
export function getStatusSymbol(status: string, score?: number): string {
  switch (status) {
    case "correct":
      return "○"
    case "partial":
      return score !== undefined && score !== null ? `△${score}` : "△NULL"
    case "hold":
      return score !== undefined && score !== null ? `△${score}` : "△NULL"
    case "incorrect":
      return "×"
    case "no_answer":
      return "-"
    default:
      return "-"
  }
}

/**
 * セルのスタイルを統一的に設定する関数
 */
export function applyCellStyle(
  cell: ExcelJS.Cell,
  style: "header" | "data" | "total" | "subtotal"
) {
  // フォント設定（メイリオUI統一）
  cell.font = {
    name: "メイリオUI",
    size: style === "header" ? 11 : 10,
    bold: style === "header" || style === "total",
  }

  // 罫線設定
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  }

  // 背景色設定
  if (style === "header") {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE6E6FA" },
    }
  } else if (style === "total") {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB9C" },
    }
  } else if (style === "subtotal") {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE6F3FF" },
    }
  }

  // 中央揃え
  cell.alignment = { horizontal: "center", vertical: "middle" }
}

/**
 * 列幅を自動調整する関数
 */
export function autoFitColumns(
  worksheet: ExcelJS.Worksheet,
  minWidth = 8,
  maxWidth = 30
) {
  worksheet.columns.forEach((column: Partial<ExcelJS.Column>) => {
    if (!column) return
    let maxLength = 0
    if (column.eachCell) {
      column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 0
        if (columnLength > maxLength) {
          maxLength = columnLength
        }
      })
    }
    column.width = Math.min(Math.max(maxLength + 2, minWidth), maxWidth)
  })
}
