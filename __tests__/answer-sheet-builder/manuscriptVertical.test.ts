import { describe, expect, it } from "vitest"

import { manuscriptCharPosition } from "@/components/answer-sheet-builder/hooks/layout/layoutUtils"

describe("manuscriptCharPosition", () => {
  describe("横書き (vertical=false)", () => {
    const columns = 4
    const rows = 3

    it("0文字目は左上 (col=0, row=0)", () => {
      expect(manuscriptCharPosition(0, columns, rows, false)).toEqual({
        col: 0,
        row: 0,
      })
    })

    it("1行を埋めると次の文字は2行目の先頭へ折り返す", () => {
      expect(manuscriptCharPosition(columns, columns, rows, false)).toEqual({
        col: 0,
        row: 1,
      })
    })

    it("行内は左→右に進む", () => {
      expect(manuscriptCharPosition(2, columns, rows, false)).toEqual({
        col: 2,
        row: 0,
      })
    })

    it("マス数を超えると null", () => {
      expect(
        manuscriptCharPosition(columns * rows, columns, rows, false)
      ).toBeNull()
    })
  })

  describe("縦書き (vertical=true)", () => {
    const columns = 4
    const rows = 3

    it("0文字目は右上 (col=columns-1, row=0)", () => {
      expect(manuscriptCharPosition(0, columns, rows, true)).toEqual({
        col: columns - 1,
        row: 0,
      })
    })

    it("1列を埋めると次の文字は左隣の列の先頭へ", () => {
      expect(manuscriptCharPosition(rows, columns, rows, true)).toEqual({
        col: columns - 2,
        row: 0,
      })
    })

    it("列内は上→下に進む", () => {
      expect(manuscriptCharPosition(1, columns, rows, true)).toEqual({
        col: columns - 1,
        row: 1,
      })
    })

    it("最後のマスは左下 (col=0, row=rows-1)", () => {
      expect(
        manuscriptCharPosition(columns * rows - 1, columns, rows, true)
      ).toEqual({ col: 0, row: rows - 1 })
    })

    it("マス数を超えると null", () => {
      expect(
        manuscriptCharPosition(columns * rows, columns, rows, true)
      ).toBeNull()
    })
  })

  it("横書きと縦書きでマス総数は一致する（全インデックスが非nullの範囲）", () => {
    const columns = 5
    const rows = 4
    const total = columns * rows
    for (let i = 0; i < total; i++) {
      expect(manuscriptCharPosition(i, columns, rows, false)).not.toBeNull()
      expect(manuscriptCharPosition(i, columns, rows, true)).not.toBeNull()
    }
    expect(manuscriptCharPosition(total, columns, rows, false)).toBeNull()
    expect(manuscriptCharPosition(total, columns, rows, true)).toBeNull()
  })
})
