/**
 * 成績一覧（grade:getAll）の供給形の統合テスト
 *
 * 一覧は各段の画面用の include を丸ごと共有しており、満点の元データも参照先の
 * 表示名も使わないまま受け取っていた。一覧専用の最小 include へ分けたので、
 * 「一覧が読むものは来る」「一覧が読まないものは来ない」の両方を固定する。
 *
 * `_count` を撤去したため、件数表示（生徒数・評価項目数）と次のステップ判定は
 * 行そのものから renderer が導く。行が来なければ黙って 0 件・未着手になる。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { createGrade, getAllGrades } from "@/electron-src/lib/prisma/grade"
import { getGradeStatus } from "@/lib/gradeStatus"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 生徒1名・評価項目1つ・資料ソース1本を持つ成績を作る */
async function createGradeWithCourseworkSource() {
  const created = await createGrade({ name: "1学期成績" })
  const gradeId = created.id

  const student = await testPrisma.student.create({
    data: {
      studentNumber: "S001",
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })
  await testPrisma.gradeStudent.create({
    data: { gradeId, studentId: student.id, customOrder: 0 },
  })

  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId, name: "知識", order: 0 },
  })

  const coursework = await testPrisma.coursework.create({
    data: { name: "提出物" },
  })
  const courseworkItem = await testPrisma.courseworkItem.create({
    data: { courseworkId: coursework.id, name: "レポート", maxScore: 20 },
  })
  const courseworkStudent = await testPrisma.courseworkStudent.create({
    data: { courseworkId: coursework.id, studentId: student.id },
  })
  const dataSource = await testPrisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "coursework",
      name: "提出物(レポート)",
      courseworkItemId: courseworkItem.id,
      weight: 20,
      order: 0,
    },
  })

  return {
    gradeId,
    gradeItemId: gradeItem.id,
    courseworkItemId: courseworkItem.id,
    courseworkStudentId: courseworkStudent.id,
    dataSourceId: dataSource.id,
    studentId: student.id,
  }
}

describe("成績一覧の供給形", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("件数表示が読む対象者と評価項目は行として来る", async () => {
    const fixture = await createGradeWithCourseworkSource()

    const result = await getAllGrades()
    const grade = result.find((candidate) => candidate.id === fixture.gradeId)!

    // 件数を数えるのは renderer。main は `_count` を作らない
    expect(grade.gradeStudents.length).toBe(1)
    expect(grade.gradeItems.length).toBe(1)
    expect(grade.gradeClassrooms).toEqual([])
  })

  it("一覧が読まない満点の元データと参照先は含まない", async () => {
    const fixture = await createGradeWithCourseworkSource()

    const result = await getAllGrades()
    const grade = result.find((candidate) => candidate.id === fixture.gradeId)!
    const dataSource = grade.gradeItems[0].dataSources[0] as unknown as Record<
      string,
      unknown
    >

    // 03 のデータソース行が使う表示名と、満点算出の元データは詳細（getById）の担当
    expect(dataSource.exam).toBeUndefined()
    expect(dataSource.subtotal).toBeUndefined()
    expect(dataSource.cropRegion).toBeUndefined()
    expect(dataSource.coursework).toBeUndefined()
    // 資料の点数は、外部成績の段を畳んで次のステップ判定が読まなくなった
    expect(dataSource.courseworkItem).toBeUndefined()
    expect(dataSource.estimationSources).toBeUndefined()
    // 満点は表示しないので付与もしない（元データが無いので 0 を並べるだけになる）
    expect(dataSource.maxScore).toBeUndefined()
  })

  it("データソースがあれば、資料の点数が未入力でも次は成績境界", async () => {
    const fixture = await createGradeWithCourseworkSource()

    const result = await getAllGrades()
    const grade = result.find((candidate) => candidate.id === fixture.gradeId)!

    // 点数の入力は資料の段の仕事で、成績の段には入力の段が無い。
    // 入り具合はデータソース画面が数えて見せる
    expect(getGradeStatus(grade).url).toBe(
      `/grades/${fixture.gradeId}/03-boundaries`
    )
  })

  it("対象者が居なければ生徒の登録へ誘導する", async () => {
    const created = await createGrade({ name: "空の成績" })

    const result = await getAllGrades()
    const grade = result.find((candidate) => candidate.id === created.id)!

    expect(grade.gradeStudents).toEqual([])
    expect(getGradeStatus(grade).url).toBe(`/grades/${created.id}/01-students`)
  })

  it("作成直後の成績も一覧と同じ形で返る", async () => {
    // 作成結果をそのまま一覧・詳細へ渡せると型が言う以上、対象者は必ず来る
    const created = await createGrade({ name: "作った直後" })

    expect(created.gradeStudents).toEqual([])
    expect(getGradeStatus(created).url).toBe(
      `/grades/${created.id}/01-students`
    )
  })
})
