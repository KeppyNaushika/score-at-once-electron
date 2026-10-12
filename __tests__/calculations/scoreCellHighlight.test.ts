/**
 * Excel の得点・正誤のマスの赤字（isScoreCellHighlighted）と、行の書式が赤字を消さないこと（applyCellStyle）。
 *
 * 赤字は得点が確かでない採点（部分点・保留）だけ。類型方式の設問の類型採点済みは赤字にしない
 * （類型は正誤を持たず、点は類型の点数で確か。docs/vlm-grading-design.md §4-8-5）。
 * 行の書式（フォント名・大きさ・太字）は、先に付けた文字の色を残す。かつては書式が色ごと
 * 上書きし、赤字がどこにも出ていなかった
 */
import * as ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

import {
  applyCellStyle,
  isScoreCellHighlighted,
} from "@/electron-src/lib/shared/utilities/excelUtilities"

describe("isScoreCellHighlighted", () => {
  it("部分点・保留だけを赤字にする", () => {
    expect(isScoreCellHighlighted({ status: "partial" })).toBe(true)
    expect(isScoreCellHighlighted({ status: "pending" })).toBe(true)
    expect(isScoreCellHighlighted({ status: "correct" })).toBe(false)
    expect(isScoreCellHighlighted({ status: "incorrect" })).toBe(false)
    expect(isScoreCellHighlighted({ status: "no_answer" })).toBe(false)
  })

  it("類型採点済みは赤字にしない", () => {
    expect(isScoreCellHighlighted({ status: "evaluated" })).toBe(false)
  })
})

describe("applyCellStyle", () => {
  it("先に付けた赤字を残して、フォント名・大きさをそろえる", () => {
    const worksheet = new ExcelJS.Workbook().addWorksheet("得点一覧")
    const cell = worksheet.getCell("A1")
    cell.font = { color: { argb: "FFFF0000" } }
    applyCellStyle(cell, "data")
    expect(cell.font).toEqual({
      name: "メイリオUI",
      size: 10,
      bold: false,
      color: { argb: "FFFF0000" },
    })
  })

  it("色を付けていないマスには色を足さない", () => {
    const worksheet = new ExcelJS.Workbook().addWorksheet("得点一覧")
    const cell = worksheet.getCell("A1")
    applyCellStyle(cell, "header")
    expect(cell.font).toEqual({ name: "メイリオUI", size: 11, bold: true })
  })
})
