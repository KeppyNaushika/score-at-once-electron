import { describe, expect, it } from "vitest"

import {
  buildDeletionBlockedMessage,
  buildItemDeletionWarning,
  buildRosterRemovalWarning,
  buildStudentDeletionBlockedMessage,
  courseworkItemUsages,
  courseworkUsingDataSources,
  cropRegionUsages,
  examPageUsages,
  examUsingDataSources,
  type GradeDataSourceUsage,
  listReferencingGradeNames,
  type UsingGradeDataSource,
} from "@/lib/shared/gradeReferenceMessages"

/** 詳細に同梱されるデータソース1件 */
const dataSource = ({
  gradeName = "1学期成績",
  gradeItemName = "知識・技能",
  gradeItemOrder = 0,
  name = "問1",
  type = "crop_region",
  order = 0,
  subtotalId = null,
}: {
  gradeName?: string
  gradeItemName?: string
  gradeItemOrder?: number
  name?: string
  type?: string
  order?: number
  subtotalId?: string | null
}): UsingGradeDataSource => ({
  id: crypto.randomUUID(),
  type,
  name,
  order,
  subtotalId,
  gradeItem: {
    id: `${gradeName}-${gradeItemName}`,
    name: gradeItemName,
    order: gradeItemOrder,
    grade: { id: gradeName, name: gradeName },
    frozenScores: [],
  },
})

const direct = (
  usingDataSource: UsingGradeDataSource
): GradeDataSourceUsage => ({
  dataSource: usingDataSource,
  usage: "direct",
})

const total = (
  usingDataSource: UsingGradeDataSource
): GradeDataSourceUsage => ({
  dataSource: usingDataSource,
  usage: "total",
})

describe("listReferencingGradeNames", () => {
  it("成績算出の名前を出てきた順に重複なく返す", () => {
    expect(
      listReferencingGradeNames([
        dataSource({ gradeName: "A" }),
        dataSource({ gradeName: "B" }),
        dataSource({ gradeName: "A" }),
      ])
    ).toEqual(["A", "B"])
  })
})

describe("同梱から使っているデータソースを導く", () => {
  const examTotal = dataSource({ name: "中間", type: "exam_total" })
  const calculation = dataSource({
    name: "計算",
    type: "subtotal",
    subtotalId: "subtotal-calc",
  })
  const question1 = dataSource({ name: "問1" })
  const question2 = dataSource({ name: "問2", order: 1 })
  const exam = {
    gradeDataSources: [examTotal, calculation, question1],
    examPages: [
      {
        id: "page-1",
        cropRegions: [
          {
            id: "region-1",
            type: "QUESTION_ANSWER",
            // 設問のデータソースは examId も持つので、試験の側にも重ねて現れる
            gradeDataSources: [question1],
            cropSubtotals: [{ subtotalId: "subtotal-calc" }],
          },
          {
            id: "name-box",
            type: "STUDENT_NAME",
            gradeDataSources: [],
            cropSubtotals: [],
          },
        ],
      },
      {
        id: "page-2",
        cropRegions: [
          {
            id: "region-2",
            type: "QUESTION_ANSWER",
            // examId を持たない設問のデータソースも設問から拾う
            gradeDataSources: [question2],
            cropSubtotals: [],
          },
        ],
      },
    ],
  }

  it("試験: 試験そのものと設問を指すものを、重複なく並べる", () => {
    expect(
      examUsingDataSources(exam).map((usingDataSource) => usingDataSource.name)
    ).toEqual(["中間", "計算", "問1", "問2"])
  })

  it("並びは成績算出の名前 → 評価項目 → データソースの順", () => {
    const later = dataSource({ gradeName: "B", name: "後" })
    const secondItem = dataSource({
      gradeName: "A",
      gradeItemOrder: 1,
      name: "2つ目の項目",
    })
    const first = dataSource({ gradeName: "A", name: "最初" })
    expect(
      examUsingDataSources({
        gradeDataSources: [later, secondItem, first],
        examPages: [],
      }).map((usingDataSource) => usingDataSource.name)
    ).toEqual(["最初", "2つ目の項目", "後"])
  })

  it("設問: そのものを指すものと、合計点・設問を含む小計", () => {
    expect(cropRegionUsages(exam, "region-1")).toEqual([
      direct(question1),
      total(examTotal),
      total(calculation),
    ])
  })

  it("設問: 解答欄でなければ合計点には効かない", () => {
    expect(cropRegionUsages(exam, "name-box")).toEqual([])
  })

  it("模範解答ページ: ページ上の設問すべてについて見る", () => {
    expect(examPageUsages(exam, "page-2")).toEqual([
      direct(question2),
      total(examTotal),
    ])
  })

  it("資料: 資料合計と、評価項目1つずつ。評価項目を消すと資料合計も変わる", () => {
    const courseworkTotal = dataSource({
      name: "課題合計",
      type: "coursework_total",
    })
    const submission = dataSource({ name: "提出物", type: "coursework" })
    const coursework = {
      gradeDataSources: [courseworkTotal],
      items: [
        { id: "item-1", gradeDataSources: [submission] },
        { id: "item-2", gradeDataSources: [] },
      ],
    }
    expect(courseworkUsingDataSources(coursework)).toEqual([
      courseworkTotal,
      submission,
    ])
    expect(courseworkItemUsages(coursework, "item-1")).toEqual([
      direct(submission),
      total(courseworkTotal),
    ])
  })
})

