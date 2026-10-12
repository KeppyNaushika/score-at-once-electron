/**
 * 一覧の選択から、今の行に無い id を落とす（`pruneSelectedIds`）。
 *
 * 落とさないと、削除した行の id が選択に残り、そのまま一括タグ付けすると
 * 消えた行へ書きに行く（試験外成績資料と成績算出がそうなっていた）。
 */

import { describe, expect, it } from "vitest"

import { pruneSelectedIds } from "@/components/common/entity-list/entityListSelection"

describe("pruneSelectedIds", () => {
  it("今の行に無い id を落とす", () => {
    const selectedIds = new Set(["exam-a", "exam-deleted", "exam-b"])
    const rows = [{ id: "exam-a" }, { id: "exam-b" }, { id: "exam-c" }]

    expect([...pruneSelectedIds(selectedIds, rows)]).toEqual([
      "exam-a",
      "exam-b",
    ])
  })

  it("何も落ちないときは同じ Set を返す（参照を保つ）", () => {
    const selectedIds = new Set(["exam-a"])
    const rows = [{ id: "exam-a" }, { id: "exam-b" }]

    expect(pruneSelectedIds(selectedIds, rows)).toBe(selectedIds)
  })

  it("行が無くなれば選択も空になる", () => {
    const selectedIds = new Set(["exam-a"])

    expect(pruneSelectedIds(selectedIds, []).size).toBe(0)
  })
})
