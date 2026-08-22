/**
 * スロット置換の分解（`planSlotPermutation`）
 *
 * 見るのは1点だけ ——「途中で2行が同じスロットに乗らないか」。
 * 乗ると、その形は NAS 同期の相手側で unique 違反になり、その相手からの取り込みが
 * 丸ごと巻き戻って以後永久に届かなくなる（実測:
 * `__tests__/sync/studentAnswerPlacementSync.test.ts`）。
 * 結合テストは2つの輪と鎖しか通らないので、3つの輪や輪の途中の空きはここで押さえる。
 */
import { describe, expect, it } from "vitest"

import {
  planSlotPermutation,
  type SlotOccupant,
} from "@/electron-src/lib/prisma/studentAnswer/slotPermutation"

/** 計画どおりに動かして、最後にどのスロットへどの行が座るかを出す */
const applyPlan = (
  occupants: SlotOccupant[],
  destinationBySlot: Map<string, string>
): Map<string, string> => {
  const permutation = planSlotPermutation(occupants, destinationBySlot)
  const rowIdBySlot = new Map(
    occupants.map((occupant) => [occupant.slot, occupant.rowId])
  )
  // 中身は「どの行から来たか」で表す（実物の列の代わり）
  const contentByRowId = new Map(
    occupants.map((occupant) => [occupant.rowId, occupant.rowId])
  )
  const originalContent = new Map(contentByRowId)

  for (const keyMove of permutation.keyMoves) {
    const currentSlot = Array.from(rowIdBySlot.entries()).find(
      ([, rowId]) => rowId === keyMove.rowId
    )!
    rowIdBySlot.delete(currentSlot[0])
    expect(rowIdBySlot.has(keyMove.toSlot)).toBe(false) // 途中でも衝突しない
    rowIdBySlot.set(keyMove.toSlot, keyMove.rowId)
  }
  for (const payloadCopy of permutation.payloadCopies) {
    contentByRowId.set(
      payloadCopy.intoRowId,
      originalContent.get(payloadCopy.fromRowId)!
    )
  }

  return new Map(
    Array.from(rowIdBySlot.entries()).map(([slot, rowId]) => [
      slot,
      contentByRowId.get(rowId)!,
    ])
  )
}

