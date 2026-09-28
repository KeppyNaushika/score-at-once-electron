import { describe, expect, it } from "vitest"

import {
  buildGradeLockMessage,
  describeGradeLockSource,
  findCourseworkItemLockSources,
  findCropRegionLockSources,
  findExpectedAsMissingLockSources,
  findSubtotalLockSources,
} from "@/lib/gradeLock"
import type { GradeLockSource } from "@/types/gradeLock.types"

const source = (overrides: Partial<GradeLockSource>): GradeLockSource => ({
  gradeId: "grade-1",
  gradeName: "1学期成績",
  gradeItemName: "知識・技能",
  dataSourceId: crypto.randomUUID(),
  dataSourceName: "中間",
  dataSourceType: "exam_total",
  examId: "exam-1",
  cropRegionId: null,
  subtotalId: null,
  courseworkItemId: null,
  treatExpectedAsMissing: false,
  subtotalCropRegionIds: [],
  ...overrides,
})

const questionAnswer = (id: string) => ({ id, type: "QUESTION_ANSWER" })

describe("findCropRegionLockSources", () => {
  it("試験の合計点で使われていれば、解答欄はすべて当たる", () => {
    const examTotal = source({ dataSourceType: "exam_total" })
    expect(
      findCropRegionLockSources([examTotal], questionAnswer("q1"))
    ).toEqual([examTotal])
    expect(
      findCropRegionLockSources([examTotal], questionAnswer("q2"))
    ).toEqual([examTotal])
  })

  it("解答欄でない領域は、試験の合計点や小計では当たらない", () => {
    const examTotal = source({ dataSourceType: "exam_total" })
    const subtotal = source({
      dataSourceType: "subtotal",
      subtotalId: "s1",
      subtotalCropRegionIds: ["name"],
    })
    expect(
      findCropRegionLockSources([examTotal, subtotal], {
        id: "name",
        type: "STUDENT_NAME",
      })
    ).toEqual([])
  })

  it("小計はその小計へ割り当てた設問だけに当たる", () => {
    const subtotal = source({
      dataSourceType: "subtotal",
      subtotalId: "s1",
      subtotalCropRegionIds: ["q1"],
    })
    expect(findCropRegionLockSources([subtotal], questionAnswer("q1"))).toEqual(
      [subtotal]
    )
    expect(findCropRegionLockSources([subtotal], questionAnswer("q2"))).toEqual(
      []
    )
  })

  it("設問のデータソースはその設問だけに当たる", () => {
    const question = source({
      dataSourceType: "crop_region",
      cropRegionId: "q1",
    })
    expect(findCropRegionLockSources([question], questionAnswer("q1"))).toEqual(
      [question]
    )
    expect(findCropRegionLockSources([question], questionAnswer("q2"))).toEqual(
      []
    )
  })
})

describe("findSubtotalLockSources", () => {
  it("その小計を指す小計のデータソースだけを返す", () => {
    const subtotal = source({ dataSourceType: "subtotal", subtotalId: "s1" })
    const other = source({ dataSourceType: "subtotal", subtotalId: "s2" })
    const examTotal = source({ dataSourceType: "exam_total" })
    expect(findSubtotalLockSources([subtotal, other, examTotal], "s1")).toEqual(
      [subtotal]
    )
  })
})

describe("findCourseworkItemLockSources", () => {
  it("評価項目のデータソースはその項目だけ、資料合計はすべての項目に当たる", () => {
    const item = source({
      dataSourceType: "coursework",
      examId: null,
      courseworkItemId: "item-1",
    })
    const total = source({ dataSourceType: "coursework_total", examId: null })
    expect(findCourseworkItemLockSources([item, total], "item-1")).toEqual([
      item,
      total,
    ])
    expect(findCourseworkItemLockSources([item, total], "item-2")).toEqual([
      total,
    ])
  })
})

describe("findExpectedAsMissingLockSources", () => {
  it("「見込」を欠測とするデータソースが無ければロックしない", () => {
    expect(findExpectedAsMissingLockSources([source({})], "exam-1")).toEqual([])
  })

  it("この試験を examId で指し、「見込」を欠測とするものだけを返す", () => {
    const expected = source({ treatExpectedAsMissing: true })
    // 算出は examId を持つデータソースでしか受験状態を見ない
    const withoutExamId = source({
      dataSourceType: "crop_region",
      examId: null,
      cropRegionId: "q1",
      treatExpectedAsMissing: true,
    })
    expect(
      findExpectedAsMissingLockSources([expected, withoutExamId], "exam-1")
    ).toEqual([expected])
  })
})

describe("buildGradeLockMessage", () => {
  it("どの成績算出のどの項目で使われているかを1行ずつ並べ、重複は畳む", () => {
    const examTotal = source({ dataSourceName: "中間" })
    const message = buildGradeLockMessage("この設問の配点・種類", [
      examTotal,
      { ...examTotal, dataSourceId: "copy" },
    ])
    expect(message.lead).toContain("この設問の配点・種類は")
    expect(message.lead).toContain("点数が変わります")
    expect(message.sourceLines).toEqual([
      "成績算出「1学期成績」の評価項目「知識・技能」のデータソース「中間」（試験の合計点）",
    ])
    expect(message.frozenNote).toContain("確定後に元データが変わっています")
  })

  it("データソースの種類を括弧で添える", () => {
    expect(
      describeGradeLockSource(
        source({ dataSourceType: "coursework_total", dataSourceName: "提出物" })
      )
    ).toContain("（資料合計）")
  })
})
