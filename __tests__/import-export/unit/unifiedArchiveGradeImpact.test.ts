/**
 * 統合アーカイブ（.sao）の取り込みで、変わった行を成績算出の評価項目へ写す（docs §7.5）
 *
 * テスト対象:
 *   src/components/unified-archive/import/archiveGradeInputDiff.ts
 *   src/components/unified-archive/import/archiveGradeImpact.ts
 *   src/components/unified-archive/import/archiveGradeImpactMessages.ts
 *
 * 取り込み先の形: 成績算出「1学期」に評価項目が4つ
 * - 知識（試験の合計点）・設問2（試験の設問2を指す）・提出（資料の項目）・小計（試験の小計。確定済み）
 * 試験は設問1（小計に入る）と設問2。生徒1は「1学期」の名簿に載り、生徒2は載らない。
 * 成績算出「新規」は、この取り込みで作られる（試験の合計点を使う）。
 */

import { describe, expect, it } from "vitest"

import { mapArchiveGradeImpacts } from "@/components/unified-archive/import/archiveGradeImpact"
import {
  archiveGradeItemImpactBadge,
  buildArchiveGradeImpactMessage,
} from "@/components/unified-archive/import/archiveGradeImpactMessages"
import { changesGradeInput } from "@/components/unified-archive/import/archiveGradeInputDiff"

const grade = { id: "grade-1", name: "1学期" }
const newGrade = { id: "grade-new", name: "新規" }

const gradeItem = (
  id: string,
  name: string,
  order: number,
  frozenScoreIds: string[] = [],
  ofGrade = grade
) => ({
  id,
  name,
  order,
  grade: ofGrade,
  frozenScores: frozenScoreIds.map((frozenScoreId) => ({ id: frozenScoreId })),
})

const knowledgeItem = gradeItem("item-knowledge", "知識", 0)
const questionItem = gradeItem("item-question", "設問2", 1)
const courseworkItem = gradeItem("item-coursework", "提出", 2)
const subtotalItem = gradeItem("item-subtotal", "小計", 3, ["frozen-1"])
const newGradeItem = gradeItem("item-new", "知識", 0, [], newGrade)

const dataSource = (
  id: string,
  type: string,
  ofItem: ReturnType<typeof gradeItem>,
  subtotalId: string | null = null
) => ({ id, type, name: id, order: 0, subtotalId, gradeItem: ofItem })

const examTotalSource = dataSource("ds-exam-total", "exam_total", knowledgeItem)
const subtotalSource = dataSource(
  "ds-subtotal",
  "subtotal",
  subtotalItem,
  "subtotal-1"
)
const newGradeSource = dataSource("ds-new", "exam_total", newGradeItem)
const questionSource = dataSource("ds-question", "crop_region", questionItem)
const courseworkSource = dataSource(
  "ds-coursework",
  "coursework",
  courseworkItem
)

const source = {
  referencedRows: [
    { table: "CropRegion", row: { id: "crop-1", examPageId: "page-1" } },
    { table: "CropRegion", row: { id: "crop-2", examPageId: "page-1" } },
    { table: "ExamPage", row: { id: "page-1", examId: "exam-1" } },
    {
      table: "ExamStudent",
      row: { id: "exam-student-1", examId: "exam-1", studentId: "student-1" },
    },
    {
      table: "ExamStudent",
      row: { id: "exam-student-2", examId: "exam-1", studentId: "student-2" },
    },
    {
      table: "CourseworkItem",
      row: { id: "coursework-item-1", courseworkId: "coursework-1" },
    },
    {
      table: "CourseworkStudent",
      row: {
        id: "coursework-student-1",
        courseworkId: "coursework-1",
        studentId: "student-1",
      },
    },
    { table: "Grade", row: { id: "grade-1", name: "1学期" } },
  ],
  exams: [
    {
      id: "exam-1",
      gradeDataSources: [examTotalSource, subtotalSource, newGradeSource],
      examPages: [
        {
          id: "page-1",
          cropRegions: [
            {
              id: "crop-1",
              type: "QUESTION_ANSWER",
              gradeDataSources: [],
              cropSubtotals: [{ subtotalId: "subtotal-1" }],
            },
            {
              id: "crop-2",
              type: "QUESTION_ANSWER",
              gradeDataSources: [questionSource],
              cropSubtotals: [],
            },
          ],
        },
      ],
    },
  ],
  courseworks: [
    {
      id: "coursework-1",
      gradeDataSources: [],
      items: [
        { id: "coursework-item-1", gradeDataSources: [courseworkSource] },
      ],
    },
  ],
  subtotals: [],
  gradeItems: [
    knowledgeItem,
    questionItem,
    courseworkItem,
    subtotalItem,
    newGradeItem,
  ],
  students: [
    {
      id: "student-1",
      gradeStudents: [{ grade }, { grade: newGrade }],
    },
    { id: "student-2", gradeStudents: [] },
  ],
  classrooms: [],
}

