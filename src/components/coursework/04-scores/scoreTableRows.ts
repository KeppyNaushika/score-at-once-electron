import type { CourseworkItemWithLetterScales } from "@/types/coursework.types"

import { letterValueOf, toHalfWidth } from "../courseworkLetterValues"
import type {
  CourseworkCellPatch,
  CourseworkStudentRow,
} from "./courseworkScoreTable"

/**
 * 点数入力の表（EditableTable）の行と、表の変更から書き込みを作る純粋関数。
 *
 * 1行＝名簿の生徒1人。評価項目ごとに値の列（数値 or 文字評価）と、加減点・理由・
 * コメントの補助列を持つ。列の値はすべて文字列で、読み書きの変換はここで行う。
 */

/** 表の1行（列 id → 表示する文字列） */
export interface ScoreRow {
  _courseworkStudentId: string
  attendanceNumber: string
  className: string
  studentName: string
  [key: string]: string
}

/** 表の変更から作った、対象者×評価項目1マスへの書き込み */
export interface ScoreCellChange {
  courseworkItemId: string
  courseworkStudentId: string
  patch: CourseworkCellPatch
}

/** 評価項目ごとの列ID（value列はitem.id、補助列は接尾辞付き） */
export const adjColId = (itemId: string) => `${itemId}::adj`
export const reasonColId = (itemId: string) => `${itemId}::reason`
export const commentColId = (itemId: string) => `${itemId}::comment`

/**
 * 数値の表記ゆれを吸収する（全角英数・全角記号を半角へ、前後の空白を落とす）。
 *
 * `１０` は 10 のことであって別の数ではないので、数値として読むために寄せる。
 * **文字評価には通さない。** 評語は `Ａ` と `A` が別の評語でありうるので、
 * 表記を寄せるかどうかは貼り付けのときに人へ尋ねる（`transformPastedText`）。
 */
export const normalizeInput = (value: string): string =>
  toHalfWidth(value).trim()

/** 空欄、または有限の数値として読める入力か（満点超過・負数も有効） */
export const isBlankOrFiniteNumber = (value: string): boolean => {
  const normalized = normalizeInput(value)
  if (normalized === "") return true
  const parsedValue = Number(normalized)
  return !isNaN(parsedValue) && isFinite(parsedValue)
}

/** 名簿の行を、表の行（文字列の列）へ写す */
export function toScoreTableRows(
  studentRows: CourseworkStudentRow[],
  items: CourseworkItemWithLetterScales[]
): ScoreRow[] {
  return studentRows.map((row): ScoreRow => {
    const tableRow: ScoreRow = {
      _courseworkStudentId: row.courseworkStudentId,
      attendanceNumber:
        row.attendanceNumber != null ? String(row.attendanceNumber) : "-",
      className: row.className ?? "-",
      studentName: `${row.lastName} ${row.firstName}`,
    }
    for (const item of items) {
      const cell = row.cells[item.id]
      if (item.inputMode === "letter") {
        tableRow[item.id] = cell?.letterValue ?? ""
      } else {
        tableRow[item.id] = cell?.score != null ? String(cell.score) : ""
      }
      tableRow[adjColId(item.id)] =
        cell?.adjustment != null ? String(cell.adjustment) : ""
      tableRow[reasonColId(item.id)] = cell?.adjustmentReason ?? ""
      tableRow[commentColId(item.id)] = cell?.comment ?? ""
    }
    return tableRow
  })
}

/** 補助列（加減点・理由・コメント）に入力があるマスの数 */
export function countFilledAuxiliaryCells(
  studentRows: CourseworkStudentRow[],
  items: CourseworkItemWithLetterScales[]
): number {
  return studentRows
    .flatMap((row) => items.map((item) => row.cells[item.id]))
    .filter(
      // 加減点は既定値が 0（schema の @default(0)）なので、0 は「入力なし」と数える。
      // null かどうかだけで見ると、何も入れていない全員のマスが数えられる
      (cell) =>
        cell !== undefined &&
        ((cell.adjustment != null && cell.adjustment !== 0) ||
          (cell.adjustmentReason ?? "") !== "" ||
          (cell.comment ?? "") !== "")
    ).length
}

/** 空欄なら null、読める数値ならその数、読めなければ書かない（undefined） */
const parseNumberCell = (value: string): number | null | undefined => {
  const trimmed = normalizeInput(value)
  if (trimmed === "") return null
  const parsedValue = Number(trimmed)
  return !isNaN(parsedValue) && isFinite(parsedValue) ? parsedValue : undefined
}

/** 空白を落とし、空なら null */
const textOrNull = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/**
 * 変更前と変更後の表を比べ、変わったマスへの書き込みを作る。
 *
 * 行は対象者（`_courseworkStudentId`）で突き合わせる。行の追加・削除はさせない表
 * なので、同じ対象者が前後の両方にいる行だけを見る。
 */
export function diffScoreTableRows(
  previousRows: ScoreRow[],
  nextRows: ScoreRow[],
  items: CourseworkItemWithLetterScales[]
): ScoreCellChange[] {
  const previousRowById = new Map(
    previousRows.map((row) => [row._courseworkStudentId, row])
  )
  return nextRows.flatMap((nextRow) => {
    const previousRow = previousRowById.get(nextRow._courseworkStudentId)
    if (!previousRow) return []
    const courseworkStudentId = nextRow._courseworkStudentId
    const changed = (columnId: string) =>
      nextRow[columnId] !== previousRow[columnId]

    return items.flatMap((item): ScoreCellChange[] => {
      const patches: CourseworkCellPatch[] = []

      // value列（数値 or 文字評価）
      if (changed(item.id)) {
        if (item.inputMode === "letter") {
          // 入力された文字をそのまま保存する。変換表に無い評語も保存し、
          // 気づく口は「マスが赤いこと」と「評価項目の画面での列挙」が持つ
          const letterValue = letterValueOf(nextRow[item.id] ?? "")
          patches.push({ letterValue: letterValue === "" ? null : letterValue })
        } else {
          // 満点超過・負数も入力どおり保存する。数値として読めない値は無視
          const score = parseNumberCell(nextRow[item.id] ?? "")
          if (score !== undefined) patches.push({ score })
        }
      }

      // 加減点列（無効値は無視）
      if (changed(adjColId(item.id))) {
        const adjustment = parseNumberCell(nextRow[adjColId(item.id)] ?? "")
        if (adjustment !== undefined) patches.push({ adjustment })
      }

      if (changed(reasonColId(item.id))) {
        patches.push({
          adjustmentReason: textOrNull(nextRow[reasonColId(item.id)] ?? ""),
        })
      }

      if (changed(commentColId(item.id))) {
        patches.push({
          comment: textOrNull(nextRow[commentColId(item.id)] ?? ""),
        })
      }

      return patches.map((patch) => ({
        courseworkItemId: item.id,
        courseworkStudentId,
        patch,
      }))
    })
  })
}
