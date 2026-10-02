import { describe, expect, it } from "vitest"

import { buildGradeLockMessage, isFrozenDataSource } from "@/lib/gradeLock"
import type { UsingGradeDataSource } from "@/lib/shared/gradeReferenceMessages"

/** 試験・資料の詳細に同梱されるデータソース1件 */
const dataSource = ({
  gradeId = "grade-1",
  gradeName = "1学期成績",
  gradeItemName = "知識・技能",
  name = "中間",
  type = "exam_total",
  frozenScoreIds = [],
}: {
  gradeId?: string
  gradeName?: string
  gradeItemName?: string
  name?: string
  type?: string
  frozenScoreIds?: string[]
}): UsingGradeDataSource => ({
  id: crypto.randomUUID(),
  type,
  name,
  order: 0,
  subtotalId: null,
  gradeItem: {
    id: `${gradeId}-${gradeItemName}`,
    name: gradeItemName,
    order: 0,
    grade: { id: gradeId, name: gradeName },
    frozenScores: frozenScoreIds.map((id) => ({ id })),
  },
})

describe("buildGradeLockMessage", () => {
  it("成績算出ごとに、渡された順でまとめる", () => {
    const examTotal = dataSource({ name: "中間" })
    const thinking = dataSource({
      gradeItemName: "思考・判断・表現",
      type: "subtotal",
      name: "中間(思考)",
    })
    const secondGrade = dataSource({
      gradeId: "grade-2",
      gradeName: "2学期成績",
    })
    const message = buildGradeLockMessage("この試験", [
      examTotal,
      secondGrade,
      thinking,
    ])
    expect(message.lead).toContain("この試験は")
    expect(message.lead).toContain("点数が変わります")
    expect(message.groups).toEqual([
      {
        grade: { id: "grade-1", name: "1学期成績" },
        dataSources: [examTotal, thinking],
      },
      {
        grade: { id: "grade-2", name: "2学期成績" },
        dataSources: [secondGrade],
      },
    ])
    // 確定済みの評価項目が無ければ、確定の話はしない
    expect(message.frozenNote).toBeNull()
  })

  it("確定済みの評価項目があるときだけ、確定の注意を出す", () => {
    const frozen = dataSource({ frozenScoreIds: ["frozen-1", "frozen-2"] })
    const notFrozen = dataSource({ gradeItemName: "思考・判断・表現" })
    const message = buildGradeLockMessage("この試験", [frozen, notFrozen])
    expect(message.groups[0].dataSources.map(isFrozenDataSource)).toEqual([
      true,
      false,
    ])
    expect(message.frozenNote).toContain("確定後に元データが変わっています")
  })
})
