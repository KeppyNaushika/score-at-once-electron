/**
 * 名簿の表の Shift+クリック範囲選択（起点の行から押した行まで）の検証。
 * 起点は studentId で持つので、絞り込み・並べ替えで行がずれても起点の行から始まる。
 */

import { describe, expect, it } from "vitest"

import { rosterRowIdsInRange } from "@/components/common/roster-table/rosterRangeSelection"

const sortedRowIds = ["student-a", "student-b", "student-c", "student-d"]

describe("rosterRowIdsInRange", () => {
  it("起点から下へ押した行まで、両端を含めて表示順で返す", () => {
    expect(rosterRowIdsInRange(sortedRowIds, "student-b", "student-d")).toEqual(
      ["student-b", "student-c", "student-d"]
    )
  })

  it("起点より上の行を押しても表示順で返す", () => {
    expect(rosterRowIdsInRange(sortedRowIds, "student-c", "student-a")).toEqual(
      ["student-a", "student-b", "student-c"]
    )
  })

  it("起点そのものを押したらその1行", () => {
    expect(rosterRowIdsInRange(sortedRowIds, "student-b", "student-b")).toEqual(
      ["student-b"]
    )
  })

  it("並びが変わっても起点の行から始まる（添字で覚えない）", () => {
    const reorderedRowIds = ["student-d", "student-c", "student-b", "student-a"]
    expect(
      rosterRowIdsInRange(reorderedRowIds, "student-b", "student-a")
    ).toEqual(["student-b", "student-a"])
  })

  it("起点が無い・表示中に無いときは null（単独のトグルにする）", () => {
    expect(rosterRowIdsInRange(sortedRowIds, null, "student-c")).toBeNull()
    expect(
      rosterRowIdsInRange(sortedRowIds, "student-hidden", "student-c")
    ).toBeNull()
  })
})