const questionScore = (
  cropRegionId: string,
  examStudentId: string,
  status: string,
  extra: Record<string, unknown> = {}
) => ({
  id: `score-${cropRegionId}-${examStudentId}`,
  cropRegionId,
  examStudentId,
  status,
  partialScore: status === "correct" ? 1 : 0,
  comment: "",
  updatedAt: "2026-10-01T00:00:00.000Z",
  ...extra,
})

const change = (
  table: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
) => ({ table, id: String(after.id), before, after })

/** 成績算出「新規」は、この取り込みで作られる */
const newGradeCreated = change("Grade", null, { id: "grade-new", name: "新規" })

/** 成績算出「新規」を作る取り込みとして写す */
const impactsOf = (changes: ReturnType<typeof change>[]) =>
  mapArchiveGradeImpacts([newGradeCreated, ...changes], source)

/** 成績算出の名前 → 評価項目の名前（並び順） */
const itemNamesByGrade = (
  changes: ReturnType<typeof change>[]
): Record<string, string[]> =>
  Object.fromEntries(
    impactsOf(changes).map((impact) => [
      impact.grade.name,
      impact.items.map((item) => item.gradeItem.name),
    ])
  )

describe("変わった行だけを残す", () => {
  it("更新時刻・作成時刻だけの違いは変わらない、値の列の違いは変わる", () => {
    const before = questionScore("crop-1", "exam-student-1", "correct")
    expect(
      changesGradeInput(
        change("QuestionScore", before, {
          ...before,
          updatedAt: "2026-10-05T00:00:00.000Z",
          createdAt: "2026-10-05T00:00:00.000Z",
        })
      )
    ).toBe(false)
    expect(
      changesGradeInput(
        change("QuestionScore", before, { ...before, partialScore: 0 })
      )
    ).toBe(true)
  })

  it("作る行（前が無い）は変わる", () => {
    expect(
      changesGradeInput(
        change(
          "QuestionScore",
          null,
          questionScore("crop-1", "exam-student-1", "correct")
        )
      )
    ).toBe(true)
  })

  it("成績算出が値に使わない列（コメント・設問の位置）だけの違いは変わらない", () => {
    const before = questionScore("crop-1", "exam-student-1", "correct")
    expect(
      changesGradeInput(
        change("QuestionScore", before, { ...before, comment: "よくできた" })
      )
    ).toBe(false)
    const cropRegion = { id: "crop-1", x: 1, label: "1", points: 2 }
    expect(
      changesGradeInput(
        change("CropRegion", cropRegion, { ...cropRegion, x: 5, label: "1a" })
      )
    ).toBe(false)
    expect(
      changesGradeInput(
        change("CropRegion", cropRegion, { ...cropRegion, points: 3 })
      )
    ).toBe(true)
  })

  it("時刻だけ違う行は、評価項目へ写らない", () => {
    const before = questionScore("crop-1", "exam-student-1", "correct")
    expect(
      impactsOf([
        change("QuestionScore", before, {
          ...before,
          updatedAt: "2026-10-05T00:00:00.000Z",
        }),
      ])
    ).toEqual([])
  })
})