describe("buildDeletionBlockedMessage", () => {
  it("使われていなければ null", () => {
    expect(buildDeletionBlockedMessage("exam", [])).toBeNull()
  })

  it("使っているデータソースを1行ずつ並べる", () => {
    const message = buildDeletionBlockedMessage("exam", [
      dataSource({ type: "exam_total", name: "中間" }),
      dataSource({ gradeName: "2学期成績", name: "問1" }),
    ])
    expect(message).toContain(
      "この試験は次の成績算出で使われているため、削除できません。"
    )
    expect(message).toContain(
      "・成績算出「1学期成績」の評価項目「知識・技能」のデータソース「中間」"
    )
    expect(message).toContain(
      "・成績算出「2学期成績」の評価項目「知識・技能」のデータソース「問1」"
    )
  })

  it("資料の文言", () => {
    expect(
      buildDeletionBlockedMessage("coursework", [dataSource({})])
    ).toContain("この試験外成績資料は次の成績算出で使われているため")
  })

  it("小計点グループの文言", () => {
    const message = buildDeletionBlockedMessage("subtotalGroup", [
      dataSource({ type: "subtotal", name: "計算" }),
    ])
    expect(message).toContain(
      "この小計点グループは次の成績算出で使われているため、削除できません。"
    )
    expect(message).toContain(
      "・成績算出「1学期成績」の評価項目「知識・技能」のデータソース「計算」"
    )
  })
})

describe("buildStudentDeletionBlockedMessage", () => {
  const roster = (gradeName: string) => ({
    grade: { id: gradeName, name: gradeName },
  })

  it("名簿に載っている成績算出を名前順に重複なく挙げ、名簿から外すよう促す", () => {
    expect(
      buildStudentDeletionBlockedMessage([
        roster("2学期成績"),
        roster("1学期成績"),
        roster("2学期成績"),
      ])
    ).toBe(
      "この生徒は次の成績算出の名簿に載っているため、削除できません。" +
        "削除するには、先に各成績算出の「1. 生徒管理」でこの生徒を名簿から外してください。\n" +
        "・成績算出「1学期成績」\n" +
        "・成績算出「2学期成績」"
    )
  })

  it("名簿に載っていなければ null", () => {
    expect(buildStudentDeletionBlockedMessage([])).toBeNull()
  })
})

describe("buildItemDeletionWarning", () => {
  it("使われていなければ null", () => {
    expect(buildItemDeletionWarning("cropRegion", [])).toBeNull()
  })

  it("設問: そのものを使うデータソースは削除、合計に含むものは点数が変わる", () => {
    const message = buildItemDeletionWarning("cropRegion", [
      direct(dataSource({ name: "問1" })),
      total(dataSource({ name: "中間テスト", type: "exam_total" })),
      total(dataSource({ name: "計算", type: "subtotal" })),
    ])
    expect(message).toContain("データソース「問1」（この設問）が削除されます")
    expect(message).toContain(
      "データソース「中間テスト」（試験の合計点）の点数が変わります"
    )
    expect(message).toContain("データソース「計算」（小計）の点数が変わります")
  })

  it("評価項目: そのものを使うデータソースは参照先を失い、資料合計は変わる", () => {
    const message = buildItemDeletionWarning("courseworkItem", [
      direct(dataSource({ name: "提出物", type: "coursework" })),
      total(dataSource({ name: "課題合計", type: "coursework_total" })),
    ])
    expect(message).toContain(
      "データソース「提出物」（この評価項目）が参照先を失い、点数を取り込めなくなります"
    )
    expect(message).toContain(
      "データソース「課題合計」（資料合計）の点数が変わります"
    )
  })

  it("小計項目: データソースが削除される", () => {
    expect(
      buildItemDeletionWarning("subtotal", [
        direct(dataSource({ name: "計算", type: "subtotal" })),
      ])
    ).toContain("データソース「計算」（この小計項目）が削除されます")
  })
})

describe("buildItemDeletionWarning（模範解答ページ）", () => {
  it("ページの設問を使うデータソースは削除、合計に含むものは点数が変わる", () => {
    const message = buildItemDeletionWarning("examPage", [
      direct(dataSource({ name: "問1" })),
      total(dataSource({ name: "中間テスト", type: "exam_total" })),
    ])
    expect(message).toContain("この模範解答ページは成績算出で使われています。")
    expect(message).toContain(
      "データソース「問1」（このページの設問）が削除されます"
    )
    expect(message).toContain(
      "データソース「中間テスト」（試験の合計点）の点数が変わります"
    )
  })
})

describe("buildRosterRemovalWarning", () => {
  it("使われていなければ null", () => {
    expect(buildRosterRemovalWarning("exam", [])).toBeNull()
  })

  it("試験: 使っている成績算出を重複なく挙げ、欠測になることを伝える", () => {
    const message = buildRosterRemovalWarning("exam", [
      dataSource({ gradeName: "A", type: "exam_total" }),
      dataSource({ gradeName: "B" }),
      dataSource({ gradeName: "A" }),
    ])
    expect(message).toBe(
      "この試験は次の成績算出で使われています。" +
        "受験生徒から外した生徒は、各成績算出でこの試験の点数が欠測になります" +
        "（その成績算出の名簿に載っている場合）。\n" +
        "・成績算出「A」\n" +
        "・成績算出「B」"
    )
  })

  it("資料の文言", () => {
    expect(
      buildRosterRemovalWarning("coursework", [
        dataSource({ type: "coursework_total" }),
      ])
    ).toContain(
      "対象生徒から外した生徒は、各成績算出でこの試験外成績資料の点数が欠測になります"
    )
  })
})
