import type { RowData } from "@tanstack/react-table"

import type { EditableColumnDef } from "../EditableTable"

/**
 * 貼り付け先の起点（フォーカスしているセル）。
 *
 * 確認ダイアログを開くとフォーカスが移るので、**待つ前に**読んでおく。
 */
export interface PasteOrigin {
  rowIndex: number
  editableColumnIndex: number
}

/**
 * その列の検証に照らして保存されない値か。
 *
 * 入力どおり保存する列（`invalidValuePolicy: "keep"`）は、検証NGでも失われない
 * ので数えない。
 */
function isRejectedValue<T extends RowData>(
  column: EditableColumnDef<T>,
  value: string
): boolean {
  return value.trim() !== "" &&
    column.meta?.validate &&
    column.meta.invalidValuePolicy !== "keep"
    ? !column.meta.validate(value)
    : false
}

/** 貼り付けられた文字列を行に分ける */
export function splitPastedRows(pastedText: string): string[] {
  // CRLF/CR を LF に正規化してから分割（末尾セルに \r が混入するのを防ぐ）
  const rows = pastedText.replace(/\r\n?/g, "\n").split("\n")
  // 末尾の終端改行による空行のみ除去。途中の空行は行対応を保つため残す
  // （空行を除去すると空白セルの分だけ以降の行が上に詰まりズレる）
  while (rows.length > 0 && rows[rows.length - 1].trim() === "") rows.pop()
  return rows
}

/** 貼り付けた結果の行と、保存されない値の件数 */
interface PastedRows<T> {
  rows: T[]
  rejectedCount: number
}

/**
 * マージ型の貼り付け: 読み取り専用の列を飛ばし、編集できる列だけへ起点から配る。
 * 表の行数を超える分は捨てる。
 */
export function mergePastedRows<T extends RowData>(
  data: T[],
  pastedRows: string[],
  origin: PasteOrigin,
  editableColumns: EditableColumnDef<T>[]
): PastedRows<T> {
  const newData = [...data]
  let rejectedCount = 0
  for (let ri = 0; ri < pastedRows.length; ri++) {
    const targetRow = origin.rowIndex + ri
    if (targetRow >= newData.length) break

    const cells = pastedRows[ri].split("\t")
    let updatedRow = newData[targetRow]
    for (let ci = 0; ci < cells.length; ci++) {
      const targetCol = origin.editableColumnIndex + ci
      if (targetCol >= editableColumns.length) break
      const targetColumn = editableColumns[targetCol]
      const colId = targetColumn.id
      if (colId) {
        updatedRow = { ...updatedRow, [colId]: cells[ci] }
        if (isRejectedValue(targetColumn, cells[ci])) rejectedCount++
      }
    }
    newData[targetRow] = updatedRow
  }
  return { rows: newData, rejectedCount }
}

/**
 * 全置換型の貼り付け（読み取り専用の列が無い表）: 貼った行で表を置き換える。
 *
 * 新しい行の形は列の id からは作れない（列に出ない項目も行は持ちうる）ので、
 * 空の行は表の持ち主から `createEmptyRow` で受け取り、そこへ列ごとに値を入れる。
 */
export function replaceWithPastedRows<T extends RowData>(
  pastedRows: string[],
  columns: EditableColumnDef<T>[],
  createEmptyRow: () => T
): PastedRows<T> {
  let rejectedCount = 0
  const rows = pastedRows.map((pastedRow) => {
    const cells = pastedRow.split("\t")
    return columns.reduce((row, column, index): T => {
      if (!column.id) return row
      const cell = cells[index] || ""
      if (isRejectedValue(column, cell)) rejectedCount++
      return { ...row, [column.id]: cell }
    }, createEmptyRow())
  })
  return { rows, rejectedCount }
}
