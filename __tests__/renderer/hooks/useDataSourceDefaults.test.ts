// @vitest-environment jsdom
/**
 * データソース追加フォームの「名前」「換算満点」の既定値算出。
 *
 * これらはもともと main 側の専用 IPC（grade:calculateSourceMaxScore）が算出していたが、
 * 規約「main 側で特殊な計算をして専用 IPC を生やさない」に従い renderer へ移した。
 * 移設で満点のルールが変わっていないことをここで固定する。
 *
 * 特に小計点型は、renderer が「選択肢として取得済みの設問領域」から割り当てを辿るのに対し、
 * main は取得時に同梱した cropSubtotals から辿る。両者が同じ集合を見ていることが前提なので、
 * 割り当ての有無で結果が動くことを明示する。
 */
import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useDataSourceDefaults } from "@/components/grades/03-data-sources/hooks/useDataSourceDefaults"
import {
  type AddDataSourceSelection,
  COURSEWORK_WHOLE,
  type CropRegionOption,
  type ExamOption,
  type SubtotalGroupOption,
} from "@/components/grades/03-data-sources/types"
import type { CourseworkCandidate } from "@/queries/coursework"

const EXAM: ExamOption = {
  id: "exam-1",
  examName: "中間試験",
  examDate: null,
}

const SUBTOTAL_GROUPS: SubtotalGroupOption[] = [
  {
    id: "group-1",
    name: "観点",
    subtotals: [{ id: "subtotal-1", name: "知識", order: 0 }],
  },
]

/** 問1(10点)は小計へ割り当て済み、問2(20点)は未割り当て */
const CROP_REGIONS: CropRegionOption[] = [
  {
    id: "region-1",
    label: "問1",
    points: 10,
    cropSubtotals: [{ subtotalId: "subtotal-1" }],
  },
  { id: "region-2", label: "問2", points: 20, cropSubtotals: [] },
]

/** 行の時刻は判定に使わないので固定値でよい */
const FIXED_DATE = new Date("2026-01-01T00:00:00.000Z")

const COURSEWORKS: CourseworkCandidate[] = [
  {
    id: "coursework-1",
    name: "レポート",
    description: null,
    date: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    items: [
      {
        id: "item-1",
        courseworkId: "coursework-1",
        name: "第1回",
        maxScore: 30,
        inputMode: "numeric",
        order: 0,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
      {
        id: "item-2",
        courseworkId: "coursework-1",
        name: "第2回",
        maxScore: 40,
        inputMode: "numeric",
        order: 1,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    ],
  },
]

const EMPTY_SELECTION: AddDataSourceSelection = {
  type: "exam_total",
  examId: "",
  subtotalId: "",
  cropRegionId: "",
  courseworkId: "",
  courseworkItemId: "",
}

function renderDefaults(selection: Partial<AddDataSourceSelection>) {
  return renderHook(() =>
    useDataSourceDefaults({
      selection: { ...EMPTY_SELECTION, ...selection },
      exams: [EXAM],
      subtotalGroups: SUBTOTAL_GROUPS,
      cropRegions: CROP_REGIONS,
      courseworks: COURSEWORKS,
    })
  ).result.current
}

describe("useDataSourceDefaults の換算満点", () => {
  it("全設問合計は試験の全設問の配点を足す", () => {
    expect(
      renderDefaults({ type: "exam_total", examId: EXAM.id }).defaultWeight
    ).toBe("30")
  })

  it("設問は選んだ領域の配点", () => {
    expect(
      renderDefaults({
        type: "crop_region",
        examId: EXAM.id,
        cropRegionId: "region-2",
      }).defaultWeight
    ).toBe("20")
  })

  it("小計点は割り当て済みの設問の配点だけを足す", () => {
    expect(
      renderDefaults({
        type: "subtotal",
        examId: EXAM.id,
        subtotalId: "subtotal-1",
      }).defaultWeight
    ).toBe("10")
  })

  it("資料の評価項目はその満点", () => {
    expect(
      renderDefaults({
        type: "coursework",
        courseworkId: "coursework-1",
        courseworkItemId: "item-2",
      }).defaultWeight
    ).toBe("40")
  })

  it("資料全体は全評価項目の満点合計", () => {
    expect(
      renderDefaults({
        type: "coursework",
        courseworkId: "coursework-1",
        courseworkItemId: COURSEWORK_WHOLE,
      }).defaultWeight
    ).toBe("70")
  })

  it("満点が未確定（0）の段階では埋めない", () => {
    expect(renderDefaults({ type: "exam_total" }).defaultWeight).toBe("")
  })
})

describe("useDataSourceDefaults の既定の名前", () => {
  it("全設問合計は試験名(合計)", () => {
    expect(
      renderDefaults({ type: "exam_total", examId: EXAM.id }).defaultName
    ).toBe("中間試験(合計)")
  })

  it("小計点は試験名(観点名)", () => {
    expect(
      renderDefaults({
        type: "subtotal",
        examId: EXAM.id,
        subtotalId: "subtotal-1",
      }).defaultName
    ).toBe("中間試験(知識)")
  })

  it("設問は試験名(設問ラベル)", () => {
    expect(
      renderDefaults({
        type: "crop_region",
        examId: EXAM.id,
        cropRegionId: "region-1",
      }).defaultName
    ).toBe("中間試験(問1)")
  })

  it("資料は資料名(評価項目名)", () => {
    expect(
      renderDefaults({
        type: "coursework",
        courseworkId: "coursework-1",
        courseworkItemId: "item-1",
      }).defaultName
    ).toBe("レポート(第1回)")
  })

  it("資料全体は資料名(合計)", () => {
    expect(
      renderDefaults({
        type: "coursework",
        courseworkId: "coursework-1",
        courseworkItemId: COURSEWORK_WHOLE,
      }).defaultName
    ).toBe("レポート(合計)")
  })

  it("選択が未完成なら空文字", () => {
    expect(
      renderDefaults({ type: "subtotal", examId: EXAM.id }).defaultName
    ).toBe("")
  })
})