describe("planSlotPermutation", () => {
  it("空きマスへの移動は行ごと動かす（id が中身に付いていく）", () => {
    const occupants: SlotOccupant[] = [{ rowId: "row-x", slot: "x" }]
    const permutation = planSlotPermutation(occupants, new Map([["x", "y"]]))
    expect(permutation.keyMoves).toEqual([{ rowId: "row-x", toSlot: "y" }])
    expect(permutation.payloadCopies).toEqual([])
  })

  it("鎖は末尾から動かす（X→Y→Z、Z は空き）", () => {
    const occupants: SlotOccupant[] = [
      { rowId: "row-x", slot: "x" },
      { rowId: "row-y", slot: "y" },
    ]
    const permutation = planSlotPermutation(
      occupants,
      new Map([
        ["x", "y"],
        ["y", "z"],
      ])
    )
    expect(permutation.keyMoves).toEqual([
      { rowId: "row-y", toSlot: "z" },
      { rowId: "row-x", toSlot: "y" },
    ])
    expect(permutation.payloadCopies).toEqual([])
    expect(
      applyPlan(
        occupants,
        new Map([
          ["x", "y"],
          ["y", "z"],
        ])
      )
    ).toEqual(
      new Map([
        ["y", "row-x"],
        ["z", "row-y"],
      ])
    )
  })

  it("2つの輪は行を動かさず中身だけ回す", () => {
    const occupants: SlotOccupant[] = [
      { rowId: "row-x", slot: "x" },
      { rowId: "row-y", slot: "y" },
    ]
    const destinations = new Map([
      ["x", "y"],
      ["y", "x"],
    ])
    const permutation = planSlotPermutation(occupants, destinations)
    expect(permutation.keyMoves).toEqual([])
    expect(applyPlan(occupants, destinations)).toEqual(
      new Map([
        ["x", "row-y"],
        ["y", "row-x"],
      ])
    )
  })

  it("3つの輪も中身だけ回す", () => {
    const occupants: SlotOccupant[] = [
      { rowId: "row-x", slot: "x" },
      { rowId: "row-y", slot: "y" },
      { rowId: "row-z", slot: "z" },
    ]
    const destinations = new Map([
      ["x", "y"],
      ["y", "z"],
      ["z", "x"],
    ])
    const permutation = planSlotPermutation(occupants, destinations)
    expect(permutation.keyMoves).toEqual([])
    expect(applyPlan(occupants, destinations)).toEqual(
      new Map([
        ["x", "row-z"],
        ["y", "row-x"],
        ["z", "row-y"],
      ])
    )
  })

  it("輪の途中に行が無ければ、そこが空きになって全部が行ごと動く", () => {
    // 生徒Y には採点がまだ無い、という形。輪でも空きが1つあれば鎖として解ける
    const occupants: SlotOccupant[] = [
      { rowId: "row-x", slot: "x" },
      { rowId: "row-z", slot: "z" },
    ]
    const destinations = new Map([
      ["x", "y"],
      ["y", "z"],
      ["z", "x"],
    ])
    const permutation = planSlotPermutation(occupants, destinations)
    expect(permutation.payloadCopies).toEqual([])
    expect(applyPlan(occupants, destinations)).toEqual(
      new Map([
        ["x", "row-z"],
        ["y", "row-x"],
      ])
    )
  })

  it("同じ移動先を2つの移動元が指していたら拒む", () => {
    expect(() =>
      planSlotPermutation(
        [
          { rowId: "row-x", slot: "x" },
          { rowId: "row-y", slot: "y" },
        ],
        new Map([
          ["x", "z"],
          ["y", "z"],
        ])
      )
    ).toThrow()
  })

  it("2つの輪が同時にあっても、それぞれの中身だけが回る", () => {
    // 輪どうしが混ざらないこと。入次数1以下なので輪は必ず互いに素になる
    const occupants: SlotOccupant[] = [
      { rowId: "row-x", slot: "x" },
      { rowId: "row-y", slot: "y" },
      { rowId: "row-p", slot: "p" },
      { rowId: "row-q", slot: "q" },
      { rowId: "row-r", slot: "r" },
    ]
    const destinations = new Map([
      ["x", "y"],
      ["y", "x"],
      ["p", "q"],
      ["q", "r"],
      ["r", "p"],
    ])
    const permutation = planSlotPermutation(occupants, destinations)
    expect(permutation.keyMoves).toEqual([])
    expect(applyPlan(occupants, destinations)).toEqual(
      new Map([
        ["x", "row-y"],
        ["y", "row-x"],
        ["p", "row-r"],
        ["q", "row-p"],
        ["r", "row-q"],
      ])
    )
  })

  it("輪と鎖が同時にあっても、鎖だけが行ごと動く", () => {
    const occupants: SlotOccupant[] = [
      { rowId: "row-x", slot: "x" },
      { rowId: "row-y", slot: "y" },
      { rowId: "row-p", slot: "p" },
      { rowId: "row-q", slot: "q" },
    ]
    const destinations = new Map([
      ["x", "y"],
      ["y", "x"],
      ["p", "q"],
      ["q", "empty"],
    ])
    const permutation = planSlotPermutation(occupants, destinations)
    expect(permutation.keyMoves).toEqual([
      { rowId: "row-q", toSlot: "empty" },
      { rowId: "row-p", toSlot: "q" },
    ])
    expect(applyPlan(occupants, destinations)).toEqual(
      new Map([
        ["x", "row-y"],
        ["y", "row-x"],
        ["q", "row-p"],
        ["empty", "row-q"],
      ])
    )
  })

  it("自分自身への移動が混ざっていても、その行の中身は奪われない", () => {
    // 指摘④の再現形。`y→y` は何もしない移動として飛ばされるので y の行は残り、
    // `x→y` は行ごと動かせず中身のコピーへ落ちて、y の中身を黙って壊していた
    expect(() =>
      planSlotPermutation(
        [
          { rowId: "row-x", slot: "x" },
          { rowId: "row-y", slot: "y" },
        ],
        new Map([
          ["x", "y"],
          ["y", "y"],
        ])
      )
    ).toThrow(/移動しない行/)
  })

  it("移動先に居座る行が移動元に無ければ拒む", () => {
    // y はどこへも動かないのに、その上へ x を載せようとしている＝置換ではなく上書き
    expect(() =>
      planSlotPermutation(
        [
          { rowId: "row-x", slot: "x" },
          { rowId: "row-y", slot: "y" },
        ],
        new Map([["x", "y"]])
      )
    ).toThrow(/移動しない行/)
  })

  it("同じスロットに2行が座っていたら拒む", () => {
    // unique が既に壊れている形。Map へ畳むと片方が消えて、消えた行だけが動かない
    expect(() =>
      planSlotPermutation(
        [
          { rowId: "row-x", slot: "x" },
          { rowId: "row-x-duplicate", slot: "x" },
        ],
        new Map([["x", "y"]])
      )
    ).toThrow(/同じスロット/)
  })
})