describe("採点", () => {
  it("作った採点は、その試験の合計点と、その設問を含む小計へ写る。設問を指すデータソースは別の設問なので出ない", () => {
    expect(
      itemNamesByGrade([
        change(
          "QuestionScore",
          null,
          questionScore("crop-1", "exam-student-1", "correct")
        ),
      ])
    ).toEqual({ "1学期": ["知識", "小計"] })
  })

  it("設問を指すデータソースは、その設問の採点が変わったときだけ出る", () => {
    const before = questionScore("crop-2", "exam-student-1", "correct")
    expect(
      itemNamesByGrade([
        change("QuestionScore", before, { ...before, status: "incorrect" }),
      ])
    ).toEqual({ "1学期": ["知識", "設問2"] })
  })

  it("名簿に載っていない生徒の採点は、どの成績算出の値も変えない", () => {
    const before = questionScore("crop-2", "exam-student-2", "correct")
    expect(
      impactsOf([
        change("QuestionScore", before, { ...before, status: "incorrect" }),
      ])
    ).toEqual([])
  })

  it("取り込みで新しく作られる成績算出は出ない（取り込み先に既にあれば出る）", () => {
    const created = questionScore("crop-1", "exam-student-1", "correct")
    const changes = [
      change("QuestionScore", null, created),
      change("GradeItem", null, {
        id: "item-new",
        gradeId: "grade-new",
        name: "知識",
      }),
    ]
    expect(
      mapArchiveGradeImpacts([newGradeCreated, ...changes], source).map(
        (impact) => impact.grade.name
      )
    ).toEqual(["1学期"])
    expect(
      mapArchiveGradeImpacts(changes, source).map((impact) => impact.grade.name)
    ).toEqual(["1学期", "新規"])
  })
})

describe("設問・資料・成績算出の中・名簿", () => {
  it("設問の配点が変わると、その設問を使うデータソースへ写る", () => {
    const before = { id: "crop-2", examPageId: "page-1", points: 2 }
    expect(
      itemNamesByGrade([change("CropRegion", before, { ...before, points: 3 })])
    ).toEqual({ "1学期": ["知識", "設問2"] })
  })

  it("資料の点数は、その項目を使うデータソースへ写る", () => {
    const before = {
      id: "coursework-score-1",
      courseworkItemId: "coursework-item-1",
      courseworkStudentId: "coursework-student-1",
      score: 5,
    }
    expect(
      itemNamesByGrade([
        change("CourseworkScore", before, { ...before, score: 8 }),
      ])
    ).toEqual({ "1学期": ["提出"] })
  })

  it("成績算出の中の行は、その評価項目へ。確定値そのものの置き換えは印を分ける。名簿の行は名簿の変化として出る", () => {
    const impacts = impactsOf([
      change("GradeOverride", null, {
        id: "override-1",
        gradeStudentId: "grade-student-1",
        gradeItemId: "item-question",
        overrideLabel: "A",
      }),
      change(
        "GradeFrozenScore",
        { id: "frozen-1", gradeItemId: "item-subtotal", percentage: 50 },
        { id: "frozen-1", gradeItemId: "item-subtotal", percentage: 60 }
      ),
      change("GradeStudent", null, {
        id: "grade-student-2",
        gradeId: "grade-1",
        studentId: "student-2",
      }),
    ])
    expect(impacts).toHaveLength(1)
    const [impact] = impacts
    expect(impact.rosterChanged).toBe(true)
    expect(impact.settingsChanged).toBe(false)
    expect(
      impact.items.map((item) => [
        item.gradeItem.name,
        item.frozen,
        item.frozenScoresReplaced,
      ])
    ).toEqual([
      ["設問2", false, false],
      ["小計", true, true],
    ])
  })

  it("生徒の行が変わると、その生徒が名簿に載る（取り込み前からある）成績算出の名簿が変わる", () => {
    const before = { id: "student-1", lastName: "山田" }
    const impacts = impactsOf([
      change("Student", before, { ...before, lastName: "山本" }),
    ])
    expect(
      impacts.map((impact) => [
        impact.grade.name,
        impact.rosterChanged,
        impact.items.length,
      ])
    ).toEqual([["1学期", true, 0]])
  })
})

describe("確定済みの判定と文言", () => {
  it("確定済みの評価項目に写ると、印と強い注意が付く。影響が無ければ変わらないと言う", () => {
    const impacts = impactsOf([
      change(
        "QuestionScore",
        null,
        questionScore("crop-1", "exam-student-1", "correct")
      ),
    ])
    const items = impacts.flatMap((impact) => impact.items)
    expect(items.map((item) => [item.gradeItem.name, item.frozen])).toEqual([
      ["知識", false],
      ["小計", true],
    ])
    expect(items.map(archiveGradeItemImpactBadge)).toEqual([null, "確定済み"])
    expect(buildArchiveGradeImpactMessage(impacts).frozenNote).toContain(
      "確定した値のまま変わりません"
    )

    expect(buildArchiveGradeImpactMessage([])).toEqual({
      lead: "成績算出の値は変わりません。",
      frozenNote: null,
    })
  })
})
