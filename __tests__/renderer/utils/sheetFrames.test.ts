/**
 * PDF加工: 出力プレビューで面をくくる枠の固定。
 *
 * 枠は面の段ごとに描く（全体 N-up なら、全体の面の枠とファイルごとの面の枠）。同じ行で
 * 隣のカードが同じ段の同じ面なら辺を開けてつなぐ。全体の面の id は先頭に入るファイル
 * ごとの面の id と同じ値なので、段をまたいで比べると枠を誤ってつなぐ。
 */
import { describe, expect, it } from "vitest"

import type { PagePlacement } from "@/components/pdf-tools/export-panel/pagePlacements"
import { sheetFramesByPageId } from "@/components/pdf-tools/export-panel/sheetFrames"

/** 枠を "段:左右"（"(" は左辺を閉じる、"-" はつなぐ、")" は右辺を閉じる）で書く */
function describeFrames(
  pageIds: string[],
  sheetIdsByPageId: Record<string, string[]>,
  columns: number
): string[] {
  const placementByPageId = new Map(
    Object.entries(sheetIdsByPageId).map(
      ([pageId, sheetIds]): [string, PagePlacement] => [
        pageId,
        { outputPageNumber: 1, sheetIds },
      ]
    )
  )
  const framesByPageId = sheetFramesByPageId(
    pageIds,
    placementByPageId,
    columns
  )
  return pageIds.map((pageId) =>
    (framesByPageId.get(pageId) ?? [])
      .map(
        (frame) =>
          `${frame.level}:${frame.joinsPrevious ? "-" : "("}${frame.joinsNext ? "-" : ")"}`
      )
      .join(" ")
  )
}

describe("面をくくる枠", () => {
  // 全体 2in1: 1面目 = [A:1+A:2] + B:1、2面目 = [A:3+A:4] + B:2
  const pageIds = ["A:1", "A:2", "B:1", "A:3", "A:4", "B:2"]
  const sheetIdsByPageId = {
    "A:1": ["A:1", "A:1"],
    "A:2": ["A:1", "A:1"],
    "B:1": ["A:1"],
    "A:3": ["A:3", "A:3"],
    "A:4": ["A:3", "A:3"],
    "B:2": ["A:3"],
  }

  it("全体の面は外側の枠でつなぎ、ファイルごとの面は内側の枠で閉じる", () => {
    expect(describeFrames(pageIds, sheetIdsByPageId, 6)).toEqual([
      "0:(- 1:(-",
      "0:-- 1:-)",
      "0:-)",
      "0:(- 1:(-",
      "0:-- 1:-)",
      "0:-)",
    ])
  })

  it("行の端では、同じ面でも枠を閉じる", () => {
    // 1行4枚: 2面目（A:3 から）が行をまたぐ
    expect(describeFrames(pageIds, sheetIdsByPageId, 4)).toEqual([
      "0:(- 1:(-",
      "0:-- 1:-)",
      "0:-)",
      "0:() 1:()",
      "0:(- 1:()",
      "0:-)",
    ])
  })

  it("面に入らないページには枠が無い", () => {
    expect(describeFrames(["C:1"], { "C:1": [] }, 4)).toEqual([""])
  })
})
