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
  studentSearchTerms,
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
