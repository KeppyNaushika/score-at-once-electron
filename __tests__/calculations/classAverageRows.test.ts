/**
 * Excel 学級平均行（Phase 4・主成果）のテスト
 *
 * appendClassAverageRows が
 * - 全体平均行（受験者＝合計点 non-null）
 * - teacherStat 学級ごとの学級平均行（母集団=学級全体、重複カウント）
 * を正しい列に出すことを検証する。
 */
import * as ExcelJS from "exceljs"
import { describe, expect, it } from "vitest"

import { appendClassAverageRows } from "@/electron-src/lib/export/excel/averageRows"
import type { ScoringData } from "@/electron-src/lib/shared/types/exportTypes"
import type { ExamClassroomWithMembers } from "@/types/prismaExtensions"

/** ExamClassroomWithMembers の最小モック（テストで使う teacherStat / class.name / memberships のみ） */
function makeClass(
  name: string,
  studentIds: string[],
  teacherStat = true
): ExamClassroomWithMembers {
  return {
    id: `ec-${name}`,
    examId: "e1",
    classroomId: `c-${name}`,
    administered: true,
    teacherStat,
    studentReport: true,
    order: 0,
    classroom: {
      id: `c-${name}`,
      name,
      classCode: null,
      grade: 3,
      memberships: studentIds.map((studentId) => ({ studentId })),
    },
  } as unknown as ExamClassroomWithMembers
}

function makeStudent(
  id: string,
  totalScore: number | null,
  q1: number | null
): ScoringData {
  return {
    studentId: id,
    studentName: id,
    studentNumber: id,
    scores: [
      {
        questionId: "q1",
        questionLabel: "問1",
        score: q1,
        maxScore: 10,
        status: q1 === null ? "unscored" : "correct",
      },
    ],
    totalScore,
    totalMaxScore: 10,
    subtotalScores: [],
  }
}

const QUESTION_REGIONS = [
  { id: "q1", label: "問1", orderIndex: 0 },
] as unknown as Parameters<typeof appendClassAverageRows>[4]

/** ヘッダー列: 受験状態,順位,学年,学級,出席番号,学籍番号,氏名(7),合計点(8),...設問 */
const NAME_COL = 7
const TOTAL_COL = 8

describe("appendClassAverageRows", () => {
  it("全体平均と teacherStat 学級平均を正しい列・値で出す", () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("点数一覧")
    worksheet.addRow([
      "受験状態",
      "順位",
      "学年",
      "学級",
      "出席番号",
      "学籍番号",
      "氏名",
      "合計点",
      "問1",
    ])

    // S1,S2 が classA。S3 は学級なし。全体平均=(60+80+40)/3=60、classA平均=(60+80)/2=70
    const all = [
      makeStudent("S1", 60, 6),
      makeStudent("S2", 80, 8),
      makeStudent("S3", 40, 4),
    ]
    const classes = [makeClass("3-A組", ["S1", "S2"])]

    appendClassAverageRows(worksheet, all, classes, [], QUESTION_REGIONS)

    // 空行 + 全体平均 + 3-A組平均
    const overall = worksheet.getRow(3) // header=1, 空行=2, 全体平均=3
    expect(overall.getCell(NAME_COL).value).toBe("全体平均")
    expect(overall.getCell(TOTAL_COL).value).toBe(60)

    const classRow = worksheet.getRow(4)
    expect(classRow.getCell(NAME_COL).value).toBe("3-A組平均")
    expect(classRow.getCell(TOTAL_COL).value).toBe(70)
  })

  it("未採点(totalScore null)は平均母数から除外される", () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("点数一覧")
    worksheet.addRow([
      "受験状態",
      "順位",
      "学年",
      "学級",
      "出席番号",
      "学籍番号",
      "氏名",
      "合計点",
      "問1",
    ])

    // S3 は未採点(null) → 全体平均は (60+80)/2=70
    const all = [
      makeStudent("S1", 60, 6),
      makeStudent("S2", 80, 8),
      makeStudent("S3", null, null),
    ]
    appendClassAverageRows(worksheet, all, [], [], QUESTION_REGIONS)
    expect(worksheet.getRow(3).getCell(TOTAL_COL).value).toBe(70)
  })

  it("空データなら何も追加しない", () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("点数一覧")
    worksheet.addRow(["氏名", "合計点"])
    appendClassAverageRows(worksheet, [], [], [], QUESTION_REGIONS)
    expect(worksheet.rowCount).toBe(1)
  })
})
