import { describe, expect, it } from "vitest"

import { buildGradeLockMessage } from "@/lib/gradeLock"
import type { GradeLockSource } from "@/types/gradeLock.types"

const source = (overrides: Partial<GradeLockSource>): GradeLockSource => ({
  gradeId: "grade-1",
  gradeName: "1学期成績",
  gradeItemName: "知識・技能",
  dataSourceId: crypto.randomUUID(),
  dataSourceName: "中間",
  dataSourceType: "exam_total",
  frozenScoreCount: 0,
  ...overrides,
})

describe("buildGradeLockMessage", () => {
  it("成績算出ごとにまとめ、同じ評価項目・データソースの組は畳む", () => {
    const examTotal = source({ dataSourceName: "中間" })
    const message = buildGradeLockMessage("この試験", [
      examTotal,
      { ...examTotal, dataSourceId: "copy" },
      source({
        gradeItemName: "思考・判断・表現",
        dataSourceType: "subtotal",
        dataSourceName: "中間(思考)",
      }),
      source({ gradeId: "grade-2", gradeName: "2学期成績" }),
    ])
    expect(message.lead).toContain("この試験は")
    expect(message.lead).toContain("点数が変わります")
    expect(message.groups).toEqual([
      {
        gradeId: "grade-1",
        gradeName: "1学期成績",
        rows: [
          {
            gradeItemName: "知識・技能",
            dataSourceName: "中間",
            dataSourceTypeLabel: "試験の合計点",
            isFrozen: false,
          },
          {
            gradeItemName: "思考・判断・表現",
            dataSourceName: "中間(思考)",
            dataSourceTypeLabel: "小計",
            isFrozen: false,
          },
        ],
      },
      {
        gradeId: "grade-2",
        gradeName: "2学期成績",
        rows: [expect.objectContaining({ gradeItemName: "知識・技能" })],
      },
    ])
    // 確定済みの評価項目が無ければ、確定の話はしない
    expect(message.frozenNote).toBeNull()
  })

  it("確定済みの評価項目があるときだけ、確定の注意を出して行に印を付ける", () => {
    const message = buildGradeLockMessage("この試験", [
      source({ frozenScoreCount: 3 }),
      source({ gradeItemName: "思考・判断・表現" }),
    ])
    expect(message.groups[0].rows.map((row) => row.isFrozen)).toEqual([
      true,
      false,
    ])
    expect(message.frozenNote).toContain("確定後に元データが変わっています")
  })
})
