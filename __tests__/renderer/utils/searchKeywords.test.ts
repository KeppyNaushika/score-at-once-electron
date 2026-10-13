/**
 * 選択肢・検索欄の手がかりの組み立て。
 *
 * 生徒の選択肢は画面ごとに表示がばらばらで、番号やカナで引けない画面があった。
 * 表示は「姓 名 (番号)」、手がかりは番号とカナにそろえる。
 */
import type { Classroom } from "@prisma/client"
import { describe, expect, it } from "vitest"

import {
  classroomFilterOptions,
  studentOption,
  studentOptions,
  studentSearchTerms,
  withDuplicateLabelDetails,
} from "@/lib/searchKeywords"

const student = {
  lastName: "山田",
  firstName: "太郎",
  lastNameKana: "ヤマダ",
  firstNameKana: "タロウ",
  studentNumber: "1203",
}

const classroom = (overrides: Partial<Classroom>): Classroom => ({
  id: "classroom-1",
  name: "1年1組",
  createdAt: new Date(0),
  updatedAt: new Date(0),
  grade: 1,
  description: null,
  classroomCode: "C11",
  isVisible: true,
  ...overrides,
})

describe("studentOption", () => {
  it("表示は「姓 名 (番号)」で、番号とカナ（空けた形・詰めた形）で引ける", () => {
    expect(studentOption("exam-student-1", student)).toEqual({
      value: "exam-student-1",
      label: "山田 太郎 (1203)",
      keywords: ["1203", "ヤマダ タロウ", "ヤマダタロウ"],
    })
  })
})

describe("studentSearchTerms", () => {
  it("氏名・カナ・番号を返す", () => {
    expect(studentSearchTerms(student)).toEqual([
      "山田太郎",
      "ヤマダタロウ",
      "1203",
    ])
  })
})

describe("classroomFilterOptions", () => {
  it("先頭に「すべての学級」を置き、非表示の学級には印を添える", () => {
    const options = classroomFilterOptions([
      classroom({}),
      classroom({ id: "classroom-2", name: "前年度1組", isVisible: false }),
    ])
    expect(options.map((option) => [option.value, option.label])).toEqual([
      ["all", "すべての学級"],
      ["classroom-1", "1年1組"],
      ["classroom-2", "前年度1組（非表示）"],
    ])
  })
})

describe("同じ見出しの選択肢を見分ける添え書き", () => {
  it("見出しが重なった生徒にだけ、読みと入学年度を添える", () => {
    const options = studentOptions([
      {
        value: "student-a",
        student: { ...student, enrollmentYear: 2024 },
      },
      {
        value: "student-b",
        student: { ...student, lastNameKana: "ヤマタ", enrollmentYear: 2025 },
      },
      {
        value: "student-c",
        student: { ...student, studentNumber: "9999", enrollmentYear: null },
      },
    ])

    expect(options.map((option) => option.label)).toEqual([
      "山田 太郎 (1203)（ヤマダ タロウ・2024年度入学）",
      "山田 太郎 (1203)（ヤマタ タロウ・2025年度入学）",
      "山田 太郎 (9999)",
    ])
  })

  it("同じ名前の学級には、コード・学年・作成日を添える", () => {
    const options = classroomFilterOptions([
      classroom({ id: "classroom-a", classroomCode: "A" }),
      classroom({
        id: "classroom-b",
        classroomCode: "B",
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
      classroom({ id: "classroom-c", name: "1年2組" }),
    ])

    expect(options.map((option) => option.label)).toEqual([
      "すべての学級",
      `1年1組（A・1年・作成 ${new Date(0).toLocaleDateString("ja-JP")}）`,
      `1年1組（B・1年・作成 ${new Date("2026-04-01T00:00:00.000Z").toLocaleDateString("ja-JP")}）`,
      "1年2組",
    ])
  })

  it("添え書きが空なら見出しを変えない", () => {
    expect(
      withDuplicateLabelDetails(
        [{ label: "同じ" }, { label: "同じ" }],
        () => ""
      ).map((option) => option.label)
    ).toEqual(["同じ", "同じ"])
  })
})
