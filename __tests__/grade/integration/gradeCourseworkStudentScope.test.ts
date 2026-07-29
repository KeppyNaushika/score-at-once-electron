/**
 * 成績算出が「その資料の対象者」以外の点数を拾わないことの統合テスト（#962 Phase B）。
 *
 * 配線変更前、CourseworkScore は Student 直結で、rawScoreCalculator も
 * `score.studentId === studentId` で引いていた。そのため資料の名簿から外した生徒の
 * 点数が残っていると、資料の画面（すべて CourseworkStudent 起点）には一切現れないのに、
 * 成績算出でだけ素点として算入されていた。点数を CourseworkStudent の子にした今は、
 * 外した瞬間に点数も消え、かつ経路上も対象者を必ず1回通るため構造的に起こらない。
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

import { removeStudentsFromCoursework } from "@/electron-src/lib/prisma/coursework"
import { calculateGrades } from "@/electron-src/lib/shared/calculations/gradeCalculator"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

interface Fixture {
  gradeId: string
  courseworkId: string
  studentId: string
  courseworkStudentId: string
}

/**
 * 生徒1名・評価項目1つ（満点100・素点80）の資料を作り、その coursework 型
 * データソースを参照する成績（評価項目1つ）を組み立てる。
 */
async function buildFixture(): Promise<Fixture> {
  const student = await testPrisma.student.create({
    data: {
      studentNumber: `S${Date.now()}`,
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })

  const coursework = await testPrisma.coursework.create({
    data: { name: "第1回レポート" },
  })
  const courseworkItem = await testPrisma.courseworkItem.create({
    data: {
      courseworkId: coursework.id,
      name: "提出物",
      maxScore: 100,
      inputMode: "numeric",
      order: 0,
    },
  })
  const courseworkStudent = await testPrisma.courseworkStudent.create({
    data: { courseworkId: coursework.id, studentId: student.id },
  })
  await testPrisma.courseworkScore.create({
    data: {
      courseworkItemId: courseworkItem.id,
      courseworkStudentId: courseworkStudent.id,
      score: 80,
    },
  })

  const grade = await testPrisma.grade.create({ data: { name: "1学期成績" } })
  await testPrisma.gradeStudent.create({
    data: { gradeId: grade.id, studentId: student.id },
  })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "主体的態度", order: 0 },
  })
  await testPrisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "coursework",
      courseworkItemId: courseworkItem.id,
      name: "提出物",
      weight: 1,
      order: 0,
    },
  })

  return {
    gradeId: grade.id,
    courseworkId: coursework.id,
    studentId: student.id,
    courseworkStudentId: courseworkStudent.id,
  }
}

/** 対象セル（生徒1名・評価項目1つ）の参照元スコアを取り出す */
async function readSourceScore(gradeId: string) {
  const calculation = await calculateGrades(gradeId)
  expect(calculation.success).toBe(true)
  return calculation.result!.students[0].gradeItemResults[0].sourceScores[0]
}

describe("成績算出の資料対象者スコープ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("対象者として登録されている間は素点が算入される", async () => {
    const fixture = await buildFixture()

    const source = await readSourceScore(fixture.gradeId)
    expect(source.rawScore).toBe(80)
    expect(source.isEstimated).toBe(false)
  })

  it("資料から外した生徒の点数は算入されない（#962 の非対称の解消）", async () => {
    const fixture = await buildFixture()

    await removeStudentsFromCoursework(fixture.courseworkId, [
      fixture.studentId,
    ])

    const source = await readSourceScore(fixture.gradeId)
    expect(source.rawScore).toBeNull()
  })

  it("資料から外しても、点数そのものが DB から消えている", async () => {
    const fixture = await buildFixture()

    await removeStudentsFromCoursework(fixture.courseworkId, [
      fixture.studentId,
    ])

    const remaining = await testPrisma.courseworkScore.count({
      where: { courseworkStudentId: fixture.courseworkStudentId },
    })
    expect(remaining).toBe(0)
  })
})
