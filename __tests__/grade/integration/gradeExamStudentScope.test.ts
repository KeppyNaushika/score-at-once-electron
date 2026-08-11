/**
 * 成績算出が「その試験の受験者」以外の採点を拾わないことの統合テスト（#962 の本丸）。
 *
 * 配線変更前、gradeCalculator は CropRegion 起点で採点行を集めており、ExamStudent で
 * 絞っていなかった。そのため試験から外した生徒の採点データが残っていると、試験側の
 * 画面・出力（すべて ExamStudent 起点）には一切現れないのに、成績算出でだけ素点として
 * 算入されていた。採点層を ExamStudent の子にした今は、外した瞬間に採点も消え、
 * かつ経路上も受験者を必ず1回通るため、この非対称は構造的に起こらない。
 *
 * 併せて「見込（expected）は欠測扱いにする」判定が、status を経路上から読むように
 * なった後も従来どおり効くことを固定する。
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

import { removeStudentsFromExam } from "@/electron-src/lib/prisma/examStudent"
import { calculateGrades } from "@/electron-src/lib/shared/calculations/gradeCalculator"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

interface Fixture {
  gradeId: string
  examId: string
  studentId: string
  examStudentId: string
}

/**
 * 生徒1名・設問1つ（配点10・正解）の試験を作り、その exam_total を
 * 参照する成績（評価項目1つ）を組み立てる。
 */
async function buildFixture(): Promise<Fixture> {
  const user = await testPrisma.user.create({
    data: { username: `grader_${Date.now()}`, name: "採点者" },
  })
  const student = await testPrisma.student.create({
    data: {
      studentNumber: `S${Date.now()}`,
      lastName: "山田",
      firstName: "太郎",
      lastNameKana: "ヤマダ",
      firstNameKana: "タロウ",
    },
  })

  const exam = await testPrisma.exam.create({ data: { examName: "期末考査" } })
  const examPage = await testPrisma.examPage.create({
    data: { examId: exam.id, pageNumber: 1, imagePath: "" },
  })
  const cropRegion = await testPrisma.cropRegion.create({
    data: {
      examPageId: examPage.id,
      label: "問1",
      type: "QUESTION_ANSWER",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      points: 10,
      orderIndex: 0,
    },
  })
  const examStudent = await testPrisma.examStudent.create({
    data: { examId: exam.id, studentId: student.id, status: "participating" },
  })
  await testPrisma.questionScore.create({
    data: {
      cropRegionId: cropRegion.id,
      examStudentId: examStudent.id,
      status: "correct",
      userId: user.id,
    },
  })

  const grade = await testPrisma.grade.create({ data: { name: "1学期成績" } })
  await testPrisma.gradeStudent.create({
    data: { gradeId: grade.id, studentId: student.id },
  })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "知識・技能", order: 0 },
  })
  await testPrisma.gradeDataSource.create({
    data: {
      gradeItemId: gradeItem.id,
      type: "exam_total",
      examId: exam.id,
      name: "期末考査",
      weight: 1,
      order: 0,
      treatExpectedAsMissing: true,
    },
  })

  return {
    gradeId: grade.id,
    examId: exam.id,
    studentId: student.id,
    examStudentId: examStudent.id,
  }
}

/** 対象セル（生徒1名・評価項目1つ）の参照元スコアを取り出す */
async function readSourceScore(gradeId: string) {
  const calculation = await calculateGrades(gradeId)
  return calculation.students[0].gradeItemResults[0].sourceScores[0]
}

describe("成績算出の受験者スコープ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("受験者として登録されている間は素点が算入される", async () => {
    const fixture = await buildFixture()

    const source = await readSourceScore(fixture.gradeId)
    expect(source.rawScore).toBe(10)
    expect(source.isEstimated).toBe(false)
  })

  it("試験から外した生徒の得点は算入されない（#962 の非対称の解消）", async () => {
    const fixture = await buildFixture()

    await removeStudentsFromExam(fixture.examId, [fixture.studentId])

    const source = await readSourceScore(fixture.gradeId)
    expect(source.rawScore).toBeNull()
  })

  it("受験状態が見込（expected）なら欠測として扱う", async () => {
    const fixture = await buildFixture()

    await testPrisma.examStudent.update({
      where: { id: fixture.examStudentId },
      data: { status: "expected" },
    })

    const source = await readSourceScore(fixture.gradeId)
    expect(source.rawScore).toBeNull()
  })
})
